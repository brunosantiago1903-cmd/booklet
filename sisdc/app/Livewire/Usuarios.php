<?php

declare(strict_types=1);

namespace App\Livewire;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Livewire\Attributes\Url;
use Livewire\Component;
use Livewire\WithPagination;

/**
 * Gestão de usuários do painel (somente Administrador): cadastra operadores de
 * campo e demais perfis, ativa/desativa e redefine senhas.
 */
class Usuarios extends Component
{
    use WithPagination;

    // Formulário de criação.
    public string $nome = '';

    public string $email = '';

    public string $perfil = Role::OPERADOR->value;

    public string $senha = '';

    #[Url]
    public string $busca = '';

    // Redefinição de senha (modal inline).
    public ?int $redefinindoId = null;

    public string $novaSenha = '';

    public function mount(): void
    {
        abort_unless((bool) auth()->user()?->role?->canManageUsers(), 403);
    }

    public function updatingBusca(): void
    {
        $this->resetPage();
    }

    public function criar(): void
    {
        $this->autorizar();

        $dados = $this->validate([
            'nome' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'perfil' => ['required', Rule::enum(Role::class)],
            'senha' => ['required', 'string', 'min:8'],
        ]);

        $user = User::create([
            'name' => $dados['nome'],
            'email' => $dados['email'],
            'role' => $dados['perfil'],
            'password' => Hash::make($dados['senha']),
            'ativo' => true,
        ]);

        session()->flash('ok', "Usuário {$user->email} criado.");
        $this->reset(['nome', 'email', 'senha']);
        $this->perfil = Role::OPERADOR->value;
    }

    public function alternarAtivo(int $id): void
    {
        $this->autorizar();

        $user = User::findOrFail($id);
        // O admin não pode desativar a si mesmo (evita se trancar para fora).
        if ($user->id === auth()->id()) {
            session()->flash('erro', 'Você não pode desativar a sua própria conta.');

            return;
        }

        $user->update(['ativo' => ! $user->ativo]);
        session()->flash('ok', $user->ativo ? 'Usuário ativado.' : 'Usuário desativado.');
    }

    public function abrirRedefinicao(int $id): void
    {
        $this->redefinindoId = $id;
        $this->novaSenha = '';
    }

    public function redefinirSenha(): void
    {
        $this->autorizar();

        $this->validate(['novaSenha' => ['required', 'string', 'min:8']]);

        $user = User::findOrFail($this->redefinindoId);
        $user->update(['password' => Hash::make($this->novaSenha)]);

        session()->flash('ok', "Senha de {$user->email} redefinida.");
        $this->reset(['redefinindoId', 'novaSenha']);
    }

    private function autorizar(): void
    {
        abort_unless((bool) auth()->user()?->role?->canManageUsers(), 403);
    }

    public function render(): View
    {
        $usuarios = User::query()
            ->when($this->busca !== '', function ($q): void {
                $q->where(function ($w): void {
                    $w->where('name', 'ilike', "%{$this->busca}%")
                        ->orWhere('email', 'ilike', "%{$this->busca}%");
                });
            })
            ->orderBy('name')
            ->paginate(15);

        return view('livewire.usuarios', [
            'usuarios' => $usuarios,
            'perfis' => Role::cases(),
        ])->layout('components.layouts.app', ['title' => 'Usuários · SISDC']);
    }
}
