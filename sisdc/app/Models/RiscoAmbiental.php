<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiscoAmbiental extends Model
{
    use HasFactory;

    protected $table = 'riscos_ambientais';

    protected $fillable = [
        'cadastro_id',
        'potencialmente_inundavel',
        'escoamento_propriedade',
        'escoamento_rua',
        'escoamento_rua_descricao',
        'acumulo_agua',
        'acumulo_agua_onde',
        'historico_deslizamento',
        'historico_deslizamento_descricao',
        'risco_deslizamento_atual',
        'risco_deslizamento_observacoes',
        'relevo_descricao',
        'solo_exposto',
        'solo_exposto_observacoes',
        'erosao_expressiva',
        'erosao_expressiva_observacoes',
        'rio_passa_propriedade',
        'rio_nome',
        'rio_largura',
        'mata_ciliar',
        'mata_ciliar_observacoes',
        'erosao_beira_rio',
        'erosao_beira_rio_observacoes',
        'rio_assoreado',
    ];

    protected function casts(): array
    {
        return [
            'potencialmente_inundavel' => 'boolean',
            'escoamento_rua' => 'boolean',
            'acumulo_agua' => 'boolean',
            'historico_deslizamento' => 'boolean',
            'risco_deslizamento_atual' => 'boolean',
            'solo_exposto' => 'boolean',
            'erosao_expressiva' => 'boolean',
            'rio_passa_propriedade' => 'boolean',
            'erosao_beira_rio' => 'boolean',
            'rio_assoreado' => 'boolean',
        ];
    }

    public function cadastro(): BelongsTo
    {
        return $this->belongsTo(Cadastro::class);
    }
}
