// Dashboard administrativo — Gestão de Ativos de TI
const API = '../api';
const CORES = { VERDE: '#2e7d32', AMARELO: '#f9a825', VERMELHO: '#c62828', CINZA: '#757575' };
const EMOJIS = { VERDE: '🟢', AMARELO: '🟡', VERMELHO: '🔴', CINZA: '⚪' };

let token = localStorage.getItem('dash_token');
let usuario = JSON.parse(localStorage.getItem('dash_usuario') || 'null');
let estacoes = [];
let mapa = null;
let camadaPins = null;
let timer = null;

const $ = (id) => document.getElementById(id);

async function api(caminho, opcoes = {}) {
  opcoes.headers = Object.assign(
    { Authorization: 'Bearer ' + token },
    opcoes.headers || {}
  );
  const resp = await fetch(API + caminho, opcoes);
  if (resp.status === 401) {
    sair();
    throw new Error('Sessão expirada.');
  }
  if (caminho.startsWith('/export')) return resp;
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Erro ' + resp.status);
  return dados;
}

function sair() {
  token = null;
  usuario = null;
  localStorage.removeItem('dash_token');
  localStorage.removeItem('dash_usuario');
  clearInterval(timer);
  $('view-painel').classList.add('oculto');
  $('view-login').classList.remove('oculto');
}

function entrar() {
  $('view-login').classList.add('oculto');
  $('view-painel').classList.remove('oculto');
  $('usuario-logado').textContent = usuario.nome;
  carregarTudo();
  clearInterval(timer);
  timer = setInterval(carregarTudo, 60000);
}

// ===== Login =====
$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-erro').textContent = '';
  try {
    const resp = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('login-email').value, senha: $('login-senha').value }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Falha no login');
    if (dados.usuario.perfil !== 'admin') {
      throw new Error('Este painel é exclusivo de administradores. Use o PWA de campo.');
    }
    token = dados.token;
    usuario = dados.usuario;
    localStorage.setItem('dash_token', token);
    localStorage.setItem('dash_usuario', JSON.stringify(usuario));
    entrar();
  } catch (err) {
    $('login-erro').textContent = err.message;
  }
});

$('btn-sair').addEventListener('click', sair);

// ===== Abas =====
document.querySelectorAll('nav [data-aba]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav [data-aba]').forEach((b) => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.querySelectorAll('.aba').forEach((a) => a.classList.add('oculto'));
    $(btn.dataset.aba).classList.remove('oculto');
    if (btn.dataset.aba === 'aba-mapa') iniciarMapa();
    if (btn.dataset.aba === 'aba-usuarios') carregarUsuarios();
  });
});

// ===== Carga principal =====
async function carregarTudo() {
  try {
    estacoes = await api('/estacoes');
    renderContadores();
    renderTabela();
    renderPins();
    $('ultima-atualizacao').textContent =
      'Atualizado às ' + new Date().toLocaleTimeString('pt-BR');
  } catch (err) {
    console.error(err);
  }
}

function renderContadores() {
  const conta = { VERDE: 0, AMARELO: 0, VERMELHO: 0, CINZA: 0 };
  let pendentes = 0;
  estacoes.forEach((e) => {
    conta[e.semaforo] = (conta[e.semaforo] || 0) + 1;
    if (e.status_vinculo === 'PENDENTE') pendentes++;
  });
  $('cont-verde').textContent = conta.VERDE;
  $('cont-amarelo').textContent = conta.AMARELO;
  $('cont-vermelho').textContent = conta.VERMELHO;
  $('cont-cinza').textContent = conta.CINZA;
  $('cont-pendente').textContent = pendentes;
}

function estacoesFiltradas() {
  const busca = $('filtro-busca').value.toLowerCase();
  const sem = $('filtro-semaforo').value;
  return estacoes.filter((e) => {
    if (sem && e.semaforo !== sem) return false;
    if (!busca) return true;
    return [e.hostname, e.mac_address, e.secretaria_setor, e.patrimonio_cpu, e.servidor_resp]
      .some((c) => (c || '').toLowerCase().includes(busca));
  });
}

function renderTabela() {
  const tbody = $('tabela-estacoes').querySelector('tbody');
  tbody.innerHTML = '';
  estacoesFiltradas().forEach((e) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td title="${e.semaforo}">${EMOJIS[e.semaforo] || ''}</td>
      <td>${e.hostname || '—'}</td>
      <td class="mono">${e.mac_address}</td>
      <td>${e.patrimonio_cpu || '—'}</td>
      <td>${e.secretaria_setor || '—'}</td>
      <td>${e.servidor_resp || '—'}</td>
      <td>${fmt(e.uso_cpu)}</td>
      <td>${fmt(e.uso_ram)}</td>
      <td>${fmt(e.uso_hd)}</td>
      <td>${e.ultima_telemetria ? e.ultima_telemetria + ' UTC' : 'nunca'}</td>
      <td><span class="etiqueta etiqueta-${e.status_vinculo.toLowerCase()}">${e.status_vinculo}</span></td>
      <td>
        <button class="btn-mini" data-acao="detalhes">📊</button>
        <button class="btn-mini" data-acao="status" title="Alterar status">⚙</button>
      </td>`;
    tr.querySelector('[data-acao="detalhes"]').addEventListener('click', () => abrirDetalhes(e));
    tr.querySelector('[data-acao="status"]').addEventListener('click', () => alterarStatus(e));
    tbody.appendChild(tr);
  });
}

const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(0) + '%');

$('filtro-busca').addEventListener('input', renderTabela);
$('filtro-semaforo').addEventListener('change', renderTabela);

// ===== Alteração manual de status (ex.: baixa) =====
async function alterarStatus(estacao) {
  const novo = prompt(
    `Status de ${estacao.hostname || estacao.mac_address}\n` +
    'Digite: PENDENTE, CONCLUIDO ou BAIXA (baixa por obsolescência)',
    estacao.status_vinculo
  );
  if (!novo) return;
  try {
    await api(`/estacoes/${encodeURIComponent(estacao.mac_address)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status_vinculo: novo.trim().toUpperCase() }),
    });
    carregarTudo();
  } catch (err) {
    alert(err.message);
  }
}

