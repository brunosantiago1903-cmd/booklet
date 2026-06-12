<?php
// Configurações centrais do sistema.
// IMPORTANTE: troque JWT_SECRET por um valor longo e aleatório antes do deploy!

define('DB_PATH', __DIR__ . '/data/ativos.db');
define('UPLOADS_DIR', __DIR__ . '/uploads');

define('JWT_SECRET', 'TROQUE-ESTE-SEGREDO-ANTES-DO-DEPLOY');
define('JWT_TTL', 8 * 3600); // validade do token: 8 horas

// Janela para considerar uma estação OFFLINE (agente envia a cada 5 min)
define('OFFLINE_MINUTOS', 15);

// Limiares do painel semafórico (AMARELO)
define('LIMIAR_DISCO', 85);
define('LIMIAR_RAM', 90);

// Chave compartilhada opcional do agente de telemetria.
// Se preenchida, o agente deve enviar o header X-Agent-Key com o mesmo valor.
define('AGENT_KEY', '');

define('MAX_FOTO_BYTES', 8 * 1024 * 1024);
