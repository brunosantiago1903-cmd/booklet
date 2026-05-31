<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Nivel de criticidade do risco. Usado no historico de risco e como base
 * para as camadas/filtros do mapa do painel administrativo.
 */
enum Criticidade: string
{
    case SEM_RISCO = 'sem_risco';
    case BAIXO = 'baixo';
    case MEDIO = 'medio';
    case ALTO = 'alto';
    case MUITO_ALTO = 'muito_alto';

    public function label(): string
    {
        return match ($this) {
            self::SEM_RISCO => 'Sem risco',
            self::BAIXO => 'Baixo',
            self::MEDIO => 'Medio',
            self::ALTO => 'Alto',
            self::MUITO_ALTO => 'Muito alto',
        };
    }

    /**
     * Cor padrao (hex) usada nos marcadores do Leaflet.
     */
    public function color(): string
    {
        return match ($this) {
            self::SEM_RISCO => '#16a34a',
            self::BAIXO => '#84cc16',
            self::MEDIO => '#eab308',
            self::ALTO => '#f97316',
            self::MUITO_ALTO => '#dc2626',
        };
    }

    /**
     * Peso numerico para ordenacao/priorizacao.
     */
    public function weight(): int
    {
        return match ($this) {
            self::SEM_RISCO => 0,
            self::BAIXO => 1,
            self::MEDIO => 2,
            self::ALTO => 3,
            self::MUITO_ALTO => 4,
        };
    }
}
