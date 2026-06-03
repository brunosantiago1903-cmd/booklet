// Controlador Alpine do Wizard de coleta offline-first.
//
// Empacotado pelo Vite (idb/uuid resolvidos do node_modules) — sem CDNs, para
// funcionar de fato offline. Trabalha 100% offline: cada passo persiste no
// IndexedDB e o botão "Sincronizar" envia a fila quando há conexão.

import { v4 as uuidv4 } from 'uuid';
import { salvarCadastroLocal, listarPendentes, setMeta, salvarFotoLocal, contarFotos, removerFotoLocal } from '../offline/db.js';
import { sincronizar, registrarBackgroundSync } from '../offline/sync.js';

function cadastroVazio() {
    return {
        client_uuid: uuidv4(),
        updated_at_client: new Date().toISOString(),
        // Identificacao
        areas_atencao: [],
        nome_familia: '',
        cep: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        padrao_construtivo: '',
        telefone_fixo: '',
        telefone_celular: '',
        tipo_residencia: '',
        precisa_abrigo: null,
        moradores_encontrados: null,
        qtd_pessoas_domicilio: null,
        renda_domiciliar: null,
        latitude: null,
        longitude: null,
        precisao_gps_m: null,
        coletado_em: new Date().toISOString(),
        // Filhos
        habitantes: [],
        historico_riscos: [],
        programas_sociais: [],
        vulnerabilidade_saude: {
            possui_necessidades_especiais: null, necessidades_especiais: '',
            necessita_medicacao: null, medicacao_qual: '', restricao_medicamento: '',
            doenca_cronica: null, doenca_cronica_qual: '', alergias: '',
            animais_caes: 0, animais_gatos: 0, animais_aves: 0, animais_outros: '',
        },
        infraestrutura: {
            captacao_agua: '', captacao_agua_outro: '', poco_nascente_localizacao: '',
            poco_profundidade_m: null, coleta_lixo: null, lixo_organico_destino: '',
            lixo_reciclavel_destino: '', conhece_associacoes_reciclaveis: null,
            associacao_reciclavel_qual: '', coleta_seletiva_proxima: null,
            observacoes_residuos: '', saneamento_tipo: '', saneamento_qual: '',
            saneamento_localizacao: '',
        },
        risco_ambiental: {
            potencialmente_inundavel: null, escoamento_propriedade: '', escoamento_rua: null,
            escoamento_rua_descricao: '', acumulo_agua: null, acumulo_agua_onde: '',
            historico_deslizamento: null, historico_deslizamento_descricao: '',
            risco_deslizamento_atual: null, risco_deslizamento_observacoes: '',
            relevo_descricao: '', solo_exposto: null, solo_exposto_observacoes: '',
            erosao_expressiva: null, erosao_expressiva_observacoes: '',
            rio_passa_propriedade: null, rio_nome: '', rio_largura: '', mata_ciliar: '',
            mata_ciliar_observacoes: '', erosao_beira_rio: null,
            erosao_beira_rio_observacoes: '', rio_assoreado: null,
        },
        agricultura: {
            tamanho_propriedade: '', areas_plantio: '', culturas: '', tipo_cultivo: '',
            renda_media: null, pessoas_trabalham: null, equipamentos_maquinarios: '',
            barracao_proprio: null, sistema_irrigacao: null, observacao: '',
        },
        // Preparacao
        cadastrado_alertas: null,
        percepcao_risco: '',
        acao_risco_iminente: '',
        medidas_sugeridas: '',
    };
}

