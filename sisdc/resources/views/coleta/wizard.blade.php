<x-layouts.app title="Coleta de Campo · SISDC">
    {{-- Config do PWA (token/device) consumida pelo bundle (resources/js/app.js). --}}
    <script>
        window.SISDC_CONFIG = { token: @json($token), deviceId: @json($deviceId) };
    </script>

    <div x-data="wizard" class="max-w-3xl mx-auto">
        <h1 class="text-lg font-semibold mb-1">Análise de risco e vulnerabilidade socioambiental</h1>
        <p class="text-sm text-slate-500 mb-4">Formulário de campo da Defesa Civil de Morretes. Os dados são salvos no aparelho e sincronizados ao reconectar.</p>

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
                <div>
                    <h2 class="font-semibold">1. Identificação, endereço e localização</h2>
                    <p class="text-xs text-slate-500">Tipos de risco a que o imóvel está associado, dados da família, endereço, padrão construtivo e coordenadas GPS.</p>
                </div>
                <div>
                    <label class="text-sm font-medium text-slate-600">Área de atenção associada (marque os riscos do local)</label>
                    <div class="flex flex-wrap gap-3 mt-1 text-sm">
                        @foreach (\App\Enums\AreaAtencao::cases() as $a)
                            <label class="flex items-center gap-1">
                                <input type="checkbox" value="{{ $a->value }}"
                                       @change="toggleArea('{{ $a->value }}')"> {{ $a->label() }}
                            </label>
                        @endforeach
                    </div>
                </div>
                <input x-model="form.nome_familia" placeholder="Nome da família (responsável) *" class="w-full rounded border-slate-300 text-sm">
                <div class="grid grid-cols-3 gap-2">
                    <input x-model="form.cep" placeholder="CEP" class="rounded border-slate-300 text-sm">
                    <input x-model="form.endereco" placeholder="Endereço (rua/estrada)" class="col-span-2 rounded border-slate-300 text-sm">
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <input x-model="form.numero" placeholder="Nº" class="rounded border-slate-300 text-sm">
                    <input x-model="form.complemento" placeholder="Complemento" class="rounded border-slate-300 text-sm">
                    <input x-model="form.bairro" placeholder="Bairro/localidade" class="rounded border-slate-300 text-sm">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <label class="text-xs text-slate-500">Padrão construtivo
                        <select x-model="form.padrao_construtivo" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                            <option value="">Selecione…</option>
                            @foreach (\App\Enums\PadraoConstrutivo::cases() as $p)
                                <option value="{{ $p->value }}">{{ $p->label() }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="text-xs text-slate-500">Tipo de residência
                        <select x-model="form.tipo_residencia" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                            <option value="">Selecione…</option>
                            @foreach (\App\Enums\TipoResidencia::cases() as $t)
                                <option value="{{ $t->value }}">{{ $t->label() }}</option>
                            @endforeach
                        </select>
                    </label>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <input x-model="form.telefone_fixo" placeholder="Telefone fixo" class="rounded border-slate-300 text-sm">
                    <input x-model="form.telefone_celular" placeholder="Telefone celular" class="rounded border-slate-300 text-sm">
                </div>
                <div class="border-t pt-3">
                    <label class="text-sm font-medium text-slate-600">Coordenadas (latitude/longitude)</label>
                    <div class="flex items-center gap-2 mt-1">
                        <button type="button" @click="capturarGPS()" class="text-sm px-3 py-1.5 rounded bg-slate-900 text-white">📍 Capturar GPS</button>
                        <span class="text-sm text-slate-500" x-show="form.precisao_gps_m">precisão ±<span x-text="form.precisao_gps_m"></span>m</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-2">
                        <input x-model.number="form.latitude" type="number" step="0.0000001" placeholder="Latitude *" class="rounded border-slate-300 text-sm">
                        <input x-model.number="form.longitude" type="number" step="0.0000001" placeholder="Longitude *" class="rounded border-slate-300 text-sm">
                    </div>
                    <p class="text-xs text-slate-400 mt-1">O GPS automático exige HTTPS; por IP/HTTP informe lat/long manualmente (ex.: copie do app de mapas).</p>
                </div>
                <div class="border-t pt-3 space-y-2">
                    <label class="flex items-center gap-2 text-sm">
                        <input type="checkbox" x-model="form.precisa_abrigo"> Os moradores precisarão de abrigo público em caso de saída emergencial?
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                        <input type="checkbox" x-model="form.moradores_encontrados"> Os moradores foram encontrados no momento do cadastro?
                    </label>
                </div>
            </section>

            {{-- Passo 2: Habitantes --}}
            <section x-show="passo === 2" class="space-y-3">
                <div>
                    <h2 class="font-semibold">2. Habitantes da residência</h2>
                    <p class="text-xs text-slate-500">Uma linha por morador. Escolaridade: S/E (sem escolaridade), F (fundamental), M (médio), S (superior) — completo ou incompleto. Trabalho: formal/informal, meio e tempo de deslocamento.</p>
                </div>
                <template x-for="(h, i) in form.habitantes" :key="h.client_uuid">
                    <div class="rounded border border-slate-200 p-3 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-medium text-slate-500">Morador <span x-text="i + 1"></span></span>
                            <button type="button" @click="removerHabitante(i)" class="text-red-600 text-sm">remover ✕</button>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <input x-model="h.nome_completo" placeholder="Nome completo" class="col-span-2 rounded border-slate-300 text-sm">
                            <input x-model="h.cpf" placeholder="CPF" class="rounded border-slate-300 text-sm">
                            <input x-model="h.data_nascimento" type="date" class="rounded border-slate-300 text-sm">
                            <select x-model="h.sexo" class="rounded border-slate-300 text-sm">
                                <option value="">Sexo…</option>
                                <option value="feminino">Feminino</option>
                                <option value="masculino">Masculino</option>
                                <option value="outro">Outro</option>
                            </select>
                            <input x-model="h.celular" placeholder="Celular" class="rounded border-slate-300 text-sm">
                            <input x-model="h.tipo_sanguineo" placeholder="Tipo sanguíneo" class="rounded border-slate-300 text-sm">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <select x-model="h.escolaridade_nivel" class="rounded border-slate-300 text-sm">
                                <option value="">Escolaridade…</option>
                                <option value="S/E">Sem escolaridade</option>
                                <option value="F">Fundamental</option>
                                <option value="M">Médio</option>
                                <option value="S">Superior</option>
                            </select>
                            <select x-model="h.escolaridade_situacao" class="rounded border-slate-300 text-sm">
                                <option value="">Situação…</option>
                                <option value="completo">Completo</option>
                                <option value="incompleto">Incompleto</option>
                            </select>
                        </div>
                        <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="h.trabalha"> Trabalha?</label>
                        <div class="grid grid-cols-2 gap-2" x-show="h.trabalha">
                            <select x-model="h.trabalho_tipo" class="rounded border-slate-300 text-sm">
                                <option value="">Vínculo…</option>
                                <option value="formal">Formal</option>
                                <option value="informal">Informal</option>
                            </select>
                            <input x-model="h.deslocamento_meio" placeholder="Meio (carro, ônibus, a pé…)" class="rounded border-slate-300 text-sm">
                            <input x-model="h.deslocamento_tempo" placeholder="Tempo de deslocamento" class="col-span-2 rounded border-slate-300 text-sm">
                        </div>
                        <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="h.responsavel_familiar"> Responsável familiar</label>
                    </div>
                </template>
                <button type="button" @click="addHabitante()" class="text-sm text-slate-700 hover:underline">+ Adicionar habitante</button>
            </section>

            {{-- Passo 3: Saúde / Vulnerabilidade --}}
            <section x-show="passo === 3" class="space-y-3">
                <div>
                    <h2 class="font-semibold">3. Saúde e vulnerabilidade</h2>
                    <p class="text-xs text-slate-500">Necessidades especiais, uso/restrição de medicação, doenças crônicas, alergias e animais de estimação (importantes para evacuação e abrigo).</p>
                </div>
                <input x-model="form.vulnerabilidade_saude.necessidades_especiais" placeholder="Alguém é portador de necessidades especiais? Quais?" class="w-full rounded border-slate-300 text-sm">
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.vulnerabilidade_saude.necessita_medicacao"> Alguém necessita de medicação contínua?</label>
                <input x-model="form.vulnerabilidade_saude.medicacao_qual" placeholder="Qual(is) medicação(ões)?" class="w-full rounded border-slate-300 text-sm">
                <input x-model="form.vulnerabilidade_saude.restricao_medicamento" placeholder="Restrição a algum medicamento? Qual?" class="w-full rounded border-slate-300 text-sm">
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.vulnerabilidade_saude.doenca_cronica"> Alguém apresenta doença crônica?</label>
                <input x-model="form.vulnerabilidade_saude.doenca_cronica_qual" placeholder="Qual(is) doença(s) crônica(s)?" class="w-full rounded border-slate-300 text-sm">
                <input x-model="form.vulnerabilidade_saude.alergias" placeholder="Alergia a algo? Qual?" class="w-full rounded border-slate-300 text-sm">
                <div>
                    <label class="text-sm font-medium text-slate-600">Animais de estimação</label>
                    <div class="grid grid-cols-3 gap-2 mt-1">
                        <input x-model.number="form.vulnerabilidade_saude.animais_caes" type="number" min="0" placeholder="Cães" class="rounded border-slate-300 text-sm">
                        <input x-model.number="form.vulnerabilidade_saude.animais_gatos" type="number" min="0" placeholder="Gatos" class="rounded border-slate-300 text-sm">
                        <input x-model.number="form.vulnerabilidade_saude.animais_aves" type="number" min="0" placeholder="Aves" class="rounded border-slate-300 text-sm">
                    </div>
                </div>
                <input x-model="form.vulnerabilidade_saude.animais_outros" placeholder="Outros animais (descrever)" class="w-full rounded border-slate-300 text-sm">
            </section>

            {{-- Passo 4: Infraestrutura --}}
            <section x-show="passo === 4" class="space-y-3">
                <div>
                    <h2 class="font-semibold">4. Infraestrutura: água, resíduos e saneamento</h2>
                    <p class="text-xs text-slate-500">Como a residência capta água, destina o lixo e trata o esgoto. Informe localização do poço/nascente e do saneamento quando aplicável.</p>
                </div>
                <label class="text-xs text-slate-500">Como ocorre a captação da água?
                    <select x-model="form.infraestrutura.captacao_agua" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                        <option value="">Selecione…</option>
                        <option value="nascente">Nascente</option><option value="poco">Poço</option>
                        <option value="sanepar">Sanepar</option><option value="associacao">Associação</option>
                        <option value="outro">Outro</option>
                    </select>
                </label>
                <div class="grid grid-cols-2 gap-2">
                    <input x-model="form.infraestrutura.captacao_agua_outro" placeholder="Se outro, qual?" class="rounded border-slate-300 text-sm">
                    <input x-model.number="form.infraestrutura.poco_profundidade_m" type="number" step="0.1" placeholder="Profundidade do poço (m)" class="rounded border-slate-300 text-sm">
                </div>
                <input x-model="form.infraestrutura.poco_nascente_localizacao" placeholder="Se poço/nascente, onde se localiza?" class="w-full rounded border-slate-300 text-sm">
                <div class="border-t pt-2 space-y-2">
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.infraestrutura.coleta_lixo"> Tem coleta de lixo?</label>
                    <input x-model="form.infraestrutura.lixo_organico_destino" placeholder="O que faz com o lixo orgânico?" class="w-full rounded border-slate-300 text-sm">
                    <input x-model="form.infraestrutura.lixo_reciclavel_destino" placeholder="O que faz com o lixo reciclável?" class="w-full rounded border-slate-300 text-sm">
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.infraestrutura.conhece_associacoes_reciclaveis"> Conhece as associações de recicláveis da cidade?</label>
                    <input x-model="form.infraestrutura.associacao_reciclavel_qual" placeholder="Qual associação?" class="w-full rounded border-slate-300 text-sm">
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.infraestrutura.coleta_seletiva_proxima"> Existe coleta seletiva passando próximo?</label>
                    <textarea x-model="form.infraestrutura.observacoes_residuos" rows="2" placeholder="Observações sobre resíduos" class="w-full rounded border-slate-300 text-sm"></textarea>
                </div>
                <div class="border-t pt-2 space-y-2">
                    <label class="text-xs text-slate-500">Como é o saneamento?
                        <select x-model="form.infraestrutura.saneamento_tipo" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                            <option value="">Selecione…</option>
                            <option value="nenhum">Nenhum</option><option value="fossa">Fossa</option>
                            <option value="esgoto_sanepar">Esgoto da Sanepar</option><option value="saneamento_ecologico">Saneamento ecológico</option>
                        </select>
                    </label>
                    <input x-model="form.infraestrutura.saneamento_qual" placeholder="Qual tipo / detalhe do saneamento?" class="w-full rounded border-slate-300 text-sm">
                    <input x-model="form.infraestrutura.saneamento_localizacao" placeholder="Onde se localiza o saneamento?" class="w-full rounded border-slate-300 text-sm">
                </div>
            </section>

            {{-- Passo 5: Riscos ambientais + avaliação --}}
            <section x-show="passo === 5" class="space-y-3">
                <div>
                    <h2 class="font-semibold">5. Riscos ambientais</h2>
                    <p class="text-xs text-slate-500">Condições de inundação, deslizamento, relevo, solo, erosão e rio. Ao final, registre a avaliação de risco (tipo + criticidade) que vai para o histórico e o mapa.</p>
                </div>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.potencialmente_inundavel"> O local é potencialmente atingido por inundações?</label>
                <textarea x-model="form.risco_ambiental.escoamento_propriedade" rows="2" placeholder="Existe estrutura de escoamento da água na propriedade? Descreva." class="w-full rounded border-slate-300 text-sm"></textarea>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.escoamento_rua"> Existe estrutura de escoamento da água na rua?</label>
                <textarea x-model="form.risco_ambiental.escoamento_rua_descricao" rows="2" placeholder="Descreva o escoamento da rua" class="w-full rounded border-slate-300 text-sm"></textarea>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.acumulo_agua"> A água se acumula em alguma área do terreno?</label>
                <input x-model="form.risco_ambiental.acumulo_agua_onde" placeholder="Onde a água se acumula?" class="w-full rounded border-slate-300 text-sm">
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.historico_deslizamento"> A propriedade tem histórico de deslizamentos?</label>
                <textarea x-model="form.risco_ambiental.historico_deslizamento_descricao" rows="2" placeholder="Descreva o histórico de deslizamentos" class="w-full rounded border-slate-300 text-sm"></textarea>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.risco_deslizamento_atual"> Atualmente há risco de deslizamentos?</label>
                <textarea x-model="form.risco_ambiental.risco_deslizamento_observacoes" rows="2" placeholder="Observações sobre o risco atual" class="w-full rounded border-slate-300 text-sm"></textarea>
                <textarea x-model="form.risco_ambiental.relevo_descricao" rows="2" placeholder="Como é o relevo do local? Descreva." class="w-full rounded border-slate-300 text-sm"></textarea>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.solo_exposto"> Há áreas com solo exposto (sem vegetação)?</label>
                <input x-model="form.risco_ambiental.solo_exposto_observacoes" placeholder="Observações sobre solo exposto" class="w-full rounded border-slate-300 text-sm">
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.erosao_expressiva"> Há erosão expressiva em alguma área?</label>
                <input x-model="form.risco_ambiental.erosao_expressiva_observacoes" placeholder="Observações sobre erosão" class="w-full rounded border-slate-300 text-sm">
                <div class="border-t pt-2 space-y-2">
                    <p class="text-sm font-medium text-slate-600">Rio na propriedade</p>
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.risco_ambiental.rio_passa_propriedade"> Algum rio passa pela propriedade?</label>
                    <div class="grid grid-cols-2 gap-2">
                        <input x-model="form.risco_ambiental.rio_nome" placeholder="Nome do rio" class="rounded border-slate-300 text-sm">
                        <input x-model="form.risco_ambiental.rio_largura" placeholder="Largura (margem a margem)" class="rounded border-slate-300 text-sm">
                    </div>
                    <label class="text-xs text-slate-500">A mata ciliar está:
                        <select x-model="form.risco_ambiental.mata_ciliar" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                            <option value="">Selecione…</option>
                            <option value="preservada">Preservada</option>
                            <option value="desmatada">Desmatada</option>
                        </select>
                    </label>
                    <input x-model="form.risco_ambiental.mata_ciliar_observacoes" placeholder="Observações sobre a mata ciliar" class="w-full rounded border-slate-300 text-sm">
                    <div class="flex flex-wrap gap-4 text-sm">
                        <label class="flex items-center gap-2"><input type="checkbox" x-model="form.risco_ambiental.erosao_beira_rio"> Erosão na beira do rio?</label>
                        <label class="flex items-center gap-2"><input type="checkbox" x-model="form.risco_ambiental.rio_assoreado"> Rio assoreado neste trecho?</label>
                    </div>
                    <input x-model="form.risco_ambiental.erosao_beira_rio_observacoes" placeholder="Observações sobre erosão na beira do rio" class="w-full rounded border-slate-300 text-sm">
                </div>
                <div class="border-t pt-3 bg-amber-50 -mx-6 px-6 py-3">
                    <p class="text-sm font-medium mb-1">Avaliação de risco (define a criticidade no mapa)</p>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="text-xs text-slate-500">Tipo de evento
                            <select x-model="avaliacao.tipo_evento" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                                @foreach (\App\Enums\AreaAtencao::cases() as $a)
                                    <option value="{{ $a->value }}">{{ $a->label() }}</option>
                                @endforeach
                            </select>
                        </label>
                        <label class="text-xs text-slate-500">Criticidade
                            <select x-model="avaliacao.criticidade" class="mt-0.5 w-full rounded border-slate-300 text-sm">
                                @foreach (\App\Enums\Criticidade::cases() as $c)
                                    <option value="{{ $c->value }}">{{ $c->label() }}</option>
                                @endforeach
                            </select>
                        </label>
                    </div>
                </div>
            </section>

            {{-- Passo 6: Domicílio, renda, programas sociais e agricultura --}}
            <section x-show="passo === 6" class="space-y-3">
                <div>
                    <h2 class="font-semibold">6. Situação socioeconômica e agricultura</h2>
                    <p class="text-xs text-slate-500">Renda, programas sociais que a família recebe e, se houver, dados da produção agrícola.</p>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <input x-model.number="form.qtd_pessoas_domicilio" type="number" min="0" placeholder="Quantas pessoas residem no domicílio?" class="rounded border-slate-300 text-sm">
                    <input x-model.number="form.renda_domiciliar" type="number" step="0.01" placeholder="Renda domiciliar (R$)" class="rounded border-slate-300 text-sm">
                </div>
                <div>
                    <label class="text-sm font-medium text-slate-600">A família é atendida por algum programa social?</label>
                    <div class="grid grid-cols-2 gap-1 mt-1 text-sm">
                        @foreach ($programasSociais as $slug => $nome)
                            <label class="flex items-center gap-1">
                                <input type="checkbox" value="{{ $slug }}" @change="togglePrograma('{{ $slug }}')"> {{ $nome }}
                            </label>
                        @endforeach
                    </div>
                </div>
                <p class="text-sm font-medium text-slate-600 border-t pt-3">Agricultura (se houver produção)</p>
                <div class="grid grid-cols-2 gap-2">
                    <input x-model="form.agricultura.tamanho_propriedade" placeholder="Tamanho da propriedade" class="rounded border-slate-300 text-sm">
                    <input x-model="form.agricultura.areas_plantio" placeholder="Áreas de plantio (quantas, tamanho)" class="rounded border-slate-300 text-sm">
                </div>
                <input x-model="form.agricultura.culturas" placeholder="Culturas" class="w-full rounded border-slate-300 text-sm">
                <div class="grid grid-cols-2 gap-2">
                    <select x-model="form.agricultura.tipo_cultivo" class="rounded border-slate-300 text-sm">
                        <option value="">Tipo de cultivo…</option>
                        <option value="organico">Orgânico</option>
                        <option value="convencional">Convencional</option>
                    </select>
                    <input x-model.number="form.agricultura.renda_media" type="number" step="0.01" placeholder="Renda média (R$)" class="rounded border-slate-300 text-sm">
                </div>
                <input x-model.number="form.agricultura.pessoas_trabalham" type="number" min="0" placeholder="Pessoas que trabalham na propriedade" class="w-full rounded border-slate-300 text-sm">
                <input x-model="form.agricultura.equipamentos_maquinarios" placeholder="Equipamentos e maquinários" class="w-full rounded border-slate-300 text-sm">
                <div class="flex flex-wrap gap-4 text-sm">
                    <label class="flex items-center gap-2"><input type="checkbox" x-model="form.agricultura.barracao_proprio"> Barracão próprio?</label>
                    <label class="flex items-center gap-2"><input type="checkbox" x-model="form.agricultura.sistema_irrigacao"> Sistema de irrigação?</label>
                </div>
                <input x-model="form.agricultura.observacao" placeholder="Observação (agricultura)" class="w-full rounded border-slate-300 text-sm">
            </section>

            {{-- Passo 7: Preparação + revisão --}}
            <section x-show="passo === 7" class="space-y-3">
                <div>
                    <h2 class="font-semibold">7. Preparação e revisão</h2>
                    <p class="text-xs text-slate-500">Percepção de risco da família, ações ao perceber risco iminente e medidas sugeridas. Revise antes de finalizar.</p>
                </div>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="form.cadastrado_alertas"> A família está cadastrada para receber alertas da Defesa Civil?</label>
                <textarea x-model="form.percepcao_risco" rows="2" placeholder="Quando percebe que existe risco?" class="w-full rounded border-slate-300 text-sm"></textarea>
                <textarea x-model="form.acao_risco_iminente" rows="2" placeholder="Ao perceber risco iminente, o que a família faz?" class="w-full rounded border-slate-300 text-sm"></textarea>
                <textarea x-model="form.medidas_sugeridas" rows="2" placeholder="Quais medidas você acha que devem ser realizadas para reduzir os impactos dos desastres?" class="w-full rounded border-slate-300 text-sm"></textarea>
                <div class="rounded bg-slate-50 p-3 text-sm text-slate-600">
                    <b x-text="form.nome_familia || '(sem nome)'"></b> · habitantes: <span x-text="form.habitantes.length"></span> ·
                    GPS: <span x-text="form.latitude ?? '—'"></span>, <span x-text="form.longitude ?? '—'"></span> ·
                    avaliação: <span x-text="avaliacao.tipo_evento + ' / ' + avaliacao.criticidade"></span>
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
