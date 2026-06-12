-- Modelo de dados do Sistema de Gestão de Ativos de TI e Telemetria
-- (timestamps sempre em UTC via datetime('now'))

CREATE TABLE IF NOT EXISTS usuarios_sistema (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin','operador')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estacoes_trabalho (
  mac_address TEXT PRIMARY KEY,
  hostname TEXT,
  patrimonio_cpu TEXT,
  secretaria_setor TEXT,
  servidor_resp TEXT,
  estado_monitor TEXT,
  estado_teclado_rato TEXT,
  foto_path TEXT,
  latitude REAL,
  longitude REAL,
  status_vinculo TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status_vinculo IN ('PENDENTE','CONCLUIDO','BAIXA')),
  inventariado_por INTEGER REFERENCES usuarios_sistema(id),
  inventariado_em TEXT,
  primeiro_contato TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telemetria_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mac_address TEXT NOT NULL REFERENCES estacoes_trabalho(mac_address),
  uso_cpu REAL,
  uso_ram REAL,
  uso_hd REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetria_mac_data
  ON telemetria_logs(mac_address, created_at DESC);
