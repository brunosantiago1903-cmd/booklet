<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ProgramaSocial extends Model
{
    use HasFactory;

    protected $table = 'programas_sociais';

    protected $fillable = ['slug', 'nome', 'ativo'];

    protected function casts(): array
    {
        return ['ativo' => 'boolean'];
    }

    public function cadastros(): BelongsToMany
    {
        return $this->belongsToMany(Cadastro::class, 'cadastro_programa_social')
            ->withPivot('observacao')
            ->withTimestamps();
    }
}
