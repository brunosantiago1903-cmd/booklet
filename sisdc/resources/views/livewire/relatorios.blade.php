<div class="space-y-4">
    <div class="flex items-center gap-3 flex-wrap">
        <h1 class="text-xl font-semibold">Relatórios</h1>
        <div class="ml-auto flex gap-2">
            <a href="{{ route('export.lista.xlsx') }}?{{ $queryExport }}"
               class="text-sm px-3 py-1.5 rounded bg-green-700 text-white">Exportar Excel</a>
            <a href="{{ route('export.lista.pdf') }}?{{ $queryExport }}&agrupar=bairro" target="_blank"
               class="text-sm px-3 py-1.5 rounded border hover:bg-slate-50">PDF por bairro</a>
            <a href="{{ route('export.lista.pdf') }}?{{ $queryExport }}&agrupar=criticidade" target="_blank"
               class="text-sm px-3 py-1.5 rounded border hover:bg-slate-50">PDF por risco</a>
        </div>
    </div>

    {{-- Filtros --}}
    <div class="bg-white rounded-xl shadow p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <label>Status
            <select wire:model.live="status" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                <option value="">Todos</option>
                @foreach ($statuses as $s)<option value="{{ $s->value }}">{{ $s->label() }}</option>@endforeach
            </select>
        </label>
        <label>Área de atenção
            <select wire:model.live="area_atencao" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                <option value="">Todas</option>
                @foreach ($areas as $a)<option value="{{ $a->value }}">{{ $a->label() }}</option>@endforeach
            </select>
        </label>
        <label>Operador (quem coletou)
            <select wire:model.live="operador" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                <option value="">Todos</option>
                @foreach ($operadoresDisponiveis as $id => $nome)<option value="{{ $id }}">{{ $nome }}</option>@endforeach
            </select>
        </label>
        <label>Busca
            <input wire:model.live.debounce.400ms="busca" placeholder="Família, SISDC, bairro…" class="mt-0.5 w-full rounded border-slate-300 text-sm">
        </label>
        <div class="col-span-2">
            <span class="block">Situação de risco (criticidade)</span>
            <div class="flex flex-wrap gap-2 mt-1">
                @foreach ($criticidades as $c)
                    <label class="flex items-center gap-1">
                        <input type="checkbox" value="{{ $c->value }}" wire:model.live="criticidade">
                        <span class="inline-block w-2.5 h-2.5 rounded-full" style="background: {{ $c->color() }}"></span>{{ $c->label() }}
                    </label>
                @endforeach
            </div>
        </div>
        <div class="col-span-2">
            <span class="block">Bairros</span>
            <div class="flex flex-wrap gap-2 mt-1 max-h-24 overflow-auto">
                @forelse ($bairrosDisponiveis as $b)
                    <label class="flex items-center gap-1"><input type="checkbox" value="{{ $b }}" wire:model.live="bairro"> {{ $b }}</label>
                @empty
                    <span class="text-slate-400">Nenhum bairro cadastrado.</span>
                @endforelse
            </div>
        </div>
        <div class="col-span-full">
            <button wire:click="limpar" class="text-sm text-slate-500 hover:underline">Limpar filtros</button>
        </div>
    </div>

    {{-- Resumos --}}
    <div class="grid md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow p-4">
            <h2 class="font-semibold mb-2">Por situação de risco</h2>
            <table class="w-full text-sm">
                @foreach ($criticidades as $c)
                    <tr class="border-b border-slate-100">
                        <td class="py-1"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1" style="background: {{ $c->color() }}"></span>{{ $c->label() }}</td>
                        <td class="py-1 text-right font-medium">{{ $resumoCriticidade[$c->value] }}</td>
                    </tr>
                @endforeach
            </table>
            <h3 class="font-medium mt-3 mb-1 text-sm">Por área de atenção</h3>
            <table class="w-full text-sm">
                @foreach ($areas as $a)
                    <tr class="border-b border-slate-100"><td class="py-1">{{ $a->label() }}</td><td class="py-1 text-right">{{ $resumoArea[$a->value] }}</td></tr>
                @endforeach
            </table>
        </div>
        <div class="bg-white rounded-xl shadow p-4">
            <h2 class="font-semibold mb-2">Por bairro</h2>
            <table class="w-full text-sm">
                <thead><tr class="text-slate-500 text-left"><th class="py-1">Bairro</th><th class="text-right">Cadastros</th><th class="text-right">Pessoas</th><th class="text-right">Alto/Muito alto</th></tr></thead>
                <tbody>
                    @forelse ($resumoBairro as $bairro => $r)
                        <tr class="border-b border-slate-100">
                            <td class="py-1">{{ $bairro }}</td>
                            <td class="py-1 text-right">{{ $r['cadastros'] }}</td>
                            <td class="py-1 text-right">{{ $r['pessoas'] }}</td>
                            <td class="py-1 text-right font-medium text-red-700">{{ $r['criticos'] }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="py-2 text-slate-400">Nenhum cadastro no filtro.</td></tr>
                    @endforelse
                </tbody>
            </table>
            <h3 class="font-medium mt-3 mb-1 text-sm">Por operador (quem coletou)</h3>
            <table class="w-full text-sm">
                <thead><tr class="text-slate-500 text-left"><th class="py-1">Operador</th><th class="text-right">Cadastros</th><th class="text-right">Pessoas</th></tr></thead>
                <tbody>
                    @forelse ($resumoOperador as $nome => $r)
                        <tr class="border-b border-slate-100">
                            <td class="py-1">{{ $nome }}</td>
                            <td class="py-1 text-right">{{ $r['cadastros'] }}</td>
                            <td class="py-1 text-right">{{ $r['pessoas'] }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="3" class="py-2 text-slate-400">—</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    {{-- Lista --}}
    <div class="bg-white rounded-xl shadow overflow-hidden">
        <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-500 text-left">
                <tr><th class="p-2">Família</th><th class="p-2">Bairro</th><th class="p-2">Criticidade</th><th class="p-2">Operador</th><th class="p-2">Status</th><th class="p-2">Pessoas</th><th class="p-2 text-right">PDF</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse ($cadastros as $c)
                    <tr>
                        <td class="p-2 font-medium">{{ $c->nome_familia }}</td>
                        <td class="p-2">{{ $c->bairro }}</td>
                        <td class="p-2"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1" style="background: {{ $c->criticidade_atual->color() }}"></span>{{ $c->criticidade_atual->label() }}</td>
                        <td class="p-2">{{ $c->operador?->name ?? '—' }}</td>
                        <td class="p-2">{{ $c->status->label() }}</td>
                        <td class="p-2">{{ $c->habitantes_count }}</td>
                        <td class="p-2 text-right"><a href="{{ route('export.cadastro.pdf', $c) }}" target="_blank" class="text-slate-700 hover:underline">PDF</a></td>
                    </tr>
                @empty
                    <tr><td colspan="7" class="p-4 text-center text-slate-400">Nenhum cadastro encontrado.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>
