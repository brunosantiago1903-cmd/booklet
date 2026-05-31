<x-layouts.app title="Coleta de Campo · SISDC">
    {{-- Mapa de importacao p/ os modulos ESM usados pelo Wizard offline --}}
    <script type="importmap">
    {
        "imports": {
            "idb": "https://cdn.jsdelivr.net/npm/idb@8/+esm",
            "uuid": "https://cdn.jsdelivr.net/npm/uuid@9/+esm"
        }
    }
    </script>
    <script type="module">
        import { wizard } from '/js/coleta.js';
        const config = {
            token: @json($token),
            deviceId: @json($deviceId),
        };
        // Registra no Alpine empacotado pelo Livewire (evita Alpine duplicado).
        document.addEventListener('alpine:init', () => window.Alpine.data('wizard', () => wizard(config)));
    </script>

    <div x-data="wizard" class="max-w-3xl mx-auto">
        {{-- Barra de status offline/sync --}}
        <div class="flex items-center gap-3 mb-4 text-sm">
            <span class="px-2 py-0.5 rounded text-white" :class="online ? 'bg-green-600' : 'bg-slate-500'"
                  x-text="online ? 'Online' : 'Offline'"></span>
            <span class="text-slate-500">Pendentes: <b x-text="pendentes"></b></span>
            <span class="text-slate-500" x-text="statusSync"></span>
            <button type="button" @click="sincronizar()"
                    class="ml-auto text-sm px-3 py-1.5 rounded border hover:bg-slate-50">Sincronizar agora</button>
        </div>

        {{-- Indicador de passos --}}
        <div class="flex items-center gap-1 mb-6">
            <template x-for="n in totalPassos" :key="n">
                <div class="flex-1 h-1.5 rounded" :class="n <= passo ? 'bg-slate-900' : 'bg-slate-200'"></div>
            </template>
        </div>

        <div class="bg-white rounded-xl shadow p-6 space-y-4">
            {{-- Passo 1: Identificação --}}
            <section x-show="passo === 1" class="space-y-3">
                <h2 class="font-semibold">1. Identificação e endereço</h2>
                <div>
                    <label class="text-sm text-slate-600">Áreas de atenção</label>
                    <div class="flex flex-wrap gap-3 mt-1 text-sm">
                        @foreach (\App\Enums\AreaAtencao::cases() as $a)
                            <label class="flex items-center gap-1">
                                <input type="checkbox" value="{{ $a->value }}"
                                       @change="toggleArea('{{ $a->value }}')"> {{ $a->label() }}
                            </label>
                        @endforeach
                    </div>
                </div>
                <input x-model="form.nome_familia" placeholder="Nome da família *" class="w-full rounded border-slate-300 text-sm">
                <div class="grid grid-cols-3 gap-2">
                    <input x-model="form.cep" placeholder="CEP" class="rounded border-slate-300 text-sm">
                    <input x-model="form.endereco" placeholder="Endereço" class="col-span-2 rounded border-slate-300 text-sm">
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <input x-model="form.numero" placeholder="Nº" class="rounded border-slate-300 text-sm">
                    <input x-model="form.complemento" placeholder="Complemento" class="rounded border-slate-300 text-sm">
                    <input x-model="form.bairro" placeholder="Bairro" class="rounded border-slate-300 text-sm">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <select x-model="form.padrao_construtivo" class="rounded border-slate-300 text-sm">
                        <option value="">Padrão construtivo…</option>
                        @foreach (\App\Enums\PadraoConstrutivo::cases() as $p)
                            <option value="{{ $p->value }}">{{ $p->label() }}</option>
                        @endforeach
                    </select>
                    <select x-model="form.tipo_residencia" class="rounded border-slate-300 text-sm">
                        <option value="">Tipo de residência…</option>
                        @foreach (\App\Enums\TipoResidencia::cases() as $t)
                            <option value="{{ $t->value }}">{{ $t->label() }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" @click="capturarGPS()" class="text-sm px-3 py-1.5 rounded bg-slate-900 text-white">📍 Capturar GPS</button>
                    <span class="text-sm text-slate-500">
                        <span x-text="form.latitude ?? '—'"></span>, <span x-text="form.longitude ?? '—'"></span>
                        <span x-show="form.precisao_gps_m">(±<span x-text="form.precisao_gps_m"></span>m)</span>
                    </span>
                </div>
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" x-model="form.precisa_abrigo"> Precisará de abrigo público em saída emergencial?
                </label>
            </section>

            {{-- Passo 2: Habitantes --}}
            <section x-show="passo === 2" class="space-y-3">
                <h2 class="font-semibold">2. Habitantes da residência</h2>
                <template x-for="(h, i) in form.habitantes" :key="h.client_uuid">
                    <div class="grid grid-cols-12 gap-2 items-center">
                        <input x-model="h.nome_completo" placeholder="Nome completo" class="col-span-4 rounded border-slate-300 text-sm">
                        <input x-model="h.cpf" placeholder="CPF" class="col-span-3 rounded border-slate-300 text-sm">
                        <input x-model="h.data_nascimento" type="date" class="col-span-3 rounded border-slate-300 text-sm">
                        <input x-model="h.tipo_sanguineo" placeholder="Sangue" class="col-span-1 rounded border-slate-300 text-sm">
                        <button type="button" @click="removerHabitante(i)" class="col-span-1 text-red-600">✕</button>
                    </div>
                </template>
                <button type="button" @click="addHabitante()" class="text-sm text-slate-700 hover:underline">+ Adicionar habitante</button>
            </section>

            {{-- Passo 3: Saúde / Vulnerabilidade --}}
            <section x-show="passo === 3" class="space-y-3">
                <h2 class="font-semibold">3. Saúde e vulnerabilidade</h2>
                <input x-model="form.vulnerabilidade_saude.necessidades_especiais" placeholder="Necessidades especiais" class="w-full rounded border-slate-300 text-sm">
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.vulnerabilidade_saude.necessita_medicacao"> Necessita de medicação?</label>
                <input x-model="form.vulnerabilidade_saude.medicacao_qual" placeholder="Qual medicação?" class="w-full rounded border-slate-300 text-sm">
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.vulnerabilidade_saude.doenca_cronica"> Doença crônica?</label>
                <input x-model="form.vulnerabilidade_saude.alergias" placeholder="Alergias" class="w-full rounded border-slate-300 text-sm">
                <div class="grid grid-cols-3 gap-2">
                    <input x-model.number="form.vulnerabilidade_saude.animais_caes" type="number" min="0" placeholder="Cães" class="rounded border-slate-300 text-sm">
                    <input x-model.number="form.vulnerabilidade_saude.animais_gatos" type="number" min="0" placeholder="Gatos" class="rounded border-slate-300 text-sm">
                    <input x-model.number="form.vulnerabilidade_saude.animais_aves" type="number" min="0" placeholder="Aves" class="rounded border-slate-300 text-sm">
                </div>
            </section>

            {{-- Passo 4: Infraestrutura --}}
            <section x-show="passo === 4" class="space-y-3">
                <h2 class="font-semibold">4. Infraestrutura e saneamento</h2>
                <select x-model="form.infraestrutura.captacao_agua" class="w-full rounded border-slate-300 text-sm">
                    <option value="">Captação de água…</option>
                    <option value="nascente">Nascente</option><option value="poco">Poço</option>
                    <option value="sanepar">Sanepar</option><option value="associacao">Associação</option>
                    <option value="outro">Outro</option>
                </select>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.infraestrutura.coleta_lixo"> Tem coleta de lixo?</label>
                <select x-model="form.infraestrutura.saneamento_tipo" class="w-full rounded border-slate-300 text-sm">
                    <option value="">Saneamento…</option>
                    <option value="nenhum">Nenhum</option><option value="fossa">Fossa</option>
                    <option value="esgoto_sanepar">Esgoto da Sanepar</option><option value="saneamento_ecologico">Saneamento ecológico</option>
                </select>
            </section>

            {{-- Passo 5: Riscos ambientais + avaliação --}}
            <section x-show="passo === 5" class="space-y-3">
                <h2 class="font-semibold">5. Riscos ambientais</h2>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.potencialmente_inundavel"> Local potencialmente atingido por inundações?</label>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.historico_deslizamento"> Histórico de deslizamentos?</label>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.risco_deslizamento_atual"> Risco de deslizamento atual?</label>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.rio_passa_propriedade"> Algum rio passa pela propriedade?</label>
                <div class="border-t pt-3">
                    <p class="text-sm font-medium mb-1">Avaliação de risco (entra no histórico)</p>
                    <div class="grid grid-cols-2 gap-2">
                        <select x-model="avaliacao.tipo_evento" class="rounded border-slate-300 text-sm">
                            @foreach (\App\Enums\AreaAtencao::cases() as $a)
                                <option value="{{ $a->value }}">{{ $a->label() }}</option>
                            @endforeach
                        </select>
                        <select x-model="avaliacao.criticidade" class="rounded border-slate-300 text-sm">
                            @foreach (\App\Enums\Criticidade::cases() as $c)
                                <option value="{{ $c->value }}">{{ $c->label() }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </section>

            {{-- Passo 6: Agricultura --}}
            <section x-show="passo === 6" class="space-y-3">
                <h2 class="font-semibold">6. Agricultura (se houver produção)</h2>
                <input x-model.number="form.qtd_pessoas_domicilio" type="number" min="0" placeholder="Pessoas no domicílio" class="w-full rounded border-slate-300 text-sm">
                <input x-model.number="form.renda_domiciliar" type="number" step="0.01" placeholder="Renda domiciliar (R$)" class="w-full rounded border-slate-300 text-sm">
            </section>

            {{-- Passo 7: Preparação + revisão --}}
            <section x-show="passo === 7" class="space-y-3">
                <h2 class="font-semibold">7. Preparação e revisão</h2>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.cadastrado_alertas"> Cadastrado para receber alertas da Defesa Civil?</label>
                <textarea x-model="form.percepcao_risco" rows="2" placeholder="Quando percebe que existe risco? O que faz?" class="w-full rounded border-slate-300 text-sm"></textarea>
                <textarea x-model="form.medidas_sugeridas" rows="2" placeholder="Medidas para reduzir impactos de desastres" class="w-full rounded border-slate-300 text-sm"></textarea>
                <div class="rounded bg-slate-50 p-3 text-sm text-slate-600">
                    <b x-text="form.nome_familia || '(sem nome)'"></b> · habitantes: <span x-text="form.habitantes.length"></span> ·
                    GPS: <span x-text="form.latitude ?? '—'"></span>, <span x-text="form.longitude ?? '—'"></span>
                </div>
            </section>

            {{-- Navegação --}}
            <div class="flex items-center gap-2 pt-4 border-t">
                <button type="button" @click="anterior()" x-show="passo > 1" class="px-4 py-2 rounded border text-sm">Voltar</button>
                <button type="button" @click="salvarRascunho()" class="px-4 py-2 rounded border text-sm" x-text="salvando ? 'Salvando…' : 'Salvar rascunho'"></button>
                <button type="button" @click="proximo()" x-show="passo < totalPassos" class="ml-auto px-4 py-2 rounded bg-slate-900 text-white text-sm">Próximo</button>
                <button type="button" @click="finalizar()" x-show="passo === totalPassos" class="ml-auto px-4 py-2 rounded bg-green-600 text-white text-sm">Finalizar e sincronizar</button>
            </div>
        </div>
    </div>
</x-layouts.app>
