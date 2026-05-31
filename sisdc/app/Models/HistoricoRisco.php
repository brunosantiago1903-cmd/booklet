<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AreaAtencao;
use App\Enums\Criticidade;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistoricoRisco extends Model
{
    use HasFactory;

    protected $table = 'historico_riscos';

    protected $fillable = [
        'client_uuid',
        'cadastro_id',
        'tipo_evento',
        'criticidade',
        'descricao',
        'avaliado_em',
        'latitude',
        'longitude',
        'registrado_por_id',
    ];

    protected function casts(): array
    {
        return [
            'tipo_evento' => AreaAtencao::class,
            'criticidade' => Criticidade::class,
            'avaliado_em' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function cadastro(): BelongsTo
    {
        return $this->belongsTo(Cadastro::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por_id');
    }
}