export function wizard(config = {}) {
    return {
        passo: 1,
        totalPassos: 7,
        salvando: false,
        online: navigator.onLine,
        pendentes: 0,
        statusSync: '',
        form: cadastroVazio(),
        fotosCount: 0,
        fotos: [], // prévia reativa: { client_uuid, categoria, url }
        coordsTexto: '',

        // Avaliacao de risco do passo "Riscos" -> vira um historico_riscos.
        avaliacao: { tipo_evento: 'deslizamento', criticidade: 'sem_risco' },

        async init() {
            // Guarda token e device_id para o sync (injetados pela view).
            if (config.token) await setMeta('api_token', config.token);
            if (config.deviceId) await setMeta('device_id', config.deviceId);
            window.addEventListener('online', () => { this.online = true; this.sincronizar(); });
            window.addEventListener('offline', () => { this.online = false; });
            navigator.serviceWorker?.addEventListener?.('message', (e) => {
                if (e.data?.tipo === 'EXECUTAR_SYNC') this.sincronizar();
            });
            // Agenda o Background Sync UMA vez (retoma a fila se o app for
            // reaberto com conexão). Não reagendamos a cada ciclo: isso criava
            // um loop (sync → registra → evento sync → postMessage → sync …)
            // que inundava o servidor de requisições.
            registrarBackgroundSync().catch(() => {});
            await this.atualizarPendentes();
        },

        proximo() { if (this.passo < this.totalPassos) this.passo++; },
        anterior() { if (this.passo > 1) this.passo--; },

        toggleArea(area) {
            const i = this.form.areas_atencao.indexOf(area);
            i === -1 ? this.form.areas_atencao.push(area) : this.form.areas_atencao.splice(i, 1);
        },

        addHabitante() {
            this.form.habitantes.push({
                client_uuid: uuidv4(), nome_completo: '', cpf: '', data_nascimento: '',
                sexo: '', celular: '', tipo_sanguineo: '', escolaridade_nivel: '',
                escolaridade_situacao: '', trabalha: null, trabalho_tipo: '',
                deslocamento_meio: '', deslocamento_tempo: '', responsavel_familiar: false,
            });
        },
        removerHabitante(i) { this.form.habitantes.splice(i, 1); },

        togglePrograma(slug) {
            const i = this.form.programas_sociais.indexOf(slug);
            i === -1 ? this.form.programas_sociais.push(slug) : this.form.programas_sociais.splice(i, 1);
        },

        // Captura fotos (file input), comprime, guarda no IndexedDB e exibe a
        // prévia imediatamente (miniatura) vinculada ao cadastro.
        async adicionarFotos(categoria, fileList) {
            for (const file of Array.from(fileList || [])) {
                const blob = await this.comprimirImagem(file);
                const client_uuid = uuidv4();
                await salvarFotoLocal({
                    client_uuid,
                    cadastro_uuid: this.form.client_uuid,
                    categoria,
                    blob,
                    latitude: this.form.latitude,
                    longitude: this.form.longitude,
                });
                this.fotos.push({ client_uuid, categoria, url: URL.createObjectURL(blob) });
            }
            this.fotosCount = await contarFotos(this.form.client_uuid);
        },

        // Remove uma foto (da prévia e do IndexedDB) antes de sincronizar.
        async removerFoto(clientUuid) {
            const i = this.fotos.findIndex((f) => f.client_uuid === clientUuid);
            if (i !== -1) {
                URL.revokeObjectURL(this.fotos[i].url);
                this.fotos.splice(i, 1);
            }
            await removerFotoLocal(clientUuid);
            this.fotosCount = await contarFotos(this.form.client_uuid);
        },

        // Libera as URLs de prévia ao trocar de cadastro.
        limparFotosPreview() {
            this.fotos.forEach((f) => URL.revokeObjectURL(f.url));
            this.fotos = [];
        },

        // Redimensiona/comprime a imagem (máx. ~1600px, JPEG ~0.7) para caber no
        // limite de upload e acelerar a sincronização no 4G. Se algo falhar,
        // mantém o arquivo original.
        comprimirImagem(file) {
            return new Promise((resolve) => {
                if (!file.type?.startsWith('image/')) { resolve(file); return; }
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    const max = 1600;
                    const escala = Math.min(1, max / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * escala);
                    canvas.height = Math.round(img.height * escala);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(
                        (blob) => resolve(blob || file),
                        'image/jpeg',
                        0.7,
                    );
                };
                img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
                img.src = url;
            });
        },

        capturarGPS() {
            if (!window.isSecureContext) {
                alert('O GPS do navegador só funciona em HTTPS (contexto seguro) ou em localhost. '
                    + 'Neste acesso por IP (http), informe a latitude/longitude manualmente — '
                    + 'ou publique o sistema via HTTPS (ex.: Cloudflare Tunnel).');
                return;
            }
            if (!navigator.geolocation) { alert('GPS indisponível neste dispositivo.'); return; }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.form.latitude = +pos.coords.latitude.toFixed(7);
                    this.form.longitude = +pos.coords.longitude.toFixed(7);
                    this.form.precisao_gps_m = Math.round(pos.coords.accuracy);
                },
                (err) => alert('Não foi possível obter a localização (' + err.message + '). '
                    + 'Você pode informar lat/long manualmente.'),
                { enableHighAccuracy: true, timeout: 10000 },
            );
        },

        // Aceita vários formatos: par decimal, DMS e link do Google Maps.
        parseCoordenadas(texto) {
            if (!texto) return null;
            const t = texto.trim();

            // 1) URL do Google Maps: @lat,lng  ou  q=/ll=/destination=lat,lng
            const url = t.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
                || t.match(/[?&](?:q|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
            if (url) return { lat: parseFloat(url[1]), lon: parseFloat(url[2]) };

            // 2) DMS: 25°28'36.1"S 48°50'03.8"W
            const dms = [...t.matchAll(/(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*([\d.]+)?\s*["″]?\s*([NSEWLOnsewlo])/g)];
            if (dms.length >= 2) {
                const toDec = (m) => {
                    let d = parseInt(m[1], 10) + parseInt(m[2], 10) / 60 + parseFloat(m[3] || '0') / 3600;
                    const h = m[4].toUpperCase();
                    if (h === 'S' || h === 'W' || h === 'O') d = -d;
                    return d;
                };
                let lat = null; let lon = null;
                for (const m of dms) {
                    const h = m[4].toUpperCase();
                    if (h === 'N' || h === 'S') lat = toDec(m);
                    else lon = toDec(m);
                }
                if (lat !== null && lon !== null) return { lat, lon };
            }

            // 3) Par decimal: -25.4767, -48.8344  (vírgula, ponto-e-vírgula ou espaço)
            const dec = t.match(/(-?\d{1,3}(?:\.\d+)?)\s*[,;]?\s+(-?\d{1,3}(?:\.\d+)?)/)
                || t.match(/(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/);
            if (dec) return { lat: parseFloat(dec[1]), lon: parseFloat(dec[2]) };

            return null;
        },

        aplicarCoordenadas() {
            const r = this.parseCoordenadas(this.coordsTexto);
            if (!r || Number.isNaN(r.lat) || Number.isNaN(r.lon)
                || Math.abs(r.lat) > 90 || Math.abs(r.lon) > 180) {
                alert('Não reconheci as coordenadas. Use "-25.4767, -48.8344", DMS '
                    + '(25°28\'36"S 48°50\'03"W) ou um link do Google Maps.');
                return;
            }
            this.form.latitude = +r.lat.toFixed(7);
            this.form.longitude = +r.lon.toFixed(7);
            this.coordsTexto = '';
        },

        // Consolida a avaliacao de risco como item do historico.
        aplicarAvaliacao() {
            this.form.historico_riscos = [{
                client_uuid: uuidv4(),
                tipo_evento: this.avaliacao.tipo_evento,
                criticidade: this.avaliacao.criticidade,
                avaliado_em: new Date().toISOString(),
                latitude: this.form.latitude,
                longitude: this.form.longitude,
            }];
        },

        async salvarRascunho() {
            this.salvando = true;
            this.form.updated_at_client = new Date().toISOString();
            await salvarCadastroLocal(JSON.parse(JSON.stringify(this.form)));
            this.salvando = false;
            await this.atualizarPendentes();
        },

        async finalizar() {
            if (!this.form.nome_familia || this.form.latitude === null) {
                alert('Preencha o nome da família e capture as coordenadas (GPS).');
                return;
            }
            this.aplicarAvaliacao();
            await this.salvarRascunho();
            const r = await this.sincronizar();
            this.statusSync = r.ok
                ? `Cadastro salvo e sincronizado (${this.resumoSync(r)}).`
                : `Cadastro salvo no dispositivo — ${r.erro || 'será enviado ao reconectar'}.`;
            this.limparFotosPreview();
            this.form = cadastroVazio();
            this.passo = 1;
            this.fotosCount = 0;
        },

        async sincronizar() {
            this.statusSync = 'Sincronizando…';
            const r = await sincronizar();
            await this.atualizarPendentes();
            this.statusSync = this.resumoSync(r);
            registrarBackgroundSync().catch(() => {});
            return r;
        },

        // Monta uma mensagem clara do que aconteceu no ciclo de sincronizacao.
        resumoSync(r) {
            if (!r.ok) {
                return r.erro
                    ? `Não foi possível sincronizar — ${r.erro}`
                    : 'Aguardando conexão…';
            }
            const p = r.push || {};
            const enviados = (p.criados || 0) + (p.atualizados || 0);
            const partes = [`${enviados} enviado(s)`];
            if (p.erros) partes.push(`${p.erros} com erro (finalize os rascunhos incompletos)`);
            if (r.fotos) partes.push(`${r.fotos} foto(s)`);
            return partes.join(' · ');
        },

        async atualizarPendentes() {
            this.pendentes = (await listarPendentes()).length;
        },
    };
}
