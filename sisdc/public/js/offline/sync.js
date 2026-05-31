// Orquestrador de sincronizacao do PWA.
//
// Estrategia:
//  1) PUSH em lote dos cadastros pendentes (idempotente por client_uuid).
//  2) PULL incremental para reconciliar status definidos pela auditoria.
//  3) Disparo automatico ao voltar a conexao (evento `online`) e via
//     Background Sync do Service Worker quando suportado.

import { v4 as uuidv4 } from 'uuid';
import {
    listarPendentes,
    confirmarSincronizado,
    getMeta,
    setMeta,
} from './db.js';

const API = '/api/v1';

function csrf() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

async function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': csrf(),
        'Authorization': `Bearer ${await getMeta('api_token', '')}`,
    };
}

/** Envia todos os cadastros pendentes em um unico lote. */
export async function push() {
    const pendentes = await listarPendentes();
    if (pendentes.length === 0) return { enviados: 0 };

    const payload = {
        batch_uuid: uuidv4(),
        device_id: await getMeta('device_id', 'desconhecido'),
        cadastros: pendentes,
    };

    const resp = await fetch(`${API}/sync/cadastros`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(payload),
    });

    // 207 Multi-Status: tratamos item a item.
    if (!resp.ok && resp.status !== 207) {
        throw new Error(`Falha no push (${resp.status})`);
    }

    const resultado = await resp.json();
    for (const item of resultado.itens ?? []) {
        if (item.acao === 'criado' || item.acao === 'atualizado' || item.acao === 'ignorado') {
            await confirmarSincronizado(item.client_uuid, item);
        }
        // itens com `acao === 'erro'` permanecem na outbox para nova tentativa.
    }
    return resultado.resumo;
}

/** Busca atualizacoes do servidor desde o ultimo pull. */
export async function pull() {
    const desde = await getMeta('ultimo_pull', null);
    const url = new URL(`${API}/sync/cadastros`, location.origin);
    if (desde) url.searchParams.set('desde', desde);

    const resp = await fetch(url, { headers: await authHeaders() });
    if (!resp.ok) throw new Error(`Falha no pull (${resp.status})`);

    const dados = await resp.json();
    for (const c of dados.cadastros ?? []) {
        await confirmarSincronizado(c.client_uuid, c);
    }
    await setMeta('ultimo_pull', dados.servidor_em);
    return dados.cadastros?.length ?? 0;
}

/** Ciclo completo, com tolerancia a falhas de rede. */
export async function sincronizar() {
    try {
        const resumoPush = await push();
        const recebidos = await pull();
        return { ok: true, push: resumoPush, pull: recebidos };
    } catch (e) {
        console.warn('Sincronizacao adiada:', e.message);
        return { ok: false, erro: e.message };
    }
}

// Dispara assim que a conexao volta.
window.addEventListener('online', () => sincronizar());

// Registra Background Sync (envia em segundo plano mesmo com o app fechado).
export async function registrarBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register('sisdc-sync-cadastros');
    }
}
