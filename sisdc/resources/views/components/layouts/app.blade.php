<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'SISDC Morretes' }}</title>

    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#0f172a">

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="bg-slate-100 min-h-screen text-slate-800">
    <header class="h-14 bg-slate-900 text-white flex items-center px-4 gap-4">
        <a href="{{ route('mapa') }}" class="font-semibold">SISDC · Defesa Civil de Morretes</a>
        <nav class="ml-auto flex items-center gap-4 text-sm">
            <a href="{{ route('mapa') }}" class="hover:underline">Mapa</a>
            @auth
                @if (auth()->user()->role->canValidate())
                    <a href="{{ route('auditoria') }}" class="hover:underline">Auditoria</a>
                    <a href="{{ route('relatorios') }}" class="hover:underline">Relatórios</a>
                @endif
                @if (auth()->user()->role->canSync())
                    <a href="{{ route('coleta') }}" class="hover:underline">Coleta de campo</a>
                @endif
                <span class="text-slate-400">{{ auth()->user()->name }} ({{ auth()->user()->role->label() }})</span>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button class="text-slate-300 hover:text-white">Sair</button>
                </form>
            @endauth
        </nav>
    </header>

    <main class="p-4 max-w-7xl mx-auto">
        {{ $slot }}
    </main>

    @livewireScripts
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
        }
    </script>
</body>
</html>
