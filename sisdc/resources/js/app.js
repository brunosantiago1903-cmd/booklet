import './bootstrap';

import { wizard } from './coleta/wizard.js';
import { initMapa } from './mapa.js';

// O Wizard usa o Alpine empacotado pelo Livewire (evita Alpine duplicado).
// A config (token/deviceId) é injetada pela view em window.SISDC_CONFIG.
document.addEventListener('alpine:init', () => {
    window.Alpine.data('wizard', () => wizard(window.SISDC_CONFIG || {}));
});

// Inicializa o mapa do painel quando o container existir.
document.addEventListener('DOMContentLoaded', initMapa);
