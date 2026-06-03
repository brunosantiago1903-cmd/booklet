<div class="max-w-4xl mx-auto space-y-4">
    <h1 class="text-xl font-semibold">Usuários</h1>
    <p class="text-sm text-slate-500">Cadastre os operadores que vão a campo (e demais perfis). Operadores inativos não conseguem entrar nem sincronizar.</p>

    @if (session('ok'))
        <div class="rounded bg-green-50 text-green-700 text-sm p-3">{{ session('ok') }}</div>
    @endif
    @if (session('erro'))
        <div class="rounded bg-red-50 text-red-700 text-sm p-3">{{ session('erro') }}</div>
    @endif

    {{-- Adicionar usuário --}}
    <form wire:submit="criar" class="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 class="font-semibold">Adicionar usuário</h2>
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-xs text-slate-600 mb-0.5">Nome</label>
                <input wire:model="nome" class="w-full rounded border-slate-300 text-sm">
                @error('nome') <span class="text-red-600 text-xs">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-xs text-slate-600 mb-0.5">E-mail (login)</label>
                <input wire:model="email" type="email" class="w-full rounded border-slate-300 text-sm">
                @error('email') <span class="text-red-600 text-xs">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-xs text-slate-600 mb-0.5">Perfil</label>
                <select wire:model="perfil" class="w-full rounded border-slate-300 text-sm">
                    @foreach ($perfis as $p)
                        <option value="{{ $p->value }}">{{ $p->label() }}</option>
                    @endforeach
                </select>
            </div>
            <div>
                <label class="block text-xs text-slate-600 mb-0.5">Senha (mín. 8 caracteres)</label>
                <input wire:model="senha" type="password" class="w-full rounded border-slate-300 text-sm">
                @error('senha') <span class="text-red-600 text-xs">{{ $message }}</span> @enderror
            </div>
        </div>
        <button type="submit" class="px-4 py-2 rounded bg-slate-900 text-white text-sm">Adicionar usuário</button>
    </form>

    {{-- Lista --}}
    <div class="flex items-center gap-2">
        <input wire:model.live.debounce.400ms="busca" type="search" placeholder="Buscar nome ou e-mail…"
               class="ml-auto rounded border-slate-300 text-sm w-64">
    </div>
    <div class="bg-white rounded-xl shadow overflow-hidden">
        <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-500 text-left">
                <tr><th class="p-3">Nome</th><th class="p-3">E-mail</th><th class="p-3">Perfil</th><th class="p-3">Status</th><th class="p-3 text-right">Ações</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse ($usuarios as $u)
                    <tr wire:key="user-{{ $u->id }}">
                        <td class="p-3 font-medium">{{ $u->name }}</td>
                        <td class="p-3">{{ $u->email }}</td>
                        <td class="p-3">{{ $u->role->label() }}</td>
                        <td class="p-3">
                            <span @class([
                                'text-xs font-medium px-2 py-0.5 rounded',
                                'bg-green-100 text-green-700' => $u->ativo,
                                'bg-slate-200 text-slate-600' => ! $u->ativo,
                            ])>{{ $u->ativo ? 'Ativo' : 'Inativo' }}</span>
                        </td>
                        <td class="p-3 text-right whitespace-nowrap">
                            <button wire:click="abrirRedefinicao({{ $u->id }})" class="text-slate-700 hover:underline">Redefinir senha</button>
                            @if ($u->id !== auth()->id())
                                <button wire:click="alternarAtivo({{ $u->id }})"
                                        wire:confirm="{{ $u->ativo ? 'Desativar' : 'Ativar' }} este usuário?"
                                        class="ml-3 {{ $u->ativo ? 'text-red-700' : 'text-green-700' }} hover:underline">
                                    {{ $u->ativo ? 'Desativar' : 'Ativar' }}
                                </button>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="5" class="p-6 text-center text-slate-400">Nenhum usuário encontrado.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>

    <div>{{ $usuarios->links() }}</div>

    {{-- Modal redefinir senha --}}
    @if ($redefinindoId)
        <div class="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 space-y-3">
                <h2 class="font-semibold">Redefinir senha</h2>
                <input wire:model="novaSenha" type="password" placeholder="Nova senha (mín. 8)"
                       class="w-full rounded border-slate-300 text-sm">
                @error('novaSenha') <p class="text-red-600 text-sm">{{ $message }}</p> @enderror
                <div class="flex justify-end gap-2">
                    <button wire:click="$set('redefinindoId', null)" class="text-sm px-3 py-1.5 rounded border">Cancelar</button>
                    <button wire:click="redefinirSenha" class="text-sm px-3 py-1.5 rounded bg-slate-900 text-white">Salvar</button>
                </div>
            </div>
        </div>
    @endif
</div>
