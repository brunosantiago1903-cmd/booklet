<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\Criticidade;
use App\Enums\StatusCadastro;
use App\Models\Cadastro;
use Illuminate\Database\Eloquent\Factories\Factory;
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
}
