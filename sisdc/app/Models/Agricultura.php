<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Agricultura extends Model
{
    use HasFactory;

    protected $fillable = [
        'cadastro_id',
        'tamanho_propriedade',
        'areas_plantio',
        'culturas',
        'tipo_cultivo',
        'renda_media',
        'pessoas_trabalham',
        'equipamentos_maquinarios',
        'barracao_proprio',
        'sistema_irrigacao',
        'observacao',
    ];

    protected function casts(): array
    {
        return [
            'renda_media' => 'decimal:2',
            'pessoas_trabalham' => 'integer',
            'barracao_proprio' => 'boolean',
            'sistema_irrigacao' => 'boolean',
        ];
    }

    public function cadastro(): BelongsTo
    {
        return $this->belongsTo(Cadastro::class);
    }
}
