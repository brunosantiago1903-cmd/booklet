<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Valida o upload de uma foto/anexo do PWA (multipart) após o cadastro sincronizar.
 */
class StoreAnexoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role?->canSync();
    }

    public function rules(): array
    {
        return [
            'client_uuid' => ['required', 'uuid'],
            'cadastro_client_uuid' => ['required', 'uuid', 'exists:cadastros,client_uuid'],
            'categoria' => ['required', 'string', 'in:residencia,poco,saneamento,risco,outro'],
            'legenda' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'capturado_em' => ['nullable', 'date'],
            'file' => ['required', 'image', 'max:8192'], // até 8 MB
        ];
    }
}
