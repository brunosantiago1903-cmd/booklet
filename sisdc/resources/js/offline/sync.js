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
    listarFotosPendentes,
    confirmarFotoEnviada,
    getMeta,
    setMeta,
} from './db.js';

const API = '/api/v1';

// Tempo máximo de espera por resposta do servidor. Sem isto, um servidor
// ocupado/travado (ex.: dev server single-thread atendendo outra aba) deixaria
// o fetch pendurado e a tela presa em "Sincronizando…" para sempre. Com o
// timeout o ciclo sempre termina — com erro claro e nova tentativa depois.
const TIMEOUT_MS = 20000;

/** fetch com limite de tempo (AbortController) e mensagem de erro amigável. */
async function fetchComTimeout(url, opts = {}, ms = TIMEOUT_MS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { ...opts, signal: ctrl.signal });
    } catch (e) {
        if (e.name === 'AbortError') {
            throw new Error('o servidor demorou a responder — tente novamente em instantes');
        }
        throw new Error('sem conexão com o servidor');
    } finally {
        clearTimeout(t);
    }
}

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

    const resp = await fetchComTimeout(`${API}/sync/cadastros`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(payload),
    });

    // 207 Multi-Status: tratamos item a item. Outros status (401/403/422/500)
    // sao falha real — lemos o corpo para mostrar o motivo ao operador.
    if (!resp.ok && resp.status !== 207) {
        let detalhe = '';
        try {
            const corpo = await resp.json();
            detalhe = corpo.message
                || Object.values(corpo.errors ?? {}).flat().join(' ')
                || '';
        } catch { /* corpo nao-JSON */ }
        const motivo = resp.status === 401 || resp.status === 403
            ? 'sessão/token expirado — recarregue a página e entre novamente'
            : detalhe;
        throw new Error(`Falha no envio (${resp.status})${motivo ? ': ' + motivo : ''}`);
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

    const resp = await fetchComTimeout(url, { headers: await authHeaders() });
    if (!resp.ok) throw new Error(`Falha no pull (${resp.status})`);

    const dados = await resp.json();
    for (const c of dados.cadastros ?? []) {
        await confirmarSincronizado(c.client_uuid, c);
    }
    await setMeta('ultimo_pull', dados.servidor_em);
    return dados.cadastros?.length ?? 0;
}

/** Envia as fotos pendentes (multipart), uma a uma. Idempotente por client_uuid. */
export async function pushAnexos() {
    const pendentes = await listarFotosPendentes();
    let enviadas = 0;
    const token = await getMeta('api_token', '');

    for (const foto of pendentes) {
        const fd = new FormData();
        fd.append('client_uuid', foto.client_uuid);
        fd.append('cadastro_client_uuid', foto.cadastro_uuid);
        fd.append('categoria', foto.categoria);
        if (foto.latitude != null) fd.append('latitude', foto.latitude);
        if (foto.longitude != null) fd.append('longitude', foto.longitude);
        if (foto.capturado_em) fd.append('capturado_em', foto.capturado_em);
        fd.append('file', foto.blob, `${foto.client_uuid}.jpg`);

        // Upload de imagem pode ser mais lento no 4G: timeout maior.
        const resp = await fetchComTimeout(`${API}/sync/anexos`, {
            method: 'POST',
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
            body: fd,
        }, 60000);
        if (resp.ok) {
            await confirmarFotoEnviada(foto.client_uuid);
            enviadas++;
        }
        // Falha: a foto permanece pendente para nova tentativa.
    }
    return enviadas;
}

/** Ciclo completo, com tolerancia a falhas de rede.
 *
 * Coalescido por um mutex de módulo: se um ciclo já está em andamento, novas
 * chamadas (evento `online`, postMessage do SW, botão, várias abas) reaproveitam
 * o mesmo Promise em vez de empilhar requisições. Isso, somado a NÃO reagendar
 * o Background Sync ao fim de cada ciclo (ver wizard), evita o loop de
 * sincronização que inundava o servidor com chamadas a /sync/cadastros.
 */
let cicloEmAndamento = null;

export async function sincronizar() {
    if (cicloEmAndamento) return cicloEmAndamento;
    cicloEmAndamento = (async () => {
        try {
            const resumoPush = await push();
            const recebidos = await pull();
            const fotos = await pushAnexos(); // só sobem após os cadastros existirem no servidor
            return { ok: true, push: resumoPush, pull: recebidos, fotos };
        } catch (e) {
            console.warn('Sincronizacao adiada:', e.message);
            return { ok: false, erro: e.message };
        }
    })();
    try {
        return await cicloEmAndamento;
    } finally {
        cicloEmAndamento = null;
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
