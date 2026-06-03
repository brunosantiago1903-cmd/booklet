<div class="max-w-4xl mx-auto space-y-4">
    <div class="flex items-center gap-3 flex-wrap">
        <a href="{{ route('auditoria') }}" class="text-sm text-slate-500 hover:underline">&larr; Auditoria</a>
        <h1 class="text-xl font-semibold">Revisar: {{ $cadastro->nome_familia }}</h1>
        <span class="inline-flex items-center gap-1 text-sm">
            <span class="w-2.5 h-2.5 rounded-full" style="background: {{ $cadastro->criticidade_atual->color() }}"></span>
            {{ $cadastro->criticidade_atual->label() }}
        </span>
        <span class="text-xs px-2 py-0.5 rounded bg-slate-100">{{ $cadastro->status->label() }}</span>
        <div class="ml-auto flex gap-2">
            @if (\Illuminate\Support\Facades\Route::has('export.cadastro.pdf'))
                <a href="{{ route('export.cadastro.pdf', $cadastro) }}" target="_blank"
                   class="text-sm px-3 py-1.5 rounded border hover:bg-slate-50">PDF do cadastro</a>
            @endif
        </div>
    </div>

    @if (session('ok'))
        <div class="rounded bg-green-50 text-green-700 text-sm p-3">{{ session('ok') }}</div>
    @endif

    {{-- Dados gerais --}}
    <section class="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 class="font-semibold">Dados gerais</h2>
        <div class="grid grid-cols-2 gap-2">
            <input wire:model="dados.nome_familia" placeholder="Nome da família" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.codigo_sisdc" placeholder="Código SISDC" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.cep" placeholder="CEP" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.bairro" placeholder="Bairro" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.endereco" placeholder="Endereço" class="col-span-2 rounded border-slate-300 text-sm">
            <input wire:model="dados.numero" placeholder="Nº" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.complemento" placeholder="Complemento" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.telefone_fixo" placeholder="Telefone fixo" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.telefone_celular" placeholder="Telefone celular" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.latitude" type="number" step="0.0000001" placeholder="Latitude" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.longitude" type="number" step="0.0000001" placeholder="Longitude" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.qtd_pessoas_domicilio" type="number" placeholder="Pessoas no domicílio" class="rounded border-slate-300 text-sm">
            <input wire:model="dados.renda_domiciliar" type="number" step="0.01" placeholder="Renda domiciliar" class="rounded border-slate-300 text-sm">
        </div>
        <div class="flex flex-wrap gap-4 text-sm">
            <label class="flex items-center gap-2"><input type="checkbox" wire:model="dados.precisa_abrigo"> Precisa de abrigo</label>
            <label class="flex items-center gap-2"><input type="checkbox" wire:model="dados.moradores_encontrados"> Moradores encontrados</label>
            <label class="flex items-center gap-2"><input type="checkbox" wire:model="dados.cadastrado_alertas"> Cadastrado p/ alertas</label>
        </div>
    </section>

    {{-- Habitantes --}}
    <section class="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 class="font-semibold">Habitantes ({{ count($habitantes) }})</h2>
        @foreach ($habitantes as $i => $h)
            <div wire:key="hab-{{ $i }}" class="grid grid-cols-12 gap-2 items-center">
                <input wire:model="habitantes.{{ $i }}.nome_completo" placeholder="Nome" class="col-span-4 rounded border-slate-300 text-sm">
                <input wire:model="habitantes.{{ $i }}.cpf" placeholder="CPF" class="col-span-3 rounded border-slate-300 text-sm">
                <input wire:model="habitantes.{{ $i }}.data_nascimento" type="date" class="col-span-2 rounded border-slate-300 text-sm">
                <input wire:model="habitantes.{{ $i }}.tipo_sanguineo" placeholder="Sangue" class="col-span-2 rounded border-slate-300 text-sm">
                <button wire:click="removerHabitante({{ $i }})" class="col-span-1 text-red-600">✕</button>
            </div>
        @endforeach
        <button wire:click="addHabitante" class="text-sm text-slate-700 hover:underline">+ Adicionar habitante</button>
    </section>

    {{-- Saúde --}}
    <section class="bg-white rounded-xl shadow p-5 space-y-2">
        <h2 class="font-semibold">Saúde e vulnerabilidade</h2>
        <div class="grid grid-cols-2 gap-2 items-center">
            <label class="text-sm text-slate-600">Portador de necessidades especiais (deficiência)?
                <select wire:model="saude.possui_necessidades_especiais" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                    <option value="">—</option><option value="1">Sim</option><option value="0">Não</option>
                </select>
            </label>
            <input wire:model="saude.necessidades_especiais" placeholder="Quais necessidades especiais?" class="rounded border-slate-300 text-sm">
        </div>
        <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" wire:model="saude.necessita_medicacao"> Necessita medicação</label>
            <input wire:model="saude.medicacao_qual" placeholder="Qual medicação?" class="rounded border-slate-300 text-sm">
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" wire:model="saude.doenca_cronica"> Doença crônica</label>
            <input wire:model="saude.doenca_cronica_qual" placeholder="Qual doença?" class="rounded border-slate-300 text-sm">
        </div>
        <input wire:model="saude.alergias" placeholder="Alergias" class="w-full rounded border-slate-300 text-sm">
    </section>

    {{-- Infraestrutura --}}
    <section class="bg-white rounded-xl shadow p-5 space-y-2">
        <h2 class="font-semibold">Infraestrutura e saneamento</h2>
        <div class="grid grid-cols-2 gap-2">
            <input wire:model="infra.captacao_agua" placeholder="Captação de água" class="rounded border-slate-300 text-sm">
            <input wire:model="infra.saneamento_tipo" placeholder="Saneamento" class="rounded border-slate-300 text-sm">
            <input wire:model="infra.saneamento_qual" placeholder="Qual saneamento?" class="rounded border-slate-300 text-sm">
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" wire:model="infra.coleta_lixo"> Tem coleta de lixo</label>
        </div>
    </section>

    {{-- Riscos --}}
    <section class="bg-white rounded-xl shadow p-5 space-y-2">
        <h2 class="font-semibold">Riscos ambientais</h2>
        <div class="flex flex-wrap gap-4 text-sm">
            <label class="flex items-center gap-2"><input type="checkbox" wire:model="risco.potencialmente_inundavel"> Inundável</label>
            <label class="flex items-center gap-2"><input type="checkbox" wire:model="risco.historico_deslizamento"> Histórico deslizamento</label>
            <label class="flex items-center gap-2"><input type="checkbox" wire:model="risco.risco_deslizamento_atual"> Risco atual</label>
            <label class="flex items-center gap-2"><input type="checkbox" wire:model="risco.rio_passa_propriedade"> Rio na propriedade</label>
        </div>
        <textarea wire:model="risco.relevo_descricao" rows="2" placeholder="Relevo" class="w-full rounded border-slate-300 text-sm"></textarea>
        <div class="border-t pt-2 bg-amber-50 -mx-5 px-5 py-2">
            <label class="flex items-center gap-2 text-sm font-medium"><input type="checkbox" wire:model.live="novaAvaliacao"> Registrar nova avaliação de risco (atualiza a criticidade)</label>
            @if ($novaAvaliacao)
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <select wire:model="avaliacaoTipo" class="rounded border-slate-300 text-sm">
                        @foreach ($areas as $a)<option value="{{ $a->value }}">{{ $a->label() }}</option>@endforeach
                    </select>
                    <select wire:model="avaliacaoCriticidade" class="rounded border-slate-300 text-sm">
                        @foreach ($criticidades as $c)<option value="{{ $c->value }}">{{ $c->label() }}</option>@endforeach
                    </select>
                </div>
            @endif
        </div>
    </section>

    {{-- Programas sociais --}}
    <section class="bg-white rounded-xl shadow p-5 space-y-2">
        <h2 class="font-semibold">Programas sociais</h2>
        <div class="grid grid-cols-2 gap-1 text-sm">
            @foreach ($todosProgramas as $slug => $nome)
                <label class="flex items-center gap-1"><input type="checkbox" value="{{ $slug }}" wire:model="programas"> {{ $nome }}</label>
            @endforeach
        </div>
    </section>

    {{-- Fotos --}}
    <section class="bg-white rounded-xl shadow p-5 space-y-2">
        <h2 class="font-semibold">Fotos ({{ $cadastro->anexos->count() }})</h2>
        @if ($cadastro->anexos->isEmpty())
            <p class="text-sm text-slate-400">Nenhuma foto anexada.</p>
        @else
            <div class="grid grid-cols-4 gap-2">
                @foreach ($cadastro->anexos as $a)
                    <a href="{{ route('anexos.show', $a) }}" target="_blank" class="block">
                        <img src="{{ route('anexos.show', $a) }}" alt="{{ $a->categoria }}"
                             class="w-full h-24 object-cover rounded border">
                        <span class="text-xs text-slate-500">{{ $a->categoria }}</span>
                    </a>
                @endforeach
            </div>
        @endif
    </section>

    {{-- Ações --}}
    <div class="bg-white rounded-xl shadow p-5 space-y-3 sticky bottom-2">
        <div class="flex flex-wrap items-center gap-2">
            <button wire:click="salvar" class="px-4 py-2 rounded border text-sm">Salvar alterações</button>
            <button wire:click="validar" wire:confirm="Salvar e validar este cadastro?"
                    class="px-4 py-2 rounded bg-green-600 text-white text-sm">Validar</button>
            <div class="ml-auto flex items-center gap-2">
                <input wire:model="motivoRejeicao" placeholder="Motivo da rejeição" class="rounded border-slate-300 text-sm w-64">
                <button wire:click="rejeitar" class="px-4 py-2 rounded bg-red-600 text-white text-sm">Rejeitar</button>
            </div>
        </div>
        @error('motivoRejeicao') <p class="text-red-600 text-sm">{{ $message }}</p> @enderror
    </div>
</div>
