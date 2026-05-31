<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Criticidade;
use App\Enums\StatusCadastro;
use App\Models\Cadastro;
use App\Models\SyncLog;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Processa o lote de cadastros recebido do PWA.
 *
 * Principios:
 *  - Idempotencia por `client_uuid`: reenvios (rede instavel) nao duplicam.
 *  - Last-write-wins por `updated_at_client`: se o servidor ja possui versao
 *    mais nova que a enviada, o item e ignorado (evita sobrescrever auditoria).
 *  - Atomicidade por item: cada cadastro + filhos sobe em uma transacao; o erro
 *    de um item nao derruba o lote inteiro.
 */
class CadastroSyncService
{
    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed> Resumo do processamento (por item).
     */
    public function processarLote(array $payload, User $operador): array
    {
        $resultados = [];
        $contadores = ['criados' => 0, 'atualizados' => 0, 'ignorados' => 0, 'erros' => 0];

        foreach ($payload['cadastros'] as $dados) {
            try {
                $resultado = DB::transaction(
                    fn (): array => $this->processarCadastro($dados, $operador, $payload['device_id'] ?? null)
                );
                $contadores[$resultado['acao'] === 'criado' ? 'criados'
                    : ($resultado['acao'] === 'atualizado' ? 'atualizados' : 'ignorados')]++;
                $resultados[] = $resultado;
            } catch (Throwable $e) {
                $contadores['erros']++;
                report($e);
                $resultados[] = [
                    'client_uuid' => $dados['client_uuid'] ?? null,
                    'acao' => 'erro',
                    'mensagem' => $e->getMessage(),
                ];
            }
        }

        SyncLog::create([
            'batch_uuid' => $payload['batch_uuid'],
            'user_id' => $operador->id,
            'device_id' => $payload['device_id'] ?? null,
            'total_itens' => count($payload['cadastros']),
            'itens_criados' => $contadores['criados'],
            'itens_atualizados' => $contadores['atualizados'],
            'itens_ignorados' => $contadores['ignorados'],
            'itens_com_erro' => $contadores['erros'],
            'resultado' => $resultados,
        ]);

        return [
            'batch_uuid' => $payload['batch_uuid'],
            'resumo' => $contadores,
            'itens' => $resultados,
        ];
    }

    /**
     * @param  array<string,mixed>  $dados
     * @return array<string,mixed>
     */
    private function processarCadastro(array $dados, User $operador, ?string $deviceId): array
    {
        $existente = Cadastro::query()
            ->where('client_uuid', $dados['client_uuid'])
            ->first();

        $updatedAtClient = Carbon::parse($dados['updated_at_client']);

        // Last-write-wins: ignora versoes antigas e nao mexe em itens ja validados.
        if ($existente !== null) {
            $servidorMaisNovo = $existente->updated_at !== null
                && $existente->updated_at->greaterThan($updatedAtClient);

            if ($servidorMaisNovo || $existente->status === StatusCadastro::VALIDADO) {
                return [
                    'client_uuid' => $dados['client_uuid'],
                    'acao' => 'ignorado',
                    'motivo' => $servidorMaisNovo ? 'versao_servidor_mais_nova' : 'cadastro_ja_validado',
                    'id' => $existente->id,
                ];
            }
        }

        $atributos = $this->mapearAtributosCadastro($dados, $operador, $deviceId);

        $cadastro = Cadastro::updateOrCreate(
            ['client_uuid' => $dados['client_uuid']],
            $atributos,
        );

        $this->atualizarLocalizacao($cadastro);
        $this->sincronizarHabitantes($cadastro, Arr::get($dados, 'habitantes', []));
        $this->sincronizarHistoricoRiscos($cadastro, Arr::get($dados, 'historico_riscos', []), $operador);
        $this->sincronizarBlocos1a1($cadastro, $dados);
        $this->recalcularCriticidade($cadastro);

        return [
            'client_uuid' => $dados['client_uuid'],
            'acao' => $cadastro->wasRecentlyCreated ? 'criado' : 'atualizado',
            'id' => $cadastro->id,
            'criticidade_atual' => $cadastro->criticidade_atual->value,
        ];
    }

