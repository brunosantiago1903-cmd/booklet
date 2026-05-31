<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Criticidade;
use App\Enums\PadraoConstrutivo;
use App\Enums\StatusCadastro;
use App\Enums\TipoResidencia;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Cadastro principal (domicilio/ocorrencia).
 *
 * A coluna espacial `localizacao` (geography(POINT,4326)) e mantida pelo
 * CadastroSyncService a partir de latitude/longitude, evitando acoplar o
 * model a uma API de cast espacial especifica.
 */
class Cadastro extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'cadastros';

    protected $fillable = [
        'client_uuid',
        'codigo_sisdc',
        'codigo_interno',
        'areas_atencao',
        'nome_familia',
        'cep',
        'endereco',
        'numero',
        'complemento',
        'bairro',
        'cidade',
        'uf',
        'padrao_construtivo',
        'telefone_fixo',
        'telefone_celular',
        'latitude',
        'longitude',
        'precisao_gps_m',
        'tipo_residencia',
        'precisa_abrigo',
        'moradores_encontrados',
        'qtd_pessoas_domicilio',
        'renda_domiciliar',
        'atendido_programa_social',
        'percepcao_risco',
        'acao_risco_iminente',
        'cadastrado_alertas',
        'medidas_sugeridas',
        'criticidade_atual',
        'status',
        'device_id',
        'coletado_em',
        'sincronizado_em',
        'validado_em',
        'motivo_rejeicao',
        'operador_id',
        'validado_por_id',
    ];

    protected function casts(): array
    {
        return [
            'areas_atencao' => 'array',
            'latitude' => 'float',
            'longitude' => 'float',
            'precisao_gps_m' => 'float',
            'precisa_abrigo' => 'boolean',
            'moradores_encontrados' => 'boolean',
            'atendido_programa_social' => 'boolean',
            'cadastrado_alertas' => 'boolean',
            'renda_domiciliar' => 'decimal:2',
            'padrao_construtivo' => PadraoConstrutivo::class,
            'tipo_residencia' => TipoResidencia::class,
            'criticidade_atual' => Criticidade::class,
            'status' => StatusCadastro::class,
            'coletado_em' => 'datetime',
            'sincronizado_em' => 'datetime',
            'validado_em' => 'datetime',
        ];
    }

    public function habitantes(): HasMany
    {
        return $this->hasMany(Habitante::class);
    }

    public function vulnerabilidadeSaude(): HasOne
    {
        return $this->hasOne(VulnerabilidadeSaude::class);
    }

    public function infraestrutura(): HasOne
    {
        return $this->hasOne(Infraestrutura::class);
    }

    public function riscoAmbiental(): HasOne
    {
        return $this->hasOne(RiscoAmbiental::class);
    }

    public function agricultura(): HasOne
    {
        return $this->hasOne(Agricultura::class);
    }

    public function historicoRiscos(): HasMany
    {
        return $this->hasMany(HistoricoRisco::class)->orderByDesc('avaliado_em');
    }

    public function programasSociais(): BelongsToMany
    {
        return $this->belongsToMany(ProgramaSocial::class, 'cadastro_programa_social')
            ->withPivot('observacao')
            ->withTimestamps();
    }

    public function anexos(): MorphMany
    {
        return $this->morphMany(Anexo::class, 'anexavel');
    }

    public function operador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operador_id');
    }

    public function validadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validado_por_id');
    }
}
