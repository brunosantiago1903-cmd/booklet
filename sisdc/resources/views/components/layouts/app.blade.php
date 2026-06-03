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
                @if (auth()->user()->role->canManageUsers())
                    <a href="{{ route('usuarios') }}" class="hover:underline">Usuários</a>
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

    {{-- Aviso de nova versão do app (Service Worker). Fica oculto até uma
         atualização ser detectada; "Atualizar" assume a versão nova e recarrega. --}}
    <div id="sw-update" class="hidden fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 z-50
                rounded-lg bg-slate-900 text-white shadow-lg ring-1 ring-white/10 p-3 flex items-center gap-3">
        <span class="text-sm">Nova versão do app disponível.</span>
        <button id="sw-update-btn" type="button"
                class="ml-auto px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-medium">Atualizar</button>
    </div>

    @livewireScripts
    <script>
        if ('serviceWorker' in navigator) {
            let recarregando = false;
            // Quando a versão nova assume o controle, recarrega uma única vez.
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (recarregando) return;
                recarregando = true;
                window.location.reload();
            });

            window.addEventListener('load', async () => {
                try {
                    const reg = await navigator.serviceWorker.register('/sw.js');

                    const mostrarAviso = (worker) => {
                        const banner = document.getElementById('sw-update');
                        if (!banner || !worker) return;
                        banner.classList.remove('hidden');
                        document.getElementById('sw-update-btn').onclick = () => {
                            worker.postMessage({ type: 'SKIP_WAITING' });
                        };
                    };

                    // Já existe uma versão nova aguardando (controller != null
                    // garante que NÃO é a primeira instalação).
                    if (reg.waiting && navigator.serviceWorker.controller) mostrarAviso(reg.waiting);

                    // Detecta versões novas que chegarem com a página aberta.
                    reg.addEventListener('updatefound', () => {
                        const novo = reg.installing;
                        novo?.addEventListener('statechange', () => {
                            if (novo.state === 'installed' && navigator.serviceWorker.controller) {
                                mostrarAviso(novo);
                            }
                        });
                    });

                    // Procura atualização ao abrir e de hora em hora.
                    reg.update().catch(() => {});
                    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
                } catch (e) { /* registro do SW falhou: app segue funcionando */ }
            });
        }
    </script>
</body>
</html>