    /**
     * @param  array<string,mixed>  $dados
     * @return array<string,mixed>
     */
    private function mapearAtributosCadastro(array $dados, User $operador, ?string $deviceId): array
    {
        return [
            'codigo_sisdc' => $dados['codigo_sisdc'] ?? null,
            'codigo_interno' => $dados['codigo_interno'] ?? null,
            'areas_atencao' => $dados['areas_atencao'] ?? null,
            'nome_familia' => $dados['nome_familia'],
            'cep' => $dados['cep'] ?? null,
            'endereco' => $dados['endereco'] ?? null,
            'numero' => $dados['numero'] ?? null,
            'complemento' => $dados['complemento'] ?? null,
            'bairro' => $dados['bairro'] ?? null,
            'padrao_construtivo' => $dados['padrao_construtivo'] ?? null,
            'telefone_fixo' => $dados['telefone_fixo'] ?? null,
            'telefone_celular' => $dados['telefone_celular'] ?? null,
            'latitude' => $dados['latitude'],
            'longitude' => $dados['longitude'],
            'precisao_gps_m' => $dados['precisao_gps_m'] ?? null,
            'tipo_residencia' => $dados['tipo_residencia'] ?? null,
            'precisa_abrigo' => $dados['precisa_abrigo'] ?? null,
            'moradores_encontrados' => $dados['moradores_encontrados'] ?? null,
            'qtd_pessoas_domicilio' => $dados['qtd_pessoas_domicilio'] ?? null,
            'renda_domiciliar' => $dados['renda_domiciliar'] ?? null,
            'percepcao_risco' => $dados['percepcao_risco'] ?? null,
            'acao_risco_iminente' => $dados['acao_risco_iminente'] ?? null,
            'cadastrado_alertas' => $dados['cadastrado_alertas'] ?? null,
            'medidas_sugeridas' => $dados['medidas_sugeridas'] ?? null,
            'status' => StatusCadastro::SINCRONIZADO->value,
            'device_id' => $deviceId,
            'operador_id' => $operador->id,
            'coletado_em' => isset($dados['coletado_em']) ? Carbon::parse($dados['coletado_em']) : null,
            'sincronizado_em' => now(),
        ];
    }

    /**
     * Preenche a coluna geography a partir de latitude/longitude.
     */
    private function atualizarLocalizacao(Cadastro $cadastro): void
    {
        DB::statement(
            'UPDATE cadastros SET localizacao = ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography WHERE id = ?',
            [$cadastro->longitude, $cadastro->latitude, $cadastro->id],
        );
    }

    /**
     * @param  array<int,array<string,mixed>>  $habitantes
     */
    private function sincronizarHabitantes(Cadastro $cadastro, array $habitantes): void
    {
        foreach ($habitantes as $h) {
            $cadastro->habitantes()->updateOrCreate(
                ['client_uuid' => $h['client_uuid']],
                Arr::only($h, [
                    'nome_completo', 'cpf', 'data_nascimento', 'sexo', 'celular',
                    'escolaridade_nivel', 'escolaridade_situacao', 'trabalha',
                    'trabalho_tipo', 'deslocamento_meio', 'deslocamento_tempo',
                    'tipo_sanguineo', 'responsavel_familiar',
                ]),
            );
        }
    }

    /**
     * @param  array<int,array<string,mixed>>  $historico
     */
    private function sincronizarHistoricoRiscos(Cadastro $cadastro, array $historico, User $operador): void
    {
        foreach ($historico as $h) {
            $registro = $cadastro->historicoRiscos()->updateOrCreate(
                ['client_uuid' => $h['client_uuid']],
                [
                    'tipo_evento' => $h['tipo_evento'],
                    'criticidade' => $h['criticidade'],
                    'descricao' => $h['descricao'] ?? null,
                    'avaliado_em' => Carbon::parse($h['avaliado_em']),
                    'latitude' => $h['latitude'] ?? null,
                    'longitude' => $h['longitude'] ?? null,
                    'registrado_por_id' => $operador->id,
                ],
            );

            if (isset($h['latitude'], $h['longitude'])) {
                DB::statement(
                    'UPDATE historico_riscos SET localizacao = ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography WHERE id = ?',
                    [$h['longitude'], $h['latitude'], $registro->id],
                );
            }
        }
    }

    /**
     * @param  array<string,mixed>  $dados
     */
    private function sincronizarBlocos1a1(Cadastro $cadastro, array $dados): void
    {
        if (is_array($vs = Arr::get($dados, 'vulnerabilidade_saude'))) {
            $cadastro->vulnerabilidadeSaude()->updateOrCreate(['cadastro_id' => $cadastro->id], $vs);
        }
        if (is_array($infra = Arr::get($dados, 'infraestrutura'))) {
            $cadastro->infraestrutura()->updateOrCreate(['cadastro_id' => $cadastro->id], $infra);
        }
        if (is_array($risco = Arr::get($dados, 'risco_ambiental'))) {
            $cadastro->riscoAmbiental()->updateOrCreate(['cadastro_id' => $cadastro->id], $risco);
        }
        if (is_array($agri = Arr::get($dados, 'agricultura'))) {
            $cadastro->agricultura()->updateOrCreate(['cadastro_id' => $cadastro->id], $agri);
        }
    }

    /**
     * Define a criticidade vigente do cadastro com base na avaliacao de risco
     * mais recente (alimenta o filtro de criticidade do mapa).
     */
    private function recalcularCriticidade(Cadastro $cadastro): void
    {
        $maisRecente = $cadastro->historicoRiscos()->first();

        $criticidade = $maisRecente?->criticidade ?? Criticidade::SEM_RISCO;

        if ($cadastro->criticidade_atual !== $criticidade) {
            $cadastro->forceFill(['criticidade_atual' => $criticidade->value])->save();
        }
    }
}
