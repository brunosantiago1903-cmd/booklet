<div class="space-y-4">
    <div class="flex items-center gap-3 flex-wrap">
        <h1 class="text-xl font-semibold">Auditoria de cadastros</h1>
        <div class="ml-auto flex items-center gap-2">
            <select wire:model.live="status" class="rounded border-slate-300 text-sm">
                <option value="">Todos os status</option>
                @foreach ($statuses as $s)
                    <option value="{{ $s->value }}">{{ $s->label() }}</option>
                @endforeach
            </select>
            <input wire:model.live.debounce.400ms="busca" type="search"
                   placeholder="Buscar família, SISDC, bairro…"
                   class="rounded border-slate-300 text-sm w-64">
        </div>
    </div>

    @if (session('ok'))
        <div class="rounded bg-green-50 text-green-700 text-sm p-3">{{ session('ok') }}</div>
    @endif

    <div class="bg-white rounded-xl shadow overflow-hidden">
        <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-500 text-left">
                <tr>
                    <th class="p-3">#</th>
                    <th class="p-3">Família</th>
                    <th class="p-3">Bairro</th>
                    <th class="p-3">Criticidade</th>
                    <th class="p-3">Pessoas</th>
                    <th class="p-3">Operador</th>
                    <th class="p-3">Status</th>
                    <th class="p-3 text-right">Ações</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse ($cadastros as $c)
                    <tr wire:key="cad-{{ $c->id }}">
                        <td class="p-3 text-slate-400">{{ $c->id }}</td>
                        <td class="p-3 font-medium">{{ $c->nome_familia }}</td>
                        <td class="p-3">{{ $c->bairro ?? '—' }}</td>
                        <td class="p-3">
                            <span class="inline-flex items-center gap-1">
                                <span class="w-2.5 h-2.5 rounded-full" style="background: {{ $c->criticidade_atual->color() }}"></span>
                                {{ $c->criticidade_atual->label() }}
                            </span>
                        </td>
                        <td class="p-3">{{ $c->habitantes_count }}</td>
                        <td class="p-3">{{ $c->operador?->name ?? '—' }}</td>
                        <td class="p-3">
                            <span @class([
                                'text-xs font-medium px-2 py-0.5 rounded',
                                'bg-amber-100 text-amber-700' => $c->status->value === 'sincronizado',
                                'bg-green-100 text-green-700' => $c->status->value === 'validado',
                                'bg-red-100 text-red-700' => $c->status->value === 'rejeitado',
                                'bg-slate-100 text-slate-600' => $c->status->value === 'rascunho',
                            ])>{{ $c->status->label() }}</span>
                        </td>
                        <td class="p-3 text-right whitespace-nowrap">
                            @if ($c->status->value !== 'validado')
                                <button wire:click="validar({{ $c->id }})"
                                        wire:confirm="Validar este cadastro e liberá-lo no mapa?"
                                        class="text-green-700 hover:underline">Validar</button>
                            @endif
                            @if ($c->status->value !== 'rejeitado')
                                <button wire:click="abrirRejeicao({{ $c->id }})"
                                        class="text-red-700 hover:underline ml-3">Rejeitar</button>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="8" class="p-6 text-center text-slate-400">Nenhum cadastro encontrado.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>

    <div>{{ $cadastros->links() }}</div>

    {{-- Modal de rejeição --}}
    @if ($rejeitandoId)
        <div class="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-3">
                <h2 class="font-semibold">Rejeitar cadastro #{{ $rejeitandoId }}</h2>
                <p class="text-sm text-slate-500">Informe o motivo (volta para correção em campo).</p>
                <textarea wire:model="motivoRejeicao" rows="3"
                          class="w-full rounded border-slate-300 text-sm"></textarea>
                @error('motivoRejeicao') <p class="text-red-600 text-sm">{{ $message }}</p> @enderror
                <div class="flex justify-end gap-2">
                    <button wire:click="$set('rejeitandoId', null)" class="text-sm px-3 py-1.5 rounded border">Cancelar</button>
                    <button wire:click="rejeitar" class="text-sm px-3 py-1.5 rounded bg-red-600 text-white">Confirmar rejeição</button>
                </div>
            </div>
        </div>
    @endif
</div>
