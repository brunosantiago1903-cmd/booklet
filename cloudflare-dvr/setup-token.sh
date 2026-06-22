#!/usr/bin/env bash
# Cloudflare Tunnel via TOKEN do painel (método mais simples)
# Use este script se você criou o túnel pelo painel Cloudflare Zero Trust
#
# Como obter o token:
#   1. Acesse: https://one.dash.cloudflare.com
#   2. Vá em: Networks → Tunnels → Create a tunnel
#   3. Escolha: Cloudflared → dê um nome → Next
#   4. Em "Install and run a connector" copie o TOKEN do comando mostrado
#      (a parte longa após "cloudflared service install")
#   5. Cole o token na variável abaixo

set -euo pipefail

# ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
TUNNEL_TOKEN="cole_seu_token_aqui"   # Token obtido no painel Cloudflare Zero Trust
# ─────────────────────────────────────────────────────────────────────────────

BOLD="\033[1m"; RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; RESET="\033[0m"

info()    { echo -e "${GREEN}[INFO]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[AVISO]${RESET} $*"; }
error()   { echo -e "${RED}[ERRO]${RESET} $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}=== $* ===${RESET}"; }

[[ $EUID -ne 0 ]] && error "Execute como root: sudo bash setup-token.sh"
[[ "$TUNNEL_TOKEN" == "cole_seu_token_aqui" ]] && \
    error "Edite o script e coloque seu token em TUNNEL_TOKEN"

section "Instalando cloudflared"

if ! command -v cloudflared &>/dev/null; then
    ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
    case "$ARCH" in
        amd64|x86_64) PKG="cloudflared-linux-amd64.deb" ;;
        arm64|aarch64) PKG="cloudflared-linux-arm64.deb" ;;
        armhf|armv7l)  PKG="cloudflared-linux-arm.deb" ;;
        *) error "Arquitetura não suportada: $ARCH" ;;
    esac

    TMP=$(mktemp -d)
    info "Baixando cloudflared ($ARCH)..."
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" \
         -o "$TMP/$PKG"
    dpkg -i "$TMP/$PKG"
    rm -rf "$TMP"
fi
info "cloudflared: $(cloudflared --version)"

section "Instalando serviço com token"

# Instala como serviço systemd usando o token do painel
# O token já contém todas as configurações: túnel, credenciais e rotas
cloudflared service install "$TUNNEL_TOKEN"

systemctl daemon-reload
systemctl enable cloudflared
systemctl start cloudflared

section "Status"
sleep 3
systemctl status cloudflared --no-pager || true

echo ""
info "Pronto! O túnel está ativo."
warn "Configure o hostname público no painel Cloudflare:"
echo ""
echo "  1. Volte ao painel: Networks → Tunnels → seu túnel → Public Hostname"
echo "  2. Clique em 'Add a public hostname'"
echo "  3. Preencha:"
echo "       Subdomain: dvr"
echo "       Domain:    seudominio.com.br"
echo "       Type:      HTTP"
echo "       URL:       192.168.1.100:8080"
echo ""
echo "  Acesse: https://dvr.seudominio.com.br"
echo ""
echo "  Logs: journalctl -u cloudflared -f"
