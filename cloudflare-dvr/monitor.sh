#!/usr/bin/env bash
# Monitor do túnel Cloudflare + DVR
# Reinicia automaticamente se o túnel cair ou o DVR ficar inacessível
#
# Uso: bash monitor.sh
# Para rodar em background: nohup bash monitor.sh >> /var/log/dvr-monitor.log 2>&1 &

DVR_IP="192.168.1.100"
DVR_PORT="80"
TUNNEL_SERVICE="cloudflared"
CHECK_INTERVAL=60   # segundos entre verificações

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

check_dvr() {
    curl -sf --connect-timeout 5 "http://${DVR_IP}:${DVR_PORT}" -o /dev/null
}

check_tunnel() {
    systemctl is-active --quiet "$TUNNEL_SERVICE"
}

restart_tunnel() {
    log "ALERTA: Reiniciando serviço cloudflared..."
    systemctl restart "$TUNNEL_SERVICE"
    sleep 5
    if check_tunnel; then
        log "OK: cloudflared reiniciado com sucesso."
    else
        log "ERRO: cloudflared não subiu após reinício."
    fi
}

log "Monitor iniciado (DVR: ${DVR_IP}:${DVR_PORT}, intervalo: ${CHECK_INTERVAL}s)"

while true; do
    if ! check_tunnel; then
        log "ALERTA: túnel cloudflared está parado."
        restart_tunnel
    fi

    if ! check_dvr; then
        log "AVISO: DVR não respondeu em http://${DVR_IP}:${DVR_PORT} (pode estar reiniciando)"
    else
        log "OK: DVR acessível. Túnel ativo."
    fi

    sleep "$CHECK_INTERVAL"
done
