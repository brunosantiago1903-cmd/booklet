<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'batch_uuid',
        'user_id',
        'device_id',
        'total_itens',
        'itens_criados',
        'itens_atualizados',
        'itens_ignorados',
        'itens_com_erro',
        'resultado',
    ];

    protected function casts(): array
    {
        return ['resultado' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
