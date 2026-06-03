<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Enums\Criticidade;
use App\Http\Controllers\Controller;
use App\Models\Cadastro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Fornece os cadastros validados como GeoJSON para o mapa Leaflet do painel.
 */
class MapaController extends Controller
{
    /**
     * GET /api/v1/mapa/cadastros.geojson
     *
     * Filtros opcionais:
     *  - criticidade[]=alto&criticidade[]=muito_alto
     *  - area_atencao=deslizamento
     *  - bbox=minLon,minLat,maxLon,maxLat (viewport do mapa)
     */
    public function geojson(Request $request): JsonResponse
    {
        $this->authorizeViewer($request);

        $query = Cadastro::query()
            ->where('status', 'validado')
            ->whereNotNull('localizacao');

        if ($criticidades = (array) $request->query('criticidade', [])) {
            $criticidades = array_values(array_filter(
                $criticidades,
                fn ($c) => Criticidade::tryFrom((string) $c) !== null,
            ));
            if ($criticidades !== []) {
                $query->whereIn('criticidade_atual', $criticidades);
            }
        }

        if ($area = $request->query('area_atencao')) {
            $query->whereJsonContains('areas_atencao', $area);
        }

        if ($bbox = $request->query('bbox')) {
            [$minLon, $minLat, $maxLon, $maxLat] = array_map('floatval', explode(',', $bbox));
            $query->whereRaw(
                'ST_Intersects(localizacao, ST_MakeEnvelope(?, ?, ?, ?, 4326)::geography)',
                [$minLon, $minLat, $maxLon, $maxLat],
            );
        }

        $cadastros = $query
            ->select([
                'id', 'codigo_sisdc', 'nome_familia', 'bairro', 'criticidade_atual',
                'qtd_pessoas_domicilio', 'precisa_abrigo', 'telefone_celular', 'areas_atencao',
                'operador_id',
                DB::raw('ST_Y(localizacao::geometry) as lat'),
                DB::raw('ST_X(localizacao::geometry) as lon'),
            ])
            ->with([
                'operador:id,name',
                'habitantes:id,cadastro_id,nome_completo,sexo,data_nascimento,tipo_sanguineo,responsavel_familiar',
                'vulnerabilidadeSaude:id,cadastro_id,possui_necessidades_especiais,necessita_medicacao,doenca_cronica',
            ])
            ->limit(5000)
            ->get();

        $features = $cadastros->map(function (Cadastro $c): array {
            $criticidade = $c->criticidade_atual;
            $vs = $c->vulnerabilidadeSaude;

            return [
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'Point',
                    'coordinates' => [(float) $c->getAttribute('lon'), (float) $c->getAttribute('lat')],
                ],
                'properties' => [
                    'id' => $c->id,
                    'codigo_sisdc' => $c->codigo_sisdc,
                    'nome_familia' => $c->nome_familia,
                    'bairro' => $c->bairro,
                    'telefone' => $c->telefone_celular,
                    'criticidade' => $criticidade->value,
                    'criticidade_label' => $criticidade->label(),
                    'cor' => $criticidade->color(),
                    'qtd_pessoas' => $c->qtd_pessoas_domicilio,
                    'precisa_abrigo' => $c->precisa_abrigo,
                    'operador' => $c->operador?->name,
                    'areas_atencao' => $c->areas_atencao,
                    'habitantes' => $c->habitantes->map(fn ($h): array => [
                        'nome' => $h->nome_completo,
                        'sexo' => $h->sexo,
                        'idade' => $h->data_nascimento?->age,
                        'tipo_sanguineo' => $h->tipo_sanguineo,
                        'responsavel' => (bool) $h->responsavel_familiar,
                    ])->values(),
                    'vulnerabilidade' => [
                        'necessidades_especiais' => (bool) ($vs?->possui_necessidades_especiais),
                        'necessita_medicacao' => (bool) ($vs?->necessita_medicacao),
                        'doenca_cronica' => (bool) ($vs?->doenca_cronica),
                    ],
                ],
            ];
        });

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]);
    }

    private function authorizeViewer(Request $request): void
    {
        abort_unless($request->user() !== null, 403);
    }
}
