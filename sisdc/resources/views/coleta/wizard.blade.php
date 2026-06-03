<x-layouts.app title="Coleta de Campo · SISDC">
    {{-- Config do PWA (token/device) consumida pelo bundle (resources/js/app.js). --}}
    <script>
        window.SISDC_CONFIG = { token: @json($token), deviceId: @json($deviceId) };
    </script>

    @php
        $label = 'block text-xs text-slate-600 mb-0.5';
        $input = 'w-full rounded border-slate-300 text-sm';
    @endphp

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

        {{-- Lista de rascunhos pendentes: permite reabrir para editar ou descartar
             (ex.: um rascunho sem nome que o servidor recusa e fica preso na fila). --}}
        <div x-show="pendentesLista.length" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p class="text-xs font-medium text-amber-800 mb-2">Cadastros pendentes neste aparelho (toque para corrigir e reenviar):</p>
            <ul class="space-y-1">
                <template x-for="p in pendentesLista" :key="p.client_uuid">
                    <li class="flex items-center gap-2 text-sm">
                        <span class="truncate" :class="p.sem_nome ? 'text-red-600' : 'text-slate-700'" x-text="p.nome_familia"></span>
                        <button type="button" @click="editarPendente(p.client_uuid)"
                                class="ml-auto px-2 py-1 rounded border border-amber-300 bg-white text-xs hover:bg-amber-100">Editar</button>
                        <button type="button" @click="descartarPendente(p.client_uuid)"
                                class="px-2 py-1 rounded border border-red-200 bg-white text-xs text-red-600 hover:bg-red-50">Descartar</button>
                    </li>
                </template>
            </ul>
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
                                <input type="checkbox" value="{{ $a->value }}" @change="toggleArea('{{ $a->value }}')"> {{ $a->label() }}
                            </label>
                        @endforeach
                    </div>
                </div>
                <div>
                    <label class="{{ $label }}">Nome da família (responsável) *</label>
                    <input x-model="form.nome_familia" placeholder="Ex.: Família Silva" class="{{ $input }}">
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <div><label class="{{ $label }}">CEP</label><input x-model="form.cep" class="{{ $input }}"></div>
                    <div class="col-span-2"><label class="{{ $label }}">Endereço (rua/estrada)</label><input x-model="form.endereco" class="{{ $input }}"></div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <div><label class="{{ $label }}">Número</label><input x-model="form.numero" class="{{ $input }}"></div>
                    <div><label class="{{ $label }}">Complemento</label><input x-model="form.complemento" class="{{ $input }}"></div>
                    <div><label class="{{ $label }}">Bairro/localidade</label><input x-model="form.bairro" class="{{ $input }}"></div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="{{ $label }}">Padrão construtivo</label>
                        <select x-model="form.padrao_construtivo" class="{{ $input }}">
                            <option value="">Selecione…</option>
                            @foreach (\App\Enums\PadraoConstrutivo::cases() as $p)<option value="{{ $p->value }}">{{ $p->label() }}</option>@endforeach
                        </select>
                    </div>
                    <div>
                        <label class="{{ $label }}">Tipo de residência</label>
                        <select x-model="form.tipo_residencia" class="{{ $input }}">
                            <option value="">Selecione…</option>
                            @foreach (\App\Enums\TipoResidencia::cases() as $t)<option value="{{ $t->value }}">{{ $t->label() }}</option>@endforeach
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="{{ $label }}">Telefone fixo</label><input x-model="form.telefone_fixo" class="{{ $input }}"></div>
                    <div><label class="{{ $label }}">Telefone celular</label><input x-model="form.telefone_celular" class="{{ $input }}"></div>
                </div>

                {{-- Coordenadas (vários formatos) --}}
                <div class="border-t pt-3">
                    <label class="text-sm font-medium text-slate-600">Coordenadas (latitude/longitude)</label>
                    <div class="flex items-center gap-2 mt-1">
                        <button type="button" @click="capturarGPS()" class="text-sm px-3 py-1.5 rounded bg-slate-900 text-white">📍 Capturar GPS</button>
                        <span class="text-sm text-slate-500" x-show="form.precisao_gps_m">precisão ±<span x-text="form.precisao_gps_m"></span>m</span>
                    </div>
                    <div class="flex items-end gap-2 mt-2">
                        <div class="flex-1">
                            <label class="{{ $label }}">Colar coordenadas (aceita "-25.47, -48.83", DMS ou link do Google Maps)</label>
                            <input x-model="coordsTexto" placeholder='Ex.: -25.4767, -48.8344' class="{{ $input }}">
                        </div>
                        <button type="button" @click="aplicarCoordenadas()" class="text-sm px-3 py-1.5 rounded border hover:bg-slate-50">Aplicar</button>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-2">
                        <div><label class="{{ $label }}">Latitude *</label><input x-model.number="form.latitude" type="number" step="0.0000001" class="{{ $input }}"></div>
                        <div><label class="{{ $label }}">Longitude *</label><input x-model.number="form.longitude" type="number" step="0.0000001" class="{{ $input }}"></div>
                    </div>
                    <p class="text-xs text-slate-400 mt-1">O GPS automático exige HTTPS; por IP/HTTP, cole as coordenadas ou digite manualmente.</p>
                </div>

                <div class="border-t pt-3 space-y-3">
                    <x-sim-nao label="Os moradores precisarão de abrigo público em caso de saída emergencial?" model="form.precisa_abrigo" />
                    <x-sim-nao label="Os moradores foram encontrados no momento do cadastro?" model="form.moradores_encontrados" />
                </div>

                <div class="border-t pt-3">
                    <label class="text-sm font-medium text-slate-600">Fotos da residência</label>
                    <input type="file" accept="image/*" capture="environment" multiple
                           @change="adicionarFotos('residencia', $event.target.files); $event.target.value = ''"
                           class="mt-1 block w-full text-sm">
                    <p class="text-xs text-slate-400 mt-1">Fotos anexadas neste cadastro: <span x-text="fotosCount"></span> (enviadas após a sincronização).</p>
                    <x-fotos-preview categoria="residencia" />
                </div>
            </section>

            {{-- Passo 2: Habitantes --}}
            <section x-show="passo === 2" class="space-y-3">
                <div>
                    <h2 class="font-semibold">2. Habitantes da residência</h2>
                    <p class="text-xs text-slate-500">Uma linha por morador. Escolaridade: S/E (sem escolaridade), F (fundamental), M (médio), S (superior) — completo ou incompleto.</p>
                </div>
                <template x-for="(h, i) in form.habitantes" :key="h.client_uuid">
                    <div class="rounded border border-slate-200 p-3 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-medium text-slate-500">Morador <span x-text="i + 1"></span></span>
                            <button type="button" @click="removerHabitante(i)" class="text-red-600 text-sm">remover ✕</button>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="col-span-2"><label class="{{ $label }}">Nome completo</label><input x-model="h.nome_completo" class="{{ $input }}"></div>
                            <div><label class="{{ $label }}">CPF</label><input x-model="h.cpf" class="{{ $input }}"></div>
                            <div><label class="{{ $label }}">Data de nascimento</label><input x-model="h.data_nascimento" type="date" class="{{ $input }}"></div>
                            <div>
                                <label class="{{ $label }}">Sexo</label>
                                <select x-model="h.sexo" class="{{ $input }}">
                                    <option value="">Selecione…</option>
                                    <option value="feminino">Feminino</option>
                                    <option value="masculino">Masculino</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </div>
                            <div><label class="{{ $label }}">Celular</label><input x-model="h.celular" class="{{ $input }}"></div>
                            <div><label class="{{ $label }}">Tipo sanguíneo</label><input x-model="h.tipo_sanguineo" class="{{ $input }}"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="{{ $label }}">Escolaridade</label>
                                <select x-model="h.escolaridade_nivel" class="{{ $input }}">
                                    <option value="">Selecione…</option>
                                    <option value="S/E">Sem escolaridade</option>
                                    <option value="F">Fundamental</option>
                                    <option value="M">Médio</option>
                                    <option value="S">Superior</option>
                                </select>
                            </div>
                            <div>
                                <label class="{{ $label }}">Situação</label>
                                <select x-model="h.escolaridade_situacao" class="{{ $input }}">
                                    <option value="">Selecione…</option>
                                    <option value="completo">Completo</option>
                                    <option value="incompleto">Incompleto</option>
                                </select>
                            </div>
                        </div>
                        {{-- Sim/Não no loop: name dinâmico por índice --}}
                        <div class="text-sm">
                            <span class="block text-slate-600">Trabalha?</span>
                            <div class="flex gap-4 mt-0.5">
                                <label class="flex items-center gap-1"><input type="radio" :name="'trab_'+i" :value="true" x-model="h.trabalha"> Sim</label>
                                <label class="flex items-center gap-1"><input type="radio" :name="'trab_'+i" :value="false" x-model="h.trabalha"> Não</label>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2" x-show="h.trabalha === true">
                            <div>
                                <label class="{{ $label }}">Vínculo</label>
                                <select x-model="h.trabalho_tipo" class="{{ $input }}">
                                    <option value="">Selecione…</option>
                                    <option value="formal">Formal</option>
                                    <option value="informal">Informal</option>
                                </select>
                            </div>
                            <div><label class="{{ $label }}">Meio de deslocamento</label><input x-model="h.deslocamento_meio" placeholder="Carro, ônibus, a pé…" class="{{ $input }}"></div>
                            <div class="col-span-2"><label class="{{ $label }}">Tempo de deslocamento</label><input x-model="h.deslocamento_tempo" class="{{ $input }}"></div>
                        </div>
                        <div class="text-sm">
                            <span class="block text-slate-600">É o responsável familiar?</span>
                            <div class="flex gap-4 mt-0.5">
                                <label class="flex items-center gap-1"><input type="radio" :name="'resp_'+i" :value="true" x-model="h.responsavel_familiar"> Sim</label>
                                <label class="flex items-center gap-1"><input type="radio" :name="'resp_'+i" :value="false" x-model="h.responsavel_familiar"> Não</label>
                            </div>
                        </div>
                    </div>
                </template>
                <button type="button" @click="addHabitante()" class="text-sm text-slate-700 hover:underline">+ Adicionar habitante</button>
            </section>

            {{-- Passo 3: Saúde / Vulnerabilidade --}}
            <section x-show="passo === 3" class="space-y-3">
                <div>
                    <h2 class="font-semibold">3. Saúde e vulnerabilidade</h2>
                    <p class="text-xs text-slate-500">Necessidades especiais, uso/restrição de medicação, doenças crônicas, alergias e animais (importantes para evacuação e abrigo).</p>
                </div>
                <x-sim-nao label="Alguém é portador de necessidades especiais (deficiência)?" model="form.vulnerabilidade_saude.possui_necessidades_especiais" />
                <div x-show="form.vulnerabilidade_saude.possui_necessidades_especiais === true">
                    <label class="{{ $label }}">Quais necessidades especiais?</label>
                    <input x-model="form.vulnerabilidade_saude.necessidades_especiais" class="{{ $input }}">
                </div>
                <x-sim-nao label="Alguém necessita de medicação contínua?" model="form.vulnerabilidade_saude.necessita_medicacao" />
                <div x-show="form.vulnerabilidade_saude.necessita_medicacao === true">
                    <label class="{{ $label }}">Qual(is) medicação(ões)?</label>
                    <input x-model="form.vulnerabilidade_saude.medicacao_qual" class="{{ $input }}">
                </div>
                <div>
                    <label class="{{ $label }}">Restrição a algum medicamento? Qual?</label>
                    <input x-model="form.vulnerabilidade_saude.restricao_medicamento" class="{{ $input }}">
                </div>
                <x-sim-nao label="Alguém apresenta doença crônica?" model="form.vulnerabilidade_saude.doenca_cronica" />
                <div x-show="form.vulnerabilidade_saude.doenca_cronica === true">
                    <label class="{{ $label }}">Qual(is) doença(s) crônica(s)?</label>
                    <input x-model="form.vulnerabilidade_saude.doenca_cronica_qual" class="{{ $input }}">
                </div>
                <div>
                    <label class="{{ $label }}">Alergia a algo? Qual?</label>
                    <input x-model="form.vulnerabilidade_saude.alergias" class="{{ $input }}">
                </div>
                <div>
                    <label class="text-sm font-medium text-slate-600">Animais de estimação</label>
                    <div class="grid grid-cols-3 gap-2 mt-1">
                        <div><label class="{{ $label }}">Cães</label><input x-model.number="form.vulnerabilidade_saude.animais_caes" type="number" min="0" class="{{ $input }}"></div>
                        <div><label class="{{ $label }}">Gatos</label><input x-model.number="form.vulnerabilidade_saude.animais_gatos" type="number" min="0" class="{{ $input }}"></div>
                        <div><label class="{{ $label }}">Aves</label><input x-model.number="form.vulnerabilidade_saude.animais_aves" type="number" min="0" class="{{ $input }}"></div>
                    </div>
                </div>
                <div><label class="{{ $label }}">Outros animais (descrever)</label><input x-model="form.vulnerabilidade_saude.animais_outros" class="{{ $input }}"></div>
            </section>

            {{-- Passo 4: Infraestrutura --}}
            <section x-show="passo === 4" class="space-y-3">
                <div>
                    <h2 class="font-semibold">4. Infraestrutura: água, resíduos e saneamento</h2>
                    <p class="text-xs text-slate-500">Como a residência capta água, destina o lixo e trata o esgoto.</p>
                </div>
                <div>
                    <label class="{{ $label }}">Como ocorre a captação da água?</label>
                    <select x-model="form.infraestrutura.captacao_agua" class="{{ $input }}">
                        <option value="">Selecione…</option>
                        <option value="nascente">Nascente</option><option value="poco">Poço</option>
                        <option value="sanepar">Sanepar</option><option value="associacao">Associação</option>
                        <option value="outro">Outro</option>
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="{{ $label }}">Se outro, qual?</label><input x-model="form.infraestrutura.captacao_agua_outro" class="{{ $input }}"></div>
                    <div><label class="{{ $label }}">Profundidade do poço (m)</label><input x-model.number="form.infraestrutura.poco_profundidade_m" type="number" step="0.1" class="{{ $input }}"></div>
                </div>
                <div><label class="{{ $label }}">Se poço/nascente, onde se localiza?</label><input x-model="form.infraestrutura.poco_nascente_localizacao" class="{{ $input }}"></div>
                <div class="border-t pt-2 space-y-3">
                    <x-sim-nao label="Tem coleta de lixo?" model="form.infraestrutura.coleta_lixo" />
                    <div><label class="{{ $label }}">O que faz com o lixo orgânico?</label><input x-model="form.infraestrutura.lixo_organico_destino" class="{{ $input }}"></div>
                    <div><label class="{{ $label }}">O que faz com o lixo reciclável?</label><input x-model="form.infraestrutura.lixo_reciclavel_destino" class="{{ $input }}"></div>
                    <x-sim-nao label="Conhece as associações de recicláveis da cidade?" model="form.infraestrutura.conhece_associacoes_reciclaveis" />
                    <div><label class="{{ $label }}">Qual associação?</label><input x-model="form.infraestrutura.associacao_reciclavel_qual" class="{{ $input }}"></div>
                    <x-sim-nao label="Existe coleta seletiva passando próximo?" model="form.infraestrutura.coleta_seletiva_proxima" />
                    <div><label class="{{ $label }}">Observações sobre resíduos</label><textarea x-model="form.infraestrutura.observacoes_residuos" rows="2" class="{{ $input }}"></textarea></div>
                </div>
                <div class="border-t pt-2 space-y-2">
                    <div>
                        <label class="{{ $label }}">Como é o saneamento?</label>
                        <select x-model="form.infraestrutura.saneamento_tipo" class="{{ $input }}">
                            <option value="">Selecione…</option>
                            <option value="nenhum">Nenhum</option><option value="fossa">Fossa</option>
                            <option value="esgoto_sanepar">Esgoto da Sanepar</option><option value="saneamento_ecologico">Saneamento ecológico</option>
                        </select>
                    </div>
                    <div><label class="{{ $label }}">Qual tipo / detalhe do saneamento?</label><input x-model="form.infraestrutura.saneamento_qual" class="{{ $input }}"></div>
                    <div><label class="{{ $label }}">Onde se localiza o saneamento?</label><input x-model="form.infraestrutura.saneamento_localizacao" class="{{ $input }}"></div>
                </div>
                <div class="border-t pt-3 grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-slate-600">Fotos do poço/nascente</label>
                        <input type="file" accept="image/*" capture="environment" multiple
                               @change="adicionarFotos('poco', $event.target.files); $event.target.value = ''" class="mt-1 block w-full text-xs">
                        <x-fotos-preview categoria="poco" />
                    </div>
                    <div>
                        <label class="text-xs font-medium text-slate-600">Fotos do saneamento</label>
                        <input type="file" accept="image/*" capture="environment" multiple
                               @change="adicionarFotos('saneamento', $event.target.files); $event.target.value = ''" class="mt-1 block w-full text-xs">
                        <x-fotos-preview categoria="saneamento" />
                    </div>
                </div>
            </section>

            {{-- Passo 5: Riscos ambientais + avaliação --}}
            <section x-show="passo === 5" class="space-y-3">
                <div>
                    <h2 class="font-semibold">5. Riscos ambientais</h2>
                    <p class="text-xs text-slate-500">Condições de inundação, deslizamento, relevo, solo, erosão e rio. Ao final, registre a avaliação de risco que vai para o mapa.</p>
                </div>
                <x-sim-nao label="O local é potencialmente atingido por inundações?" model="form.risco_ambiental.potencialmente_inundavel" />
                <div><label class="{{ $label }}">Existe estrutura de escoamento da água na propriedade? Descreva.</label><textarea x-model="form.risco_ambiental.escoamento_propriedade" rows="2" class="{{ $input }}"></textarea></div>
                <x-sim-nao label="Existe estrutura de escoamento da água na rua?" model="form.risco_ambiental.escoamento_rua" />
                <div><label class="{{ $label }}">Descreva o escoamento da rua</label><textarea x-model="form.risco_ambiental.escoamento_rua_descricao" rows="2" class="{{ $input }}"></textarea></div>
                <x-sim-nao label="A água se acumula em alguma área do terreno?" model="form.risco_ambiental.acumulo_agua" />
                <div><label class="{{ $label }}">Onde a água se acumula?</label><input x-model="form.risco_ambiental.acumulo_agua_onde" class="{{ $input }}"></div>
                <x-sim-nao label="A propriedade tem histórico de deslizamentos?" model="form.risco_ambiental.historico_deslizamento" />
                <div><label class="{{ $label }}">Descreva o histórico de deslizamentos</label><textarea x-model="form.risco_ambiental.historico_deslizamento_descricao" rows="2" class="{{ $input }}"></textarea></div>
                <x-sim-nao label="Atualmente há risco de deslizamentos?" model="form.risco_ambiental.risco_deslizamento_atual" />
                <div><label class="{{ $label }}">Observações sobre o risco atual</label><textarea x-model="form.risco_ambiental.risco_deslizamento_observacoes" rows="2" class="{{ $input }}"></textarea></div>
                <div><label class="{{ $label }}">Como é o relevo do local? Descreva.</label><textarea x-model="form.risco_ambiental.relevo_descricao" rows="2" class="{{ $input }}"></textarea></div>
                <x-sim-nao label="Há áreas com solo exposto (sem vegetação)?" model="form.risco_ambiental.solo_exposto" />
                <div><label class="{{ $label }}">Observações sobre solo exposto</label><input x-model="form.risco_ambiental.solo_exposto_observacoes" class="{{ $input }}"></div>
                <x-sim-nao label="Há erosão expressiva em alguma área?" model="form.risco_ambiental.erosao_expressiva" />
                <div><label class="{{ $label }}">Observações sobre erosão</label><input x-model="form.risco_ambiental.erosao_expressiva_observacoes" class="{{ $input }}"></div>
                <div class="border-t pt-2 space-y-3">
                    <p class="text-sm font-medium text-slate-600">Rio na propriedade</p>
                    <x-sim-nao label="Algum rio passa pela propriedade?" model="form.risco_ambiental.rio_passa_propriedade" />
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="{{ $label }}">Nome do rio</label><input x-model="form.risco_ambiental.rio_nome" class="{{ $input }}"></div>
                        <div><label class="{{ $label }}">Largura (margem a margem)</label><input x-model="form.risco_ambiental.rio_largura" class="{{ $input }}"></div>
                    </div>
                    <div>
                        <label class="{{ $label }}">A mata ciliar está:</label>
                        <select x-model="form.risco_ambiental.mata_ciliar" class="{{ $input }}">
                            <option value="">Selecione…</option>
                            <option value="preservada">Preservada</option>
                            <option value="desmatada">Desmatada</option>
                        </select>
                    </div>
                    <div><label class="{{ $label }}">Observações sobre a mata ciliar</label><input x-model="form.risco_ambiental.mata_ciliar_observacoes" class="{{ $input }}"></div>
                    <x-sim-nao label="Há erosão na beira do rio?" model="form.risco_ambiental.erosao_beira_rio" />
                    <div><label class="{{ $label }}">Observações sobre erosão na beira do rio</label><input x-model="form.risco_ambiental.erosao_beira_rio_observacoes" class="{{ $input }}"></div>
                    <x-sim-nao label="O rio é assoreado neste trecho?" model="form.risco_ambiental.rio_assoreado" />
                </div>
                <div class="border-t pt-3 bg-amber-50 -mx-6 px-6 py-3">
                    <p class="text-sm font-medium mb-1">Avaliação de risco (define a criticidade no mapa)</p>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="{{ $label }}">Tipo de evento</label>
                            <select x-model="avaliacao.tipo_evento" class="{{ $input }}">
                                @foreach (\App\Enums\AreaAtencao::cases() as $a)<option value="{{ $a->value }}">{{ $a->label() }}</option>@endforeach
                            </select>
                        </div>
                        <div>
                            <label class="{{ $label }}">Criticidade</label>
                            <select x-model="avaliacao.criticidade" class="{{ $input }}">
                                @foreach (\App\Enums\Criticidade::cases() as $c)<option value="{{ $c->value }}">{{ $c->label() }}</option>@endforeach
                            </select>
                        </div>
                    </div>
                </div>
                <div class="border-t pt-3">
                    <label class="text-sm font-medium text-slate-600">Fotos dos riscos</label>
                    <input type="file" accept="image/*" capture="environment" multiple
                           @change="adicionarFotos('risco', $event.target.files); $event.target.value = ''" class="mt-1 block w-full text-sm">
                    <x-fotos-preview categoria="risco" />
                </div>
            </section>

            {{-- Passo 6: Domicílio, renda, programas sociais e agricultura --}}
            <section x-show="passo === 6" class="space-y-3">
                <div>
                    <h2 class="font-semibold">6. Situação socioeconômica e agricultura</h2>
                    <p class="text-xs text-slate-500">Renda, programas sociais que a família recebe e, se houver, dados da produção agrícola.</p>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="{{ $label }}">Quantas pessoas residem no domicílio?</label><input x-model.number="form.qtd_pessoas_domicilio" type="number" min="0" class="{{ $input }}"></div>
                    <div><label class="{{ $label }}">Renda domiciliar (R$)</label><input x-model.number="form.renda_domiciliar" type="number" step="0.01" class="{{ $input }}"></div>
                </div>
                <div>
                    <label class="text-sm font-medium text-slate-600">A família é atendida por algum programa social?</label>
                    <div class="grid grid-cols-2 gap-1 mt-1 text-sm">
                        @foreach ($programasSociais as $slug => $nome)
                            <label class="flex items-center gap-1"><input type="checkbox" value="{{ $slug }}" @change="togglePrograma('{{ $slug }}')"> {{ $nome }}</label>
                        @endforeach
                    </div>
                </div>
                <p class="text-sm font-medium text-slate-600 border-t pt-3">Agricultura (se houver produção)</p>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="{{ $label }}">Tamanho da propriedade</label><input x-model="form.agricultura.tamanho_propriedade" class="{{ $input }}"></div>
                    <div><label class="{{ $label }}">Áreas de plantio (quantas, tamanho)</label><input x-model="form.agricultura.areas_plantio" class="{{ $input }}"></div>
                </div>
                <div><label class="{{ $label }}">Culturas</label><input x-model="form.agricultura.culturas" class="{{ $input }}"></div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="{{ $label }}">Tipo de cultivo</label>
                        <select x-model="form.agricultura.tipo_cultivo" class="{{ $input }}">
                            <option value="">Selecione…</option>
                            <option value="organico">Orgânico</option>
                            <option value="convencional">Convencional</option>
                        </select>
                    </div>
                    <div><label class="{{ $label }}">Renda média (R$)</label><input x-model.number="form.agricultura.renda_media" type="number" step="0.01" class="{{ $input }}"></div>
                </div>
                <div><label class="{{ $label }}">Pessoas que trabalham na propriedade</label><input x-model.number="form.agricultura.pessoas_trabalham" type="number" min="0" class="{{ $input }}"></div>
                <div><label class="{{ $label }}">Equipamentos e maquinários</label><input x-model="form.agricultura.equipamentos_maquinarios" class="{{ $input }}"></div>
                <x-sim-nao label="Tem barracão próprio?" model="form.agricultura.barracao_proprio" />
                <x-sim-nao label="Tem sistema de irrigação?" model="form.agricultura.sistema_irrigacao" />
                <div><label class="{{ $label }}">Observação (agricultura)</label><input x-model="form.agricultura.observacao" class="{{ $input }}"></div>
            </section>

            {{-- Passo 7: Preparação + revisão --}}
            <section x-show="passo === 7" class="space-y-3">
                <div>
                    <h2 class="font-semibold">7. Preparação e revisão</h2>
                    <p class="text-xs text-slate-500">Percepção de risco da família, ações ao perceber risco iminente e medidas sugeridas. Revise antes de finalizar.</p>
                </div>
                <x-sim-nao label="A família está cadastrada para receber alertas da Defesa Civil?" model="form.cadastrado_alertas" />
                <div><label class="{{ $label }}">Quando percebe que existe risco?</label><textarea x-model="form.percepcao_risco" rows="2" class="{{ $input }}"></textarea></div>
                <div><label class="{{ $label }}">Ao perceber risco iminente, o que a família faz?</label><textarea x-model="form.acao_risco_iminente" rows="2" class="{{ $input }}"></textarea></div>
                <div><label class="{{ $label }}">Medidas para reduzir os impactos dos desastres</label><textarea x-model="form.medidas_sugeridas" rows="2" class="{{ $input }}"></textarea></div>
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
