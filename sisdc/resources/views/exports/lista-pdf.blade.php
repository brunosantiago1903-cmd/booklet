<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
    * { font-family: DejaVu Sans, sans-serif; }
    body { font-size: 10px; color: #1f2937; }
    h1 { font-size: 15px; margin: 0 0 2px; }
    h2 { font-size: 12px; background: #0f172a; color: #fff; padding: 3px 6px; margin: 10px 0 3px; }
    .muted { color: #6b7280; font-size: 9px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #d1d5db; padding: 3px 5px; }
    th { background: #f3f4f6; text-align: left; }
    .pill { display: inline-block; padding: 0 5px; border-radius: 8px; color: #fff; font-size: 9px; }
</style>
</head>
<body>
    <h1>Relatório de cadastros — Defesa Civil de Morretes</h1>
    <div class="muted">
        Total: {{ $total }} cadastro(s){{ $agrupar ? ' · agrupado por '.$agrupar : '' }} · Emitido em {{ now()->format('d/m/Y H:i') }}
    </div>

    @foreach ($grupos as $titulo => $itens)
        @if ($agrupar)
            <h2>{{ $titulo }} ({{ $itens->count() }})</h2>
        @endif
        <table>
            <tr>
                <th>SISDC</th><th>Família</th><th>Bairro</th><th>Criticidade</th>
                <th>Status</th><th>Pessoas</th><th>Abrigo</th><th>Áreas</th>
            </tr>
            @foreach ($itens as $c)
                <tr>
                    <td>{{ $c->codigo_sisdc ?? '—' }}</td>
                    <td>{{ $c->nome_familia }}</td>
                    <td>{{ $c->bairro }}</td>
                    <td><span class="pill" style="background: {{ $c->criticidade_atual->color() }}">{{ $c->criticidade_atual->label() }}</span></td>
                    <td>{{ $c->status->label() }}</td>
                    <td>{{ $c->habitantes()->count() }}</td>
                    <td>{{ $c->precisa_abrigo ? 'Sim' : 'Não' }}</td>
                    <td>{{ collect($c->areas_atencao ?? [])->implode(', ') }}</td>
                </tr>
            @endforeach
        </table>
    @endforeach
</body>
</html>
