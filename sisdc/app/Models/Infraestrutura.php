<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Infraestrutura extends Model
{
    use HasFactory;

    protected $fillable = [
        'cadastro_id',
        'captacao_agua',
        'captacao_agua_outro',
        'poco_nascente_localizacao',
        'poco_profundidade_m',
        'poco_latitude',
        'poco_longitude',
        'coleta_lixo',
        'lixo_organico_destino',
        'lixo_reciclavel_destino',
        'conhece_associacoes_reciclaveis',
        'associacao_reciclavel_qual',
        'coleta_seletiva_proxima',
        'observacoes_residuos',
        'saneamento_tipo',
        'saneamento_qual',
        'saneamento_localizacao',
    ];

    protected function casts(): array
    {
        return [
            'poco_profundidade_m' => 'float',
            'poco_latitude' => 'float',
            'poco_longitude' => 'float',
            'coleta_lixo' => 'boolean',
            'conhece_associacoes_reciclaveis' => 'boolean',
            'coleta_seletiva_proxima' => 'boolean',
        ];
    }

    public function cadastro(): BelongsTo
    {
        return $this->belongsTo(Cadastro::class);
    }
}
