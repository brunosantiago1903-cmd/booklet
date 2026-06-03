<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
    * { font-family: DejaVu Sans, sans-serif; }
    body { font-size: 11px; color: #1f2937; }
    h1 { font-size: 16px; margin: 0 0 2px; }
    h2 { font-size: 12px; background: #0f172a; color: #fff; padding: 4px 6px; margin: 12px 0 4px; }
    .muted { color: #6b7280; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #d1d5db; padding: 3px 5px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    .grid td { width: 50%; }
    .pill { display: inline-block; padding: 1px 6px; border-radius: 8px; color: #fff; font-size: 10px; }
    .fotos img { width: 150px; height: 110px; object-fit: cover; border: 1px solid #d1d5db; margin: 2px; }
</style>
</head>
<body>
    <h1>Análise de risco e vulnerabilidade socioambiental — Morretes/PR</h1>
    <div class="muted">
        Cadastro #{{ $cadastro->id }} · SISDC: {{ $cadastro->codigo_sisdc ?? '—' }} ·
        Status: {{ $cadastro->status->label() }} ·
        Criticidade: <span class="pill" style="background: {{ $cadastro->criticidade_atual->color() }}">{{ $cadastro->criticidade_atual->label() }}</span>
        · Emitido em {{ now()->format('d/m/Y H:i') }}
    </div>

    <h2>Identificação e endereço</h2>
    <table class="grid">
        <tr><td><b>Família:</b> {{ $cadastro->nome_familia }}</td><td><b>Telefone:</b> {{ $cadastro->telefone_celular ?: $cadastro->telefone_fixo ?: '—' }}</td></tr>
        <tr><td><b>Endereço:</b> {{ $cadastro->endereco }} {{ $cadastro->numero }}</td><td><b>Bairro:</b> {{ $cadastro->bairro }}</td></tr>
        <tr><td><b>CEP:</b> {{ $cadastro->cep ?? '—' }} · <b>Complemento:</b> {{ $cadastro->complemento ?? '—' }}</td><td><b>Padrão construtivo:</b> {{ $cadastro->padrao_construtivo?->label() ?? '—' }}</td></tr>
        <tr><td><b>Coordenadas:</b> {{ $cadastro->latitude }}, {{ $cadastro->longitude }}</td><td><b>Tipo de residência:</b> {{ $cadastro->tipo_residencia?->label() ?? '—' }}</td></tr>
        <tr><td><b>Áreas de atenção:</b> {{ collect($cadastro->areas_atencao ?? [])->implode(', ') ?: '—' }}</td><td><b>Precisa de abrigo:</b> {{ $cadastro->precisa_abrigo ? 'Sim' : 'Não' }}</td></tr>
    </table>

    <h2>Habitantes ({{ $cadastro->habitantes->count() }})</h2>
    <table>
        <tr><th>Nome</th><th>CPF</th><th>Nasc.</th><th>Sexo</th><th>Escolaridade</th><th>Sangue</th></tr>
        @forelse ($cadastro->habitantes as $h)
            <tr>
                <td>{{ $h->nome_completo }}</td><td>{{ $h->cpf }}</td>
                <td>{{ $h->data_nascimento?->format('d/m/Y') }}</td><td>{{ $h->sexo }}</td>
                <td>{{ trim(($h->escolaridade_nivel ?? '').' '.($h->escolaridade_situacao ?? '')) }}</td>
                <td>{{ $h->tipo_sanguineo }}</td>
            </tr>
        @empty
            <tr><td colspan="6">Sem habitantes cadastrados.</td></tr>
        @endforelse
    </table>

    @if ($cadastro->vulnerabilidadeSaude)
        <h2>Saúde e vulnerabilidade</h2>
        @php $vs = $cadastro->vulnerabilidadeSaude; @endphp
        <table class="grid">
            <tr><td><b>Necessidades especiais (deficiência):</b> {{ is_null($vs->possui_necessidades_especiais) ? '—' : ($vs->possui_necessidades_especiais ? 'Sim' : 'Não') }} {{ $vs->necessidades_especiais ? '— '.$vs->necessidades_especiais : '' }}</td><td><b>Medicação:</b> {{ $vs->medicacao_qual ?: '—' }}</td></tr>
            <tr><td><b>Doença crônica:</b> {{ $cadastro->vulnerabilidadeSaude->doenca_cronica_qual ?: '—' }}</td><td><b>Alergias:</b> {{ $cadastro->vulnerabilidadeSaude->alergias ?: '—' }}</td></tr>
        </table>
    @endif

    @if ($cadastro->infraestrutura)
        <h2>Infraestrutura e saneamento</h2>
        <table class="grid">
            <tr><td><b>Captação de água:</b> {{ $cadastro->infraestrutura->captacao_agua ?: '—' }}</td><td><b>Saneamento:</b> {{ $cadastro->infraestrutura->saneamento_tipo ?: '—' }}</td></tr>
            <tr><td><b>Coleta de lixo:</b> {{ $cadastro->infraestrutura->coleta_lixo ? 'Sim' : 'Não' }}</td><td><b>Coleta seletiva próxima:</b> {{ $cadastro->infraestrutura->coleta_seletiva_proxima ? 'Sim' : 'Não' }}</td></tr>
        </table>
    @endif

    @if ($cadastro->riscoAmbiental)
        <h2>Riscos ambientais</h2>
        <table class="grid">
            <tr><td><b>Inundável:</b> {{ $cadastro->riscoAmbiental->potencialmente_inundavel ? 'Sim' : 'Não' }}</td><td><b>Histórico de deslizamento:</b> {{ $cadastro->riscoAmbiental->historico_deslizamento ? 'Sim' : 'Não' }}</td></tr>
            <tr><td><b>Risco de deslizamento atual:</b> {{ $cadastro->riscoAmbiental->risco_deslizamento_atual ? 'Sim' : 'Não' }}</td><td><b>Rio na propriedade:</b> {{ $cadastro->riscoAmbiental->rio_nome ?: ($cadastro->riscoAmbiental->rio_passa_propriedade ? 'Sim' : 'Não') }}</td></tr>
            <tr><td colspan="2"><b>Relevo:</b> {{ $cadastro->riscoAmbiental->relevo_descricao ?: '—' }}</td></tr>
        </table>
    @endif

    <h2>Histórico de avaliações de risco</h2>
    <table>
        <tr><th>Data</th><th>Tipo</th><th>Criticidade</th><th>Descrição</th></tr>
        @forelse ($cadastro->historicoRiscos as $r)
            <tr><td>{{ $r->avaliado_em?->format('d/m/Y') }}</td><td>{{ $r->tipo_evento->label() }}</td><td>{{ $r->criticidade->label() }}</td><td>{{ $r->descricao }}</td></tr>
        @empty
            <tr><td colspan="4">Sem avaliações registradas.</td></tr>
        @endforelse
    </table>

    <h2>Preparação</h2>
    <table>
        <tr><td><b>Cadastrado para alertas:</b> {{ $cadastro->cadastrado_alertas ? 'Sim' : 'Não' }}</td></tr>
        <tr><td><b>Percepção de risco:</b> {{ $cadastro->percepcao_risco ?: '—' }}</td></tr>
        <tr><td><b>Ação ao perceber risco:</b> {{ $cadastro->acao_risco_iminente ?: '—' }}</td></tr>
        <tr><td><b>Medidas sugeridas:</b> {{ $cadastro->medidas_sugeridas ?: '—' }}</td></tr>
    </table>

    @if ($fotos->isNotEmpty())
        <h2>Fotos</h2>
        <div class="fotos">
            @foreach ($fotos as $f)
                <img src="{{ $f['data'] }}" alt="{{ $f['categoria'] }}">
            @endforeach
        </div>
    @endif

    <p class="muted" style="margin-top:14px">
        Operador: {{ $cadastro->operador?->name ?? '—' }} ·
        Validado por: {{ $cadastro->validadoPor?->name ?? '—' }}
    </p>
</body>
</html>
