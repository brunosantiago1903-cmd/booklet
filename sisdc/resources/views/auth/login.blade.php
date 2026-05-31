<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SISDC Morretes &mdash; Acesso</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen flex items-center justify-center">
    <div class="w-full max-w-sm bg-white rounded-xl shadow p-8">
        <h1 class="text-xl font-semibold text-slate-800 mb-1">Defesa Civil de Morretes</h1>
        <p class="text-sm text-slate-500 mb-6">Sistema de Gestao (SISDC)</p>

        @if ($errors->any())
            <div class="mb-4 rounded bg-red-50 text-red-700 text-sm p-3">
                {{ $errors->first() }}
            </div>
        @endif

        <form method="POST" action="{{ route('login.attempt') }}" class="space-y-4">
            @csrf
            <div>
                <label class="block text-sm text-slate-600 mb-1">E-mail</label>
                <input type="email" name="email" value="{{ old('email') }}" required autofocus
                       class="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            </div>
            <div>
                <label class="block text-sm text-slate-600 mb-1">Senha</label>
                <input type="password" name="password" required
                       class="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="remember"> Manter conectado
            </label>
            <button type="submit"
                    class="w-full bg-slate-900 text-white rounded py-2 text-sm font-medium hover:bg-slate-800">
                Entrar
            </button>
        </form>
    </div>
</body>
</html>
