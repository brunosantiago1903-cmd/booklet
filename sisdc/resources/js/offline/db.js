// Camada de persistencia offline do PWA (IndexedDB via biblioteca `idb`).
//
//   npm i idb uuid
//
// Modelo de dados local (espelha as tabelas do servidor, porem desnormalizado
// por cadastro para facilitar o envio em lote e o trabalho 100% offline):
//
//   cadastros  -> documento completo do domicilio (com habitantes,
//                 historico_riscos e blocos 1:1 aninhados).
//   outbox     -> fila de itens pendentes de sincronizacao (push).
//   anexos     -> fotos (Blob) aguardando upload.
//   meta       -> metadados (ex.: ultimo pull, device_id).

import { openDB } from 'idb';

const DB_NAME = 'sisdc-morretes';
const DB_VERSION = 1;

export const dbReady = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('cadastros')) {
            const store = db.createObjectStore('cadastros', { keyPath: 'client_uuid' });
            store.createIndex('status', 'sync_status');
            store.createIndex('updated_at_client', 'updated_at_client');
        }
        if (!db.objectStoreNames.contains('outbox')) {
            db.createObjectStore('outbox', { keyPath: 'client_uuid' });
        }
        if (!db.objectStoreNames.contains('anexos')) {
            const store = db.createObjectStore('anexos', { keyPath: 'client_uuid' });
            store.createIndex('cadastro_uuid', 'cadastro_uuid');
        }
        if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'chave' });
        }
    },
});

/**
 * Salva/atualiza um cadastro localmente e o enfileira para sincronizacao.
 * Chamado a cada passo concluido do formulario Wizard (rascunho resiliente).
 */
export async function salvarCadastroLocal(cadastro) {
    const db = await dbReady;
    cadastro.updated_at_client = new Date().toISOString();
    cadastro.sync_status = 'pendente';

    const tx = db.transaction(['cadastros', 'outbox'], 'readwrite');
    await tx.objectStore('cadastros').put(cadastro);
    await tx.objectStore('outbox').put({
        client_uuid: cadastro.client_uuid,
        updated_at_client: cadastro.updated_at_client,
    });
    await tx.done;
    return cadastro.client_uuid;
}

/** Retorna os cadastros ainda nao confirmados pelo servidor. */
export async function listarPendentes() {
    const db = await dbReady;
    const pendentes = await db.getAll('outbox');
    return Promise.all(pendentes.map((p) => db.get('cadastros', p.client_uuid)));
}

/** Carrega um cadastro local pelo client_uuid (para reabrir e editar). */
export async function getCadastroLocal(clientUuid) {
    const db = await dbReady;
    return db.get('cadastros', clientUuid);
}

/** Remove um cadastro local por completo (cadastro + outbox + fotos). */
export async function removerCadastroLocal(clientUuid) {
    const db = await dbReady;
    const fotos = await db.getAllFromIndex('anexos', 'cadastro_uuid', clientUuid);
    const tx = db.transaction(['cadastros', 'outbox', 'anexos'], 'readwrite');
    await tx.objectStore('cadastros').delete(clientUuid);
    await tx.objectStore('outbox').delete(clientUuid);
    for (const f of fotos) await tx.objectStore('anexos').delete(f.client_uuid);
    await tx.done;
}

/** Marca um cadastro como sincronizado e o remove da outbox. */
export async function confirmarSincronizado(clientUuid, serverData = {}) {
    const db = await dbReady;
    const tx = db.transaction(['cadastros', 'outbox'], 'readwrite');
    const atual = await tx.objectStore('cadastros').get(clientUuid);
    if (atual) {
        atual.sync_status = 'sincronizado';
        atual.server_id = serverData.id ?? atual.server_id;
        atual.status_servidor = serverData.status ?? atual.status_servidor;
        await tx.objectStore('cadastros').put(atual);
    }
    await tx.objectStore('outbox').delete(clientUuid);
    await tx.done;
}

// ---- Fotos / anexos -------------------------------------------------------

/** Salva uma foto (Blob) no IndexedDB, vinculada ao cadastro, aguardando upload. */
export async function salvarFotoLocal({ client_uuid, cadastro_uuid, categoria, blob, latitude, longitude }) {
    const db = await dbReady;
    await db.put('anexos', {
        client_uuid,
        cadastro_uuid,
        categoria,
        blob,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        capturado_em: new Date().toISOString(),
        uploaded: false,
    });
}

/** Lista as fotos ainda não enviadas. */
export async function listarFotosPendentes() {
    const db = await dbReady;
    return (await db.getAll('anexos')).filter((a) => !a.uploaded);
}

/** Conta as fotos de um cadastro por categoria. */
export async function contarFotos(cadastroUuid) {
    const db = await dbReady;
    const todas = await db.getAllFromIndex('anexos', 'cadastro_uuid', cadastroUuid);
    return todas.length;
}

/** Remove uma foto do armazenamento local (antes do envio). */
export async function removerFotoLocal(clientUuid) {
    const db = await dbReady;
    await db.delete('anexos', clientUuid);
}

/** Marca uma foto como enviada. */
export async function confirmarFotoEnviada(clientUuid) {
    const db = await dbReady;
    const a = await db.get('anexos', clientUuid);
    if (a) {
        a.uploaded = true;
        await db.put('anexos', a);
    }
}

export async function getMeta(chave, padrao = null) {
    const db = await dbReady;
    return (await db.get('meta', chave))?.valor ?? padrao;
}

export async function setMeta(chave, valor) {
    const db = await dbReady;
    await db.put('meta', { chave, valor });
}
