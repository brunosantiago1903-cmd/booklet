<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>SISDC Morretes - Mapa de Risco</title>

    {{-- Leaflet --}}
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

    {{-- TailwindCSS (CDN apenas para o esqueleto; em producao usar build Vite) --}}
    <script src="https://cdn.tailwindcss.com"></script>

    <style>
        #mapa { height: calc(100vh - 4rem); }
        .leaflet-popup-content { font-size: 0.85rem; }
    </style>
</head>
<body class="bg-slate-100">
    <header class="h-16 bg-slate-900 text-white flex items-center px-4 gap-4">
        <h1 class="font-semibold text-lg">Defesa Civil de Morretes &mdash; Mapa de Risco</h1>
        <nav class="ml-auto flex items-center gap-3 text-sm" id="filtros-criticidade">
            <span class="text-slate-300">Criticidade:</span>
            @php
                $niveis = \App\Enums\Criticidade::cases();
            @endphp
            @foreach ($niveis as $nivel)
                <label class="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" value="{{ $nivel->value }}"
                           class="filtro-criticidade" checked>
                    <span class="inline-block w-3 h-3 rounded-full"
                          style="background: {{ $nivel->color() }}"></span>
                    {{ $nivel->label() }}
                </label>
            @endforeach
        </nav>
    </header>

    <div id="mapa"></div>

    <script>
        // Coordenadas centrais aproximadas de Morretes-PR.
        const MORRETES = [-25.4767, -48.8344];

        const map = L.map('mapa').setView(MORRETES, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        // Uma camada (LayerGroup) por nivel de criticidade -> liga/desliga via filtro.
        const camadas = {};
        document.querySelectorAll('.filtro-criticidade').forEach((cb) => {
            camadas[cb.value] = L.layerGroup().addTo(map);
            cb.addEventListener('change', () => {
                cb.checked ? camadas[cb.value].addTo(map) : map.removeLayer(camadas[cb.value]);
            });
        });

        function criticidadesAtivas() {
            return Array.from(document.querySelectorAll('.filtro-criticidade:checked'))
                .map((cb) => cb.value);
        }

        async function carregarCadastros() {
            const params = new URLSearchParams();
            criticidadesAtivas().forEach((c) => params.append('criticidade[]', c));

            const b = map.getBounds();
            params.set('bbox', [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','));

            const resp = await fetch(`/api/v1/mapa/cadastros.geojson?${params}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'same-origin',
            });
            if (!resp.ok) return;
            const geojson = await resp.json();

            Object.values(camadas).forEach((c) => c.clearLayers());

            L.geoJSON(geojson, {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: feature.properties.cor,
                    color: '#1f2937',
                    weight: 1,
                    fillOpacity: 0.85,
                }),
                onEachFeature: (feature, layer) => {
                    const p = feature.properties;
                    layer.bindPopup(`
                        <strong>${p.nome_familia ?? 'Sem nome'}</strong><br>
                        SISDC: ${p.codigo_sisdc ?? '-'}<br>
                        Bairro: ${p.bairro ?? '-'}<br>
                        Criticidade: <b style="color:${p.cor}">${p.criticidade_label}</b><br>
                        Pessoas: ${p.qtd_pessoas ?? '-'} ·
                        Abrigo: ${p.precisa_abrigo ? 'Sim' : 'Nao'}
                    `);
                    const destino = camadas[p.criticidade];
                    if (destino) destino.addLayer(layer);
                },
            });
        }

        map.on('moveend', carregarCadastros);
        carregarCadastros();
    </script>
</body>
</html>