// ===== Modal de detalhes / histórico =====
async function abrirDetalhes(e) {
  $('modal-titulo').textContent = `${EMOJIS[e.semaforo]} ${e.hostname || e.mac_address}`;
  $('modal-info').innerHTML = `
    <p><strong>MAC:</strong> <span class="mono">${e.mac_address}</span></p>
    <p><strong>Património:</strong> ${e.patrimonio_cpu || '—'} |
       <strong>Setor:</strong> ${e.secretaria_setor || '—'} |
       <strong>Responsável:</strong> ${e.servidor_resp || '—'}</p>
    <p><strong>Monitor:</strong> ${e.estado_monitor || '—'} |
       <strong>Teclado/Rato:</strong> ${e.estado_teclado_rato || '—'}</p>
    ${e.latitude ? `<p><strong>GPS:</strong> ${e.latitude}, ${e.longitude}</p>` : ''}
    ${e.foto_path ? `<img class="foto-modal" src="${API}/uploads/${e.foto_path}" alt="Foto da estação">` : ''}`;
  $('modal').classList.remove('oculto');
  const tbody = $('tabela-historico').querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="4">Carregando…</td></tr>';
  try {
    const hist = await api(`/estacoes/${encodeURIComponent(e.mac_address)}/historico?horas=24`);
    tbody.innerHTML = hist.length
      ? hist.map((h) =>
          `<tr><td>${h.created_at}</td><td>${fmt(h.uso_cpu)}</td><td>${fmt(h.uso_ram)}</td><td>${fmt(h.uso_hd)}</td></tr>`
        ).join('')
      : '<tr><td colspan="4">Sem registos nas últimas 24h.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">${err.message}</td></tr>`;
  }
}

$('modal-fechar').addEventListener('click', () => $('modal').classList.add('oculto'));
$('modal').addEventListener('click', (ev) => {
  if (ev.target === $('modal')) $('modal').classList.add('oculto');
});

// ===== Mapa =====
function iniciarMapa() {
  if (!mapa) {
    mapa = L.map('mapa').setView([-15.78, -47.93], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(mapa);
    camadaPins = L.layerGroup().addTo(mapa);
  }
  setTimeout(() => mapa.invalidateSize(), 100);
  renderPins();
}

function renderPins() {
  if (!mapa) return;
  camadaPins.clearLayers();
  const comGPS = estacoes.filter((e) => e.latitude && e.longitude);
  comGPS.forEach((e) => {
    L.circleMarker([e.latitude, e.longitude], {
      radius: 10,
      color: '#fff',
      weight: 2,
      fillColor: CORES[e.semaforo] || '#555',
      fillOpacity: 0.95,
    })
      .bindPopup(`
        <strong>${e.hostname || e.mac_address}</strong><br>
        ${EMOJIS[e.semaforo]} ${e.semaforo} — ${e.status_vinculo}<br>
        Património: ${e.patrimonio_cpu || '—'}<br>
        Setor: ${e.secretaria_setor || '—'}<br>
        CPU ${fmt(e.uso_cpu)} · RAM ${fmt(e.uso_ram)} · Disco ${fmt(e.uso_hd)}`)
      .addTo(camadaPins);
  });
  if (comGPS.length) {
    mapa.fitBounds(comGPS.map((e) => [e.latitude, e.longitude]), { maxZoom: 16, padding: [40, 40] });
  }
}

// ===== Usuários =====
async function carregarUsuarios() {
  try {
    const lista = await api('/usuarios');
    const tbody = $('tabela-usuarios').querySelector('tbody');
    tbody.innerHTML = '';
    lista.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.nome}</td><td>${u.email}</td>
        <td><span class="etiqueta etiqueta-${u.perfil}">${u.perfil}</span></td>
        <td>${u.id !== usuario.id ? '<button class="btn-mini">🗑</button>' : ''}</td>`;
      const btn = tr.querySelector('button');
      if (btn) {
        btn.addEventListener('click', async () => {
          if (!confirm(`Remover o acesso de ${u.nome}?`)) return;
          try {
            await api('/usuarios/' + u.id, { method: 'DELETE' });
            carregarUsuarios();
          } catch (err) {
            alert(err.message);
          }
        });
      }
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

$('form-usuario').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('usuario-erro').textContent = '';
  try {
    await api('/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: $('u-nome').value,
        email: $('u-email').value,
        senha: $('u-senha').value,
        perfil: $('u-perfil').value,
      }),
    });
    $('form-usuario').reset();
    carregarUsuarios();
  } catch (err) {
    $('usuario-erro').textContent = err.message;
  }
});

// ===== Export CSV =====
$('btn-export').addEventListener('click', async () => {
  try {
    const resp = await api('/export/csv');
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inventario.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    alert(err.message);
  }
});

// ===== Inicialização =====
if (token && usuario && usuario.perfil === 'admin') {
  entrar();
}
