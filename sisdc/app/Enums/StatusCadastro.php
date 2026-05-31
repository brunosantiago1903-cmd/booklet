<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Ciclo de vida do cadastro dentro do fluxo offline -> sincronizacao -> auditoria.
 *
 * - RASCUNHO: criado/editado no tablet (estado local no IndexedDB).
 * - SINCRONIZADO: recebido pela API, aguardando validacao do auditor.
 * - VALIDADO: auditado e liberado para consumo no mapa do painel.
 * - REJEITADO: auditor recusou; retorna para correcao em campo.
 */
enum StatusCadastro: string
{
    case RASCUNHO = 'rascunho';
    case SINCRONIZADO = 'sincronizado';
    case VALIDADO = 'validado';
    case REJEITADO = 'rejeitado';

    public function label(): string
    {
        return match ($this) {
            self::RASCUNHO => 'Rascunho',
            self::SINCRONIZADO => 'Sincronizado',
            self::VALIDADO => 'Validado',
            self::REJEITADO => 'Rejeitado',
        };
    }
}
