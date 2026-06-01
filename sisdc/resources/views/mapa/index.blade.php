<x-layouts.app title="Mapa de Risco · SISDC">
    <div class="flex flex-wrap items-center gap-3 mb-3">
        <h1 class="text-lg font-semibold">Mapa de Risco</h1>
        <div class="ml-auto flex flex-wrap items-center gap-3 text-sm">
            <span class="text-slate-500">Criticidade:</span>
            @foreach (\App\Enums\Criticidade::cases() as $nivel)
                <label class="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" value="{{ $nivel->value }}" class="filtro-criticidade" checked>
                    <span class="inline-block w-3 h-3 rounded-full" style="background: {{ $nivel->color() }}"></span>
                    {{ $nivel->label() }}
                </label>
            @endforeach
        </div>
    </div>

    <div id="mapa" class="h-[72vh] min-h-[420px] rounded-xl shadow overflow-hidden"></div>
    <p class="text-xs text-slate-500 mt-2">Apenas cadastros validados. Mova o mapa para recarregar a área visível; clique num ponto para detalhes.</p>
</x-layouts.app>
