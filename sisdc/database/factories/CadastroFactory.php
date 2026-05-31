<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\Criticidade;
use App\Enums\StatusCadastro;
use App\Models\Cadastro;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * @extends Factory<Cadastro>
 */
class CadastroFactory extends Factory
{
    protected $model = Cadastro::class;

    public function definition(): array
    {
        return [
            'client_uuid' => (string) Str::uuid(),
            'nome_familia' => 'Família '.fake()->lastName(),
            'bairro' => fake()->randomElement(['Centro', 'Porto de Cima', 'América de Baixo']),
            'latitude' => -25.4767,
            'longitude' => -48.8344,
            'criticidade_atual' => fake()->randomElement(Criticidade::cases())->value,
            'status' => StatusCadastro::SINCRONIZADO->value,
            'sincronizado_em' => now(),
        ];
    }

    public function validado(): static
    {
        return $this->state(fn (): array => ['status' => StatusCadastro::VALIDADO->value, 'validado_em' => now()]);
    }

    /**
     * Preenche a coluna geography a partir de latitude/longitude apos criar,
     * espelhando o que o CadastroSyncService faz em producao.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (Cadastro $cadastro): void {
            if ($cadastro->latitude !== null && $cadastro->longitude !== null) {
                DB::statement(
                    'UPDATE cadastros SET localizacao = ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography WHERE id = ?',
                    [$cadastro->longitude, $cadastro->latitude, $cadastro->id],
                );
            }
        });
    }
}
