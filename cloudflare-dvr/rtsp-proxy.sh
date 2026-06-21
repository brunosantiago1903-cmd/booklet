#!/usr/bin/env bash
# Proxy RTSP → HLS via FFmpeg
# Permite assistir stream do DVR Intelbras pelo browser via Cloudflare Tunnel
#
# Dependências: ffmpeg, nginx (ou qualquer servidor HTTP estático)
#
# Como funciona:
#   DVR (RTSP :554) → FFmpeg → HLS (.m3u8 + .ts) → nginx → Cloudflare → Browser
#
# Uso: bash rtsp-proxy.sh [canal]
#   canal: número do canal do DVR (padrão: 1)

set -euo pipefail

# ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
DVR_IP="192.168.1.100"
DVR_USER="admin"
DVR_PASS="sua_senha"
DVR_PORT="554"
CANAL="${1:-1}"            # Canal do DVR (1, 2, 3...)
SUBSTREAM="${2:-0}"        # 0=principal (alta resolução), 1=substream (baixa)

# Pasta onde os segmentos HLS serão salvos (deve ser servida pelo nginx)
HLS_DIR="/var/www/html/hls"
HLS_SEGMENT_DURATION=2     # segundos por segmento (menor = menor latência)
HLS_LIST_SIZE=5            # quantidade de segmentos na playlist

# URL RTSP do Intelbras (formato padrão)
# Canal 1 main:  rtsp://admin:senha@ip:554/cam/realmonitor?channel=1&subtype=0
# Canal 1 sub:   rtsp://admin:senha@ip:554/cam/realmonitor?channel=1&subtype=1
RTSP_URL="rtsp://${DVR_USER}:${DVR_PASS}@${DVR_IP}:${DVR_PORT}/cam/realmonitor?channel=${CANAL}&subtype=${SUBSTREAM}"
# ─────────────────────────────────────────────────────────────────────────────

BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; RESET="\033[0m"

check_deps() {
    for cmd in ffmpeg nginx; do
        if ! command -v "$cmd" &>/dev/null; then
            echo "Instalando $cmd..."
            apt-get install -y "$cmd"
        fi
    done
}

setup_nginx() {
    mkdir -p "$HLS_DIR"
    chmod 755 "$HLS_DIR"

    # Config mínima para servir HLS
    cat > /etc/nginx/sites-available/hls <<'NGINX'
server {
    listen 8088;
    root /var/www/html;

    location /hls/ {
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }
}
NGINX

    ln -sf /etc/nginx/sites-available/hls /etc/nginx/sites-enabled/hls
    nginx -s reload 2>/dev/null || systemctl start nginx
    echo -e "${GREEN}[OK]${RESET} nginx configurado na porta 8088"
}

add_tunnel_route() {
    # Adiciona rota HLS no config do cloudflared se ainda não existir
    CFG="$HOME/.cloudflared/config.yml"
    HLS_HOST="stream.seudominio.com.br"

    if grep -q "$HLS_HOST" "$CFG" 2>/dev/null; then
        return
    fi

    echo -e "${YELLOW}[AVISO]${RESET} Adicione manualmente ao $CFG antes da linha '- service: http_status:404':"
    echo ""
    echo "  - hostname: ${HLS_HOST}"
    echo "    service: http://127.0.0.1:8088"
    echo ""
    echo "Depois execute: systemctl restart cloudflared"
    echo "E crie o DNS:   cloudflared tunnel route dns dvr-intelbras ${HLS_HOST}"
}

start_ffmpeg() {
    HLS_OUT="$HLS_DIR/cam${CANAL}.m3u8"

    echo -e "${BOLD}Iniciando streaming do canal ${CANAL}...${RESET}"
    echo "  RTSP: ${RTSP_URL//${DVR_PASS}/****}"
    echo "  HLS:  ${HLS_OUT}"
    echo ""
    echo "  Acesse: https://stream.seudominio.com.br/hls/cam${CANAL}.m3u8"
    echo "  (Use VLC, QuickTime, ou player HLS no browser)"
    echo ""
    echo "Pressione Ctrl+C para parar."

    # -fflags nobuffer / -flags low_delay = menor latência
    # -vcodec copy = sem recodificação (preserva qualidade, usa menos CPU)
    exec ffmpeg \
        -hide_banner -loglevel warning \
        -rtsp_transport tcp \
        -i "$RTSP_URL" \
        -fflags nobuffer \
        -flags low_delay \
        -vcodec copy \
        -acodec aac \
        -f hls \
        -hls_time "$HLS_SEGMENT_DURATION" \
        -hls_list_size "$HLS_LIST_SIZE" \
        -hls_flags delete_segments+append_list \
        "$HLS_OUT"
}

check_deps
setup_nginx
add_tunnel_route
start_ffmpeg
