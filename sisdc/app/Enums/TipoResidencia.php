<?php

declare(strict_types=1);

namespace App\Enums;

enum TipoResidencia: string
{
    case PROPRIA = 'propria';
    case VERANEIO = 'veraneio';
    case ALUGUEL = 'aluguel';
    case CEDIDA = 'cedida';
    case ABANDONADA = 'abandonada';
    case COMERCIAL = 'comercial';
    case EM_CONSTRUCAO = 'em_construcao';

    public function label(): string
    {
        return match ($this) {
            self::PROPRIA => 'Moradia propria',
            self::VERANEIO => 'Casa de veraneio',
            self::ALUGUEL => 'Casa de aluguel',
            self::CEDIDA => 'Casa cedida',
            self::ABANDONADA => 'Abandonada',
            self::COMERCIAL => 'Comercial',
            self::EM_CONSTRUCAO => 'Estrutura em construcao',
        };
    }
}
