<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Anexo;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Serve as fotos do disco privado apenas para usuários autenticados (LGPD).
 */
class AnexoController extends Controller
{
    public function show(Anexo $anexo): StreamedResponse
    {
        $disk = Storage::disk($anexo->disk ?: 'local');

        abort_unless($disk->exists($anexo->path), 404);

        return $disk->response($anexo->path);
    }
}
