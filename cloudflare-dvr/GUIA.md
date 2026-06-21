# DVR Intelbras via Cloudflare Tunnel

Expõe a interface web do DVR Intelbras analógico para acesso público via domínio próprio,
sem IP fixo, sem port forwarding, sem DDNS. Funciona com internet via SIM card.

---

## Como funciona

```
[DVR Intelbras]──LAN──[PC local]──SIM──Internet──[Cloudflare]──HTTPS──[Você, em qualquer lugar]
                         cloudflared cria conexão de saída (sem abrir portas)
```

O `cloudflared` cria um **túnel de saída** do PC local até os servidores da Cloudflare.
Não precisa de IP fixo nem abrir portas no roteador/modem 4G.

---

## Pré-requisitos

| Item | Detalhe |
|------|---------|
| PC local com Linux | Ubuntu 20.04+ ou Debian 11+ recomendado |
| Acesso ao DVR | PC e DVR na mesma rede local |
| Conta Cloudflare | Gratuita em cloudflare.com |
| Domínio no Cloudflare | Nameservers do domínio apontando para Cloudflare |

---

## Passo a passo

### 1. Descobrir o IP local do DVR

No menu do DVR físico: `Menu → Rede → TCP/IP` — anote o IP (ex: `192.168.1.100`).

Ou pelo PC:
```bash
# Escaneia a rede local em busca de dispositivos na porta 80
nmap -p 80 --open 192.168.1.0/24
```

### 2. Testar acesso local ao DVR

```bash
curl -v http://192.168.1.100:80
# Deve retornar HTML da interface web do DVR
```

Se não funcionar, tente a porta 8080:
```bash
curl -v http://192.168.1.100:8080
```

### 3. Editar o script de configuração

```bash
nano setup.sh
```

Ajuste as variáveis no topo:
```bash
DVR_IP="192.168.1.100"       # IP do seu DVR
DVR_PORT="80"                 # Porta da interface web (80 ou 8080)
TUNNEL_NAME="dvr-intelbras"   # Nome livre para o túnel
DOMAIN="dvr.seudominio.com.br" # Seu domínio/subdomínio
```

### 4. Executar o setup

```bash
sudo bash setup.sh
```

O script irá:
1. Instalar o `cloudflared`
2. Abrir link para autenticação Cloudflare (abrir no browser)
3. Criar o túnel
4. Gravar `~/.cloudflared/config.yml`
5. Criar o CNAME DNS automaticamente
6. Instalar como serviço systemd (auto-start no boot)

### 5. Acessar

```
https://dvr.seudominio.com.br
```

O Cloudflare aplica TLS automaticamente — acesso sempre via HTTPS.

---

## Streaming de vídeo (RTSP → HLS)

A interface web do DVR já funciona via túnel HTTP.  
Para streaming de vídeo pelo browser (sem plugin), use o script `rtsp-proxy.sh`:

```bash
sudo bash rtsp-proxy.sh 1      # Canal 1, stream principal
sudo bash rtsp-proxy.sh 1 1    # Canal 1, substream (menor resolução/banda)
```

Adicione ao `~/.cloudflared/config.yml` a rota HLS e acesse:
```
https://stream.seudominio.com.br/hls/cam1.m3u8
```

---

## Comandos úteis

```bash
# Status do serviço
systemctl status cloudflared

# Logs em tempo real
journalctl -u cloudflared -f

# Reiniciar túnel
systemctl restart cloudflared

# Listar túneis
cloudflared tunnel list

# Info do túnel
cloudflared tunnel info dvr-intelbras

# Monitorar saúde (mantém túnel ativo)
sudo bash monitor.sh
```

---

## Portas padrão dos DVRs Intelbras

| Serviço | Porta | Notas |
|---------|-------|-------|
| Interface web | 80 | HTTP — tunnelado diretamente |
| RTSP | 554 | Streaming (use rtsp-proxy.sh) |
| Acesso mobile | 34567 | iDMSS / gDMSS — não suportado por túnel HTTP |
| SDK / integração | 37777 | Acesso via TCP |

> **Nota:** Portas TCP não-HTTP (RTSP, SDK) requerem `cloudflared access tcp` no cliente,
> ou o proxy HLS descrito acima. O túnel HTTP padrão só roteia HTTP/HTTPS.

---

## Segurança

Por padrão, qualquer pessoa com a URL tem acesso à interface do DVR.
Para proteger o acesso, use o **Cloudflare Access** (gratuito até 50 usuários):

1. No painel Cloudflare → **Zero Trust → Access → Applications**
2. Adicione um aplicativo do tipo "Self-hosted"
3. Configure autenticação por e-mail OTP, Google, GitHub, etc.

Isso adiciona uma tela de login antes de chegar ao DVR.
