<?php

declare(strict_types=1);

namespace App\Livewire;

use App\Enums\StatusCadastro;
use App\Models\Cadastro;
use Illuminate\Contracts\View\View;
use Livewire\Attributes\Url;
use Livewire\Component;
use Livewire\WithPagination;

/**
 * Painel de auditoria: o auditor revisa cadastros sincronizados e os
 * valida (libera para o mapa) ou rejeita (retorna para correcao em campo).
 */
class Auditoria extends Component
{
    use WithPagination;

    #[Url]
    public string $status = StatusCadastro::SINCRONIZADO->value;

    #[Url]
    public string $busca = '';

    public ?int $rejeitandoId = null;

    public string $motivoRejeicao = '';

    public function mount(): void
    {
        abort_unless(auth()->user()?->role->canValidate(), 403);
    }

    public function updatingStatus(): void
    {
        $this->resetPage();
    }

    public function updatingBusca(): void
    {
        $this->resetPage();
    }

    public function validar(int $id): void
    {
        abort_unless(auth()->user()?->role->canValidate(), 403);

        $cadastro = Cadastro::findOrFail($id);
        $cadastro->update([
            'status' => StatusCadastro::VALIDADO,
            'validado_em' => now(),
            'validado_por_id' => auth()->id(),
            'motivo_rejeicao' => null,
        ]);

        session()->flash('ok', "Cadastro #{$id} validado.");
    }

    public function abrirRejeicao(int $id): void
    {
        $this->rejeitandoId = $id;
        $this->motivoRejeicao = '';
    }

    public function rejeitar(): void
    {
        abort_unless(auth()->user()?->role->canValidate(), 403);

        $this->validate([
            'motivoRejeicao' => ['required', 'string', 'min:5', 'max:500'],
        ], attributes: ['motivoRejeicao' => 'motivo']);

        $cadastro = Cadastro::findOrFail($this->rejeitandoId);
        $cadastro->update([
            'status' => StatusCadastro::REJEITADO,
            'motivo_rejeicao' => $this->motivoRejeicao,
            'validado_por_id' => auth()->id(),
        ]);

        session()->flash('ok', "Cadastro #{$this->rejeitandoId} rejeitado.");
        $this->reset(['rejeitandoId', 'motivoRejeicao']);
    }

    public function render(): View
    {
        $cadastros = Cadastro::query()
            ->when($this->status !== '', fn ($q) => $q->where('status', $this->status))
            ->when($this->busca !== '', function ($q): void {
                $q->where(function ($w): void {
                    $w->where('nome_familia', 'ilike', "%{$this->busca}%")
                        ->orWhere('codigo_sisdc', 'ilike', "%{$this->busca}%")
                        ->orWhere('bairro', 'ilike', "%{$this->busca}%");
                });
            })
            ->withCount('habitantes')
            ->with('operador:id,name')
            ->orderByDesc('sincronizado_em')
            ->paginate(15);

        return view('livewire.auditoria', [
            'cadastros' => $cadastros,
            'statuses' => StatusCadastro::cases(),
        ])->layout('components.layouts.app', ['title' => 'Auditoria · SISDC']);
    }
}
