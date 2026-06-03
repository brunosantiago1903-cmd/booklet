<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Papeis de acesso (RBAC) do sistema.
 *
 * - ADMINISTRADOR: acesso total, gestao de usuarios e configuracoes.
 * - AUDITOR: valida/rejeita cadastros sincronizados e visualiza relatorios.
 * - OPERADOR: equipe de campo; cria/edita cadastros (origem do sync offline).
 */
enum Role: string
{
    case ADMINISTRADOR = 'administrador';
    case AUDITOR = 'auditor';
    case OPERADOR = 'operador';

    public function label(): string
    {
        return match ($this) {
            self::ADMINISTRADOR => 'Administrador',
            self::AUDITOR => 'Auditor',
            self::OPERADOR => 'Operador de Campo',
        };
    }

    /**
     * Pode validar/auditar cadastros sincronizados.
     */
    public function canValidate(): bool
    {
        return in_array($this, [self::ADMINISTRADOR, self::AUDITOR], true);
    }

    /**
     * Pode enviar dados de campo (sincronizacao offline).
     */
    public function canSync(): bool
    {
        return in_array($this, [self::ADMINISTRADOR, self::OPERADOR], true);
    }

    /**
     * Pode gerenciar usuários (somente Administrador).
     */
    public function canManageUsers(): bool
    {
        return $this === self::ADMINISTRADOR;
    }
}
