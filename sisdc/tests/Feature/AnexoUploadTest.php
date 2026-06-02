<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Anexo;
use App\Models\Cadastro;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class AnexoUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_operador_envia_foto_e_fica_no_disco_privado(): void
    {
        Storage::fake('local');
        $operador = User::factory()->create(['role' => Role::OPERADOR]);
        $cadastro = Cadastro::factory()->create();
        $uuid = (string) Str::uuid();

        $resp = $this->actingAs($operador, 'sanctum')->postJson('/api/v1/sync/anexos', [
            'client_uuid' => $uuid,
            'cadastro_client_uuid' => $cadastro->client_uuid,
            'categoria' => 'residencia',
            'file' => UploadedFile::fake()->image('casa.jpg', 800, 600),
        ]);

        $resp->assertCreated();
        $this->assertDatabaseHas('anexos', [
            'client_uuid' => $uuid,
            'categoria' => 'residencia',
            'anexavel_id' => $cadastro->id,
            'disk' => 'local',
        ]);
        Storage::disk('local')->assertExists(Anexo::where('client_uuid', $uuid)->first()->path);
    }

    public function test_reenvio_do_mesmo_uuid_nao_duplica(): void
    {
        Storage::fake('local');
        $operador = User::factory()->create(['role' => Role::OPERADOR]);
        $cadastro = Cadastro::factory()->create();
        $uuid = (string) Str::uuid();
        $payload = fn () => [
            'client_uuid' => $uuid,
            'cadastro_client_uuid' => $cadastro->client_uuid,
            'categoria' => 'risco',
            'file' => UploadedFile::fake()->image('r.jpg'),
        ];

        $this->actingAs($operador, 'sanctum')->postJson('/api/v1/sync/anexos', $payload())->assertCreated();
        $this->actingAs($operador, 'sanctum')->postJson('/api/v1/sync/anexos', $payload())->assertOk();

        $this->assertSame(1, Anexo::where('client_uuid', $uuid)->count());
    }

    public function test_foto_servida_apenas_autenticado(): void
    {
        Storage::fake('local');
        $cadastro = Cadastro::factory()->create();
        $anexo = $cadastro->anexos()->create([
            'client_uuid' => (string) Str::uuid(),
            'categoria' => 'residencia',
            'disk' => 'local',
            'path' => 'anexos/x.jpg',
        ]);
        Storage::disk('local')->put('anexos/x.jpg', 'conteudo');

        $this->get("/anexos/{$anexo->id}")->assertRedirect('/login'); // visitante

        $auditor = User::factory()->create(['role' => Role::AUDITOR]);
        $this->actingAs($auditor)->get("/anexos/{$anexo->id}")->assertOk();
    }
}
