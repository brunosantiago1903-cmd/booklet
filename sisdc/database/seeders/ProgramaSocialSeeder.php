<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\ProgramaSocial;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ProgramaSocialSeeder extends Seeder
{
    public function run(): void
    {
        $programas = [
            'Bolsa Familia',
            'Cartao Comida Boa',
            'Auxilio Gas',
            'Programa do Leite',
            'Baixa Renda da Luz',
            'Tarifa Social da Agua',
            'Passe Livre',
            'Beneficio de Prestacao Continuada',
            'Programa de Aquisicao de Alimentos',
            'Carteira da Pessoa Idosa',
        ];

        foreach ($programas as $nome) {
            ProgramaSocial::updateOrCreate(
                ['slug' => Str::slug($nome)],
                ['nome' => $nome, 'ativo' => true],
            );
        }
    }
}
