<?php

declare(strict_types=1);

namespace App\Enums;

enum PadraoConstrutivo: string
{
    case ALVENARIA = 'alvenaria';
    case MADEIRA = 'madeira';
    case MISTO = 'misto';
    case BIOCONSTRUCAO = 'bioconstrucao';

    public function label(): string
    {
        return match ($this) {
            self::ALVENARIA => 'Alvenaria',
            self::MADEIRA => 'Madeira',
            self::MISTO => 'Misto',
            self::BIOCONSTRUCAO => 'Bioconstrucao',
        };
    }
}
