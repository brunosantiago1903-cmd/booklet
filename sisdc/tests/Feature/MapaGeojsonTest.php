<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Criticidade;
use App\Enums\Role;
use App\Models\Cadastro;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MapaGeojsonTest extends TestCase
{
    use RefreshDatabase;

    public function test_geojson_traz_apenas_cadastros_validados(): void
    {
        $user = User::factory()->create(['role' => Role::AUDITOR]);
        Cadastro::factory()->validado()->create(['nome_familia' => 'Família Validada']);
        Cadastro::factory()->create(['nome_familia' => 'Família Sincronizada']); // não validada

        $resp = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/mapa/cadastros.geojson');

        $resp->assertOk()
            ->assertJsonPath('type', 'FeatureCollection')
            ->assertJsonCount(1, 'features')
            ->assertJsonPath('features.0.properties.nome_familia', 'Família Validada')
            ->assertJsonPath('features.0.geometry.type', 'Point');
    }

    public function test_filtro_de_criticidade(): void
    {
        $user = User::factory()->create(['role' => Role::ADMINISTRADOR]);
        Cadastro::factory()->validado()->create(['criticidade_atual' => Criticidade::MUITO_ALTO->value]);
        Cadastro::factory()->validado()->create(['criticidade_atual' => Criticidade::BAIXO->value]);

        $resp = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/mapa/cadastros.geojson?criticidade[]=muito_alto');

        $resp->assertOk()
            ->assertJsonCount(1, 'features')
            ->assertJsonPath('features.0.properties.criticidade', 'muito_alto');
    }

    public function test_geojson_exige_autenticacao(): void
    {
        $this->getJson('/api/v1/mapa/cadastros.geojson')->assertUnauthorized();
    }
}
