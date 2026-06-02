// Controlador Alpine do Wizard de coleta offline-first.
//
// Empacotado pelo Vite (idb/uuid resolvidos do node_modules) — sem CDNs, para
// funcionar de fato offline. Trabalha 100% offline: cada passo persiste no
// IndexedDB e o botão "Sincronizar" envia a fila quando há conexão.

import { v4 as uuidv4 } from 'uuid';
import { salvarCadastroLocal, listarPendentes, setMeta } from '../offline/db.js';
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
            necessidades_especiais: '', necessita_medicacao: null, medicacao_qual: '',
            restricao_medicamento: '', doenca_cronica: null, doenca_cronica_qual: '',
            alergias: '', animais_caes: 0, animais_gatos: 0, animais_aves: 0, animais_outros: '',
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
                ? 'Cadastro salvo e sincronizado.'
                : 'Cadastro salvo no dispositivo (será enviado ao reconectar).';
            this.form = cadastroVazio();
            this.passo = 1;
        },

        async sincronizar() {
            this.statusSync = 'Sincronizando…';
            const r = await sincronizar();
            await this.atualizarPendentes();
            this.statusSync = r.ok ? 'Sincronização concluída.' : 'Aguardando conexão…';
            registrarBackgroundSync().catch(() => {});
            return r;
        },

        async atualizarPendentes() {
            this.pendentes = (await listarPendentes()).length;
        },
    };
}
