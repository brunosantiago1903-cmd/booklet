<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Anexo extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_uuid',
        'categoria',
        'legenda',
        'disk',
        'path',
        'mime',
        'tamanho_bytes',
        'latitude',
        'longitude',
        'capturado_em',
    ];

    protected function casts(): array
    {
        return [
            'tamanho_bytes' => 'integer',
            'latitude' => 'float',
            'longitude' => 'float',
            'capturado_em' => 'datetime',
        ];
    }

    public function anexavel(): MorphTo
    {
        return $this->morphTo();
    }
}
