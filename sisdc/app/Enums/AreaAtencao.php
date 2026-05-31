<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Tipos de evento/area de atencao associados ao cadastro e ao historico de risco.
 * Espelha o campo "Area de atencao associada" do formulario de campo.
 */
enum AreaAtencao: string
{
    case DESLIZAMENTO = 'deslizamento';
    case ALAGAMENTO = 'alagamento';
    case INUNDACAO = 'inundacao';
    case ENXURRADA = 'enxurrada';
    case VENDAVAL_CICLONE = 'vendaval_ciclone';

    public function label(): string
    {
        return match ($this) {
            self::DESLIZAMENTO => 'Deslizamento',
            self::ALAGAMENTO => 'Alagamento',
            self::INUNDACAO => 'Inundacao',
            self::ENXURRADA => 'Enxurrada',
            self::VENDAVAL_CICLONE => 'Vendaval / Ciclone',
        };
    }
}
