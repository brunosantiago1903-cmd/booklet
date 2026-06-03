<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VulnerabilidadeSaude extends Model
{
    use HasFactory;

    protected $table = 'vulnerabilidade_saude';

    protected $fillable = [
        'cadastro_id',
        'possui_necessidades_especiais',
        'necessidades_especiais',
        'necessita_medicacao',
        'medicacao_qual',
        'restricao_medicamento',
        'doenca_cronica',
        'doenca_cronica_qual',
        'alergias',
        'animais_caes',
        'animais_gatos',
        'animais_aves',
        'animais_outros',
    ];

    protected function casts(): array
    {
        return [
            'possui_necessidades_especiais' => 'boolean',
            'necessita_medicacao' => 'boolean',
            'doenca_cronica' => 'boolean',
            'animais_caes' => 'integer',
            'animais_gatos' => 'integer',
            'animais_aves' => 'integer',
        ];
    }

    public function cadastro(): BelongsTo
    {
        return $this->belongsTo(Cadastro::class);
    }
}
