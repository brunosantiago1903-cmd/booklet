#!/usr/bin/env bash
# Cloudflare Tunnel para DVR Intelbras - Script de instalação e configuração
# Requisitos: PC com Linux, acesso local ao DVR, conta Cloudflare com domínio

set -euo pipefail

# ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
DVR_IP="192.168.1.100"       # IP local do seu DVR Intelbras
DVR_PORT="80"                # Porta da interface web do DVR (80 ou 8080)
TUNNEL_NAME="dvr-intelbras"  # Nome do túnel no Cloudflare
DOMAIN="dvr.seudominio.com.br" # Seu domínio/subdomínio público
CONFIG_DIR="$HOME/.cloudflared"
# ─────────────────────────────────────────────────────────────────────────────

BOLD="\033[1m"; RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; RESET="\033[0m"

info()    { echo -e "${GREEN}[INFO]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[AVISO]${RESET} $*"; }
error()   { echo -e "${RED}[ERRO]${RESET} $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}=== $* ===${RESET}"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "Execute este script como root: sudo bash setup.sh"
    fi
}

install_cloudflared() {
    section "Instalando cloudflared"

    if command -v cloudflared &>/dev/null; then
        info "cloudflared já instalado: $(cloudflared --version)"
        return
    fi

    ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
    case "$ARCH" in
        amd64|x86_64) PKG="cloudflared-linux-amd64.deb" ;;
        arm64|aarch64) PKG="cloudflared-linux-arm64.deb" ;;
        armhf|armv7l)  PKG="cloudflared-linux-arm.deb" ;;
        *) error "Arquitetura não suportada: $ARCH" ;;
    esac

    TMP=$(mktemp -d)
    info "Baixando $PKG..."
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" \
         -o "$TMP/$PKG"
    dpkg -i "$TMP/$PKG"
    rm -rf "$TMP"
    info "cloudflared instalado: $(cloudflared --version)"
}

authenticate() {
    section "Autenticando com Cloudflare"

    CERT="$CONFIG_DIR/cert.pem"
    if [[ -f "$CERT" ]]; then
        info "Certificado já existe em $CERT"
        return
    fi

    warn "Será aberto um link no browser para autenticar."
    warn "Se estiver em servidor sem GUI, copie a URL e abra no seu computador."
    cloudflared tunnel login
}

create_tunnel() {
    section "Criando túnel: $TUNNEL_NAME"

    # Verifica se túnel já existe
    if cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
        info "Túnel '$TUNNEL_NAME' já existe."
        TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}')
    else
        cloudflared tunnel create "$TUNNEL_NAME"
        TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}')
        info "Túnel criado com ID: $TUNNEL_ID"
    fi

    export TUNNEL_ID
}

write_config() {
    section "Gravando configuração do túnel"

    mkdir -p "$CONFIG_DIR"

    # Encontra o arquivo de credenciais gerado
    CREDS_FILE=$(ls "$CONFIG_DIR/${TUNNEL_ID}.json" 2>/dev/null \
                 || ls "$CONFIG_DIR/credentials/"*.json 2>/dev/null | head -1 \
                 || echo "$CONFIG_DIR/${TUNNEL_ID}.json")

    cat > "$CONFIG_DIR/config.yml" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS_FILE}

ingress:
  # Interface web do DVR Intelbras
  - hostname: ${DOMAIN}
    service: http://${DVR_IP}:${DVR_PORT}
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true       # DVR usa HTTP simples, sem TLS válido
      httpHostHeader: ${DVR_IP}

  # Rota padrão obrigatória (retorna 404 para qualquer outro host)
  - service: http_status:404
EOF

    info "Config gravada em $CONFIG_DIR/config.yml"
}

create_dns() {
    section "Criando registro DNS CNAME no Cloudflare"

    info "Associando $DOMAIN ao túnel $TUNNEL_NAME..."
    cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN"
    info "DNS configurado: $DOMAIN -> túnel Cloudflare"
}

install_service() {
    section "Instalando como serviço systemd"

    cloudflared service install

    systemctl daemon-reload
    systemctl enable cloudflared
    systemctl start cloudflared

    info "Serviço instalado e iniciado."
    systemctl status cloudflared --no-pager || true
}

test_tunnel() {
    section "Testando conexão"

    info "Aguardando túnel subir (10s)..."
    sleep 10

    info "Verificando acesso ao DVR localmente..."
    if curl -sf --connect-timeout 5 "http://${DVR_IP}:${DVR_PORT}" -o /dev/null; then
        info "DVR acessível localmente em http://${DVR_IP}:${DVR_PORT}"
    else
        warn "DVR não respondeu em http://${DVR_IP}:${DVR_PORT} — verifique o IP e porta."
    fi

    echo ""
    info "Status do túnel:"
    cloudflared tunnel info "$TUNNEL_NAME" 2>/dev/null || true
}

print_summary() {
    section "Configuração Concluída"
    echo ""
    echo -e "  ${BOLD}Acesso público:${RESET}    https://${DOMAIN}"
    echo -e "  ${BOLD}Acesso local:${RESET}      http://${DVR_IP}:${DVR_PORT}"
    echo -e "  ${BOLD}Nome do túnel:${RESET}     ${TUNNEL_NAME}"
    echo -e "  ${BOLD}Config:${RESET}            ${CONFIG_DIR}/config.yml"
    echo ""
    echo -e "  ${BOLD}Comandos úteis:${RESET}"
    echo "    systemctl status cloudflared       # status do serviço"
    echo "    journalctl -u cloudflared -f       # logs em tempo real"
    echo "    cloudflared tunnel list            # lista túneis"
    echo "    cloudflared tunnel info $TUNNEL_NAME"
    echo ""
    warn "O Cloudflare aplica TLS automaticamente — acesse via HTTPS."
    warn "Para RTSP (streaming), veja o script rtsp-proxy.sh separado."
}

main() {
    check_root
    install_cloudflared
    authenticate
    create_tunnel
    write_config
    create_dns
    install_service
    test_tunnel
    print_summary
}

main "$@"
