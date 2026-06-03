<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use App\Enums\AreaAtencao;
use App\Enums\Criticidade;
use App\Enums\PadraoConstrutivo;
use App\Enums\TipoResidencia;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Valida o lote de cadastros enviado pelo PWA na sincronizacao.
 *
 * Estrutura esperada (JSON):
 * {
 *   "batch_uuid": "uuid",
 *   "device_id": "tablet-defesa-01",
 *   "cadastros": [ { ...cadastro..., "habitantes": [...], "historico_riscos": [...] } ]
 * }
 */
class SyncCadastrosRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Apenas operadores/admin podem enviar dados de campo.
        return (bool) $this->user()?->role?->canSync();
    }

    public function rules(): array
    {
        return [
            'batch_uuid' => ['required', 'uuid'],
            'device_id' => ['nullable', 'string', 'max:120'],

            'cadastros' => ['required', 'array', 'min:1', 'max:200'],

            // Idempotencia: client_uuid identifica unicamente o registro offline.
            'cadastros.*.client_uuid' => ['required', 'uuid'],
            'cadastros.*.updated_at_client' => ['required', 'date'],
            'cadastros.*.codigo_sisdc' => ['nullable', 'string', 'max:60'],
            'cadastros.*.codigo_interno' => ['nullable', 'string', 'max:60'],
            'cadastros.*.areas_atencao' => ['nullable', 'array'],
            'cadastros.*.areas_atencao.*' => [Rule::enum(AreaAtencao::class)],
            // nome_familia e validado por item no servico (rascunho incompleto
            // vira acao:'erro' sem derrubar o lote inteiro).
            'cadastros.*.nome_familia' => ['nullable', 'string', 'max:255'],
            'cadastros.*.cep' => ['nullable', 'string', 'max:9'],
            'cadastros.*.endereco' => ['nullable', 'string', 'max:255'],
            'cadastros.*.numero' => ['nullable', 'string', 'max:20'],
            'cadastros.*.complemento' => ['nullable', 'string', 'max:255'],
            'cadastros.*.bairro' => ['nullable', 'string', 'max:255'],
            'cadastros.*.padrao_construtivo' => ['nullable', Rule::enum(PadraoConstrutivo::class)],
            'cadastros.*.telefone_fixo' => ['nullable', 'string', 'max:20'],
            'cadastros.*.telefone_celular' => ['nullable', 'string', 'max:20'],

            // Coordenadas: opcionais (rascunho ainda sem GPS sincroniza mesmo
            // assim; sem coordenada o ponto so nao aparece no mapa). Quando
            // presentes, precisam estar dentro das faixas validas (sanidade).
            'cadastros.*.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'cadastros.*.longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'cadastros.*.precisao_gps_m' => ['nullable', 'numeric', 'min:0'],

            'cadastros.*.tipo_residencia' => ['nullable', Rule::enum(TipoResidencia::class)],
            'cadastros.*.precisa_abrigo' => ['nullable', 'boolean'],
            'cadastros.*.moradores_encontrados' => ['nullable', 'boolean'],
            'cadastros.*.qtd_pessoas_domicilio' => ['nullable', 'integer', 'min:0'],
            'cadastros.*.renda_domiciliar' => ['nullable', 'numeric', 'min:0'],
            'cadastros.*.coletado_em' => ['nullable', 'date'],

            // Habitantes (relacao 1:N).
            'cadastros.*.habitantes' => ['nullable', 'array'],
            'cadastros.*.habitantes.*.client_uuid' => ['required', 'uuid'],
            'cadastros.*.habitantes.*.nome_completo' => ['required', 'string', 'max:255'],
            'cadastros.*.habitantes.*.cpf' => ['nullable', 'string', 'max:14'],
            'cadastros.*.habitantes.*.data_nascimento' => ['nullable', 'date'],
            'cadastros.*.habitantes.*.sexo' => ['nullable', 'string', 'max:20'],
            'cadastros.*.habitantes.*.celular' => ['nullable', 'string', 'max:20'],
            'cadastros.*.habitantes.*.tipo_sanguineo' => ['nullable', 'string', 'max:5'],
            'cadastros.*.habitantes.*.escolaridade_nivel' => ['nullable', 'string', 'max:10'],
            'cadastros.*.habitantes.*.escolaridade_situacao' => ['nullable', 'string', 'max:12'],
            'cadastros.*.habitantes.*.trabalha' => ['nullable', 'boolean'],
            'cadastros.*.habitantes.*.trabalho_tipo' => ['nullable', 'string', 'max:12'],
            'cadastros.*.habitantes.*.deslocamento_meio' => ['nullable', 'string', 'max:255'],
            'cadastros.*.habitantes.*.deslocamento_tempo' => ['nullable', 'string', 'max:255'],
            'cadastros.*.habitantes.*.responsavel_familiar' => ['nullable', 'boolean'],

            // Historico de risco (relacao 1:N).
            'cadastros.*.historico_riscos' => ['nullable', 'array'],
            'cadastros.*.historico_riscos.*.client_uuid' => ['required', 'uuid'],
            'cadastros.*.historico_riscos.*.tipo_evento' => ['required', Rule::enum(AreaAtencao::class)],
            'cadastros.*.historico_riscos.*.criticidade' => ['required', Rule::enum(Criticidade::class)],
            'cadastros.*.historico_riscos.*.descricao' => ['nullable', 'string'],
            'cadastros.*.historico_riscos.*.avaliado_em' => ['required', 'date'],
            'cadastros.*.historico_riscos.*.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'cadastros.*.historico_riscos.*.longitude' => ['nullable', 'numeric', 'between:-180,180'],

            // Blocos 1:1 (validados de forma permissiva; detalhamento textual).
            'cadastros.*.vulnerabilidade_saude' => ['nullable', 'array'],
            'cadastros.*.infraestrutura' => ['nullable', 'array'],
            'cadastros.*.risco_ambiental' => ['nullable', 'array'],
            'cadastros.*.agricultura' => ['nullable', 'array'],

            // Programas sociais (N:N) - lista de slugs.
            'cadastros.*.programas_sociais' => ['nullable', 'array'],
            'cadastros.*.programas_sociais.*' => ['string', 'max:120'],
        ];
    }
}
