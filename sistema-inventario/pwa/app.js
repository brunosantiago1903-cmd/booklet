// PWA de campo — Sistema de Inventário de TI
const API = '../api';

let token = localStorage.getItem('inv_token');
let usuario = JSON.parse(localStorage.getItem('inv_usuario') || 'null');

const $ = (id) => document.getElementById(id);
const views = ['view-login', 'view-lista', 'view-form'];

function mostrar(view) {
  views.forEach((v) => $(v).classList.toggle('oculto', v !== view));
  $('btn-sair').classList.toggle('oculto', view === 'view-login');
}

function toast(msg, erro = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('toast-erro', erro);
  t.classList.remove('oculto');
  setTimeout(() => t.classList.add('oculto'), 3500);
}

async function api(caminho, opcoes = {}) {
  opcoes.headers = Object.assign(
    { Authorization: 'Bearer ' + token },
    opcoes.headers || {}
  );
  const resp = await fetch(API + caminho, opcoes);
  if (resp.status === 401) {
    sair();
    throw new Error('Sessão expirada. Entre novamente.');
  }
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Erro ' + resp.status);
  return dados;
}

function sair() {
  token = null;
  usuario = null;
  localStorage.removeItem('inv_token');
  localStorage.removeItem('inv_usuario');
  mostrar('view-login');
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
    token = dados.token;
    usuario = dados.usuario;
    localStorage.setItem('inv_token', token);
    localStorage.setItem('inv_usuario', JSON.stringify(usuario));
    mostrar('view-lista');
    carregarPendentes();
  } catch (err) {
    $('login-erro').textContent = err.message;
  }
});

$('btn-sair').addEventListener('click', sair);

// ===== Lista de pendentes =====
async function carregarPendentes() {
  try {
    const pendentes = await api('/estacoes/pendentes');
    const ul = $('lista-pendentes');
    ul.innerHTML = '';
    $('lista-vazia').classList.toggle('oculto', pendentes.length > 0);
    pendentes.forEach((p) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${p.hostname || '(sem hostname)'}</strong>
        <span class="mac">${p.mac_address}</span>
        <small>Detectada em: ${p.primeiro_contato} UTC</small>`;
      li.addEventListener('click', () => abrirForm(p));
      ul.appendChild(li);
    });
  } catch (err) {
    toast(err.message, true);
  }
}

$('btn-atualizar').addEventListener('click', carregarPendentes);

// ===== Formulário de vistoria =====
function abrirForm(estacao) {
  $('form-inventario').reset();
  $('foto-preview').classList.add('oculto');
  $('form-erro').textContent = '';
  $('f-mac').value = estacao.mac_address;
  $('form-titulo').textContent = 'Vistoria — ' + (estacao.hostname || 'estação');
  $('form-mac-label').textContent = 'MAC: ' + estacao.mac_address;
  $('f-lat').value = '';
  $('f-lng').value = '';
  mostrar('view-form');
  capturarGPS();
}

$('btn-voltar').addEventListener('click', () => mostrar('view-lista'));

function capturarGPS() {
  const status = $('gps-status');
  if (!navigator.geolocation) {
    status.textContent = '⚠️ GPS não suportado neste dispositivo.';
    return;
  }
  status.textContent = '📡 Obtendo localização GPS…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      $('f-lat').value = pos.coords.latitude.toFixed(7);
      $('f-lng').value = pos.coords.longitude.toFixed(7);
      status.textContent = `✅ GPS capturado (precisão ±${Math.round(pos.coords.accuracy)} m)`;
    },
    (err) => {
      status.textContent = '⚠️ Falha no GPS: ' + err.message +
        ' (verifique permissão de localização e se o acesso é HTTPS)';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

$('btn-gps').addEventListener('click', capturarGPS);

$('f-foto').addEventListener('change', () => {
  const arquivo = $('f-foto').files[0];
  const img = $('foto-preview');
  if (arquivo) {
    img.src = URL.createObjectURL(arquivo);
    img.classList.remove('oculto');
  } else {
    img.classList.add('oculto');
  }
});

$('form-inventario').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('form-erro').textContent = '';
  if (!$('f-lat').value || !$('f-lng').value) {
    $('form-erro').textContent = 'Aguarde a captura do GPS antes de submeter.';
    return;
  }
  const btn = $('btn-submeter');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const fd = new FormData();
    fd.append('mac_address', $('f-mac').value);
    fd.append('patrimonio_cpu', $('f-patrimonio').value);
    fd.append('secretaria_setor', $('f-setor').value);
    fd.append('servidor_resp', $('f-responsavel').value);
    fd.append('estado_monitor', $('f-monitor').value);
    fd.append('estado_teclado_rato', $('f-teclado').value);
    fd.append('latitude', $('f-lat').value);
    fd.append('longitude', $('f-lng').value);
    fd.append('foto', $('f-foto').files[0]);
    await api('/inventario', { method: 'POST', body: fd });
    toast('✅ Vistoria concluída com sucesso!');
    mostrar('view-lista');
    carregarPendentes();
  } catch (err) {
    $('form-erro').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submeter Vistoria';
  }
});

// ===== Inicialização =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (token) {
  mostrar('view-lista');
  carregarPendentes();
} else {
  mostrar('view-login');
}
