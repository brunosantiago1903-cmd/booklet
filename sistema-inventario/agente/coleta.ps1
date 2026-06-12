# =============================================================================
# Agente de Telemetria — Sistema de Gestao de Ativos de TI
# Coleta MAC, hostname, CPU%, RAM% e Disco% e envia para a API central.
# Executado a cada 5 minutos pelo Agendador de Tarefas do Windows.
# =============================================================================
param(
    [string]$ApiUrl = "http://SEU_SERVIDOR:8000/api/telemetria",
    [string]$AgentKey = ""
)

try {
    # MAC do primeiro adaptador de rede ativo (com IP) — chave unica da estacao
    $nic = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=TRUE" |
        Select-Object -First 1
    if (-not $nic -or -not $nic.MACAddress) { exit 0 }

    $os = Get-CimInstance Win32_OperatingSystem

    # CPU: amostra instantanea (suficiente para tendencias no dashboard)
    $cpu = (Get-CimInstance Win32_Processor |
        Measure-Object -Property LoadPercentage -Average).Average
    if ($null -eq $cpu) { $cpu = 0 }

    $ram = [math]::Round((1 - ($os.FreePhysicalMemory / $os.TotalVisibleMemorySize)) * 100, 1)

    $disco = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $hd = if ($disco -and $disco.Size -gt 0) {
        [math]::Round((1 - ($disco.FreeSpace / $disco.Size)) * 100, 1)
    } else { 0 }

    $corpo = @{
        mac_address = $nic.MACAddress
        hostname    = $env:COMPUTERNAME
        uso_cpu     = [math]::Round([double]$cpu, 1)
        uso_ram     = $ram
        uso_hd      = $hd
    } | ConvertTo-Json

    $headers = @{}
    if ($AgentKey -ne "") { $headers["X-Agent-Key"] = $AgentKey }

    Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType 'application/json' `
        -Body $corpo -Headers $headers -TimeoutSec 30 | Out-Null
}
catch {
    # Falha silenciosa (servidor inacessivel, sem rede etc.) — tenta de novo em 5 min
    exit 0
}
