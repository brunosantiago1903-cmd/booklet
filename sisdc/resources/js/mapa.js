// Mapa de risco do painel (Leaflet empacotado, sem CDN).
import L from 'leaflet';

// Corrige os caminhos dos ícones padrão do Leaflet quando empacotado pelo Vite.
import marker from 'leaflet/dist/images/marker-icon.png';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({ iconRetinaUrl: marker2x, iconUrl: marker, shadowUrl: shadow });

const MORRETES = [-25.4767, -48.8344];

export function initMapa() {
    const el = document.getElementById('mapa');
    if (!el) return;

    const map = L.map('mapa').setView(MORRETES, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
    }).addTo(map);

    // Uma camada por nível de criticidade (liga/desliga via filtros).
    const camadas = {};
    document.querySelectorAll('.filtro-criticidade').forEach((cb) => {
        camadas[cb.value] = L.layerGroup().addTo(map);
        cb.addEventListener('change', () => {
            cb.checked ? camadas[cb.value].addTo(map) : map.removeLayer(camadas[cb.value]);
            carregar();
        });
    });

    const ativas = () => Array.from(document.querySelectorAll('.filtro-criticidade:checked')).map((c) => c.value);

    async function carregar() {
        const params = new URLSearchParams();
        ativas().forEach((c) => params.append('criticidade[]', c));
        const b = map.getBounds();
        params.set('bbox', [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','));

        const resp = await fetch(`/painel/mapa/cadastros.geojson?${params}`, {
            headers: { Accept: 'application/json' },
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
                layer.bindPopup(
                    `<strong>${p.nome_familia ?? 'Sem nome'}</strong><br>` +
                    `SISDC: ${p.codigo_sisdc ?? '-'}<br>` +
                    `Bairro: ${p.bairro ?? '-'}<br>` +
                    `Criticidade: <b style="color:${p.cor}">${p.criticidade_label}</b><br>` +
                    `Pessoas: ${p.qtd_pessoas ?? '-'} · Abrigo: ${p.precisa_abrigo ? 'Sim' : 'Não'}`,
                );
                const destino = camadas[p.criticidade];
                if (destino) destino.addLayer(layer);
            },
        });
    }

    map.on('moveend', carregar);
    carregar();
}
