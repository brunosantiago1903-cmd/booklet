<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Habitante extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_uuid',
        'cadastro_id',
        'nome_completo',
        'cpf',
        'data_nascimento',
        'sexo',
        'celular',
        'escolaridade_nivel',
        'escolaridade_situacao',
        'trabalha',
        'trabalho_tipo',
        'deslocamento_meio',
        'deslocamento_tempo',
        'tipo_sanguineo',
        'responsavel_familiar',
    ];

    protected function casts(): array
    {
        return [
            'data_nascimento' => 'date',
            'trabalha' => 'boolean',
            'responsavel_familiar' => 'boolean',
        ];
    }

    public function cadastro(): BelongsTo
    {
        return $this->belongsTo(Cadastro::class);
    }
}
