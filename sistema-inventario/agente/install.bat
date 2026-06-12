@echo off
REM ===========================================================================
REM  Instalador do Agente de Telemetria — Sistema de Gestao de Ativos de TI
REM  EXECUTAR COMO ADMINISTRADOR (clique direito ^> Executar como administrador)
REM
REM  1. Edite API_URL abaixo com o endereco real do servidor antes de usar.
REM  2. Copie a pasta 'agente' para a pen drive e execute este .bat na estacao.
REM ===========================================================================

set "API_URL=http://SEU_SERVIDOR:8000/api/telemetria"
set "AGENT_KEY="
set "INSTALL_DIR=C:\ProgramData\AgenteInventario"
set "TAREFA=AgenteInventarioTI"

echo.
echo === Instalando Agente de Telemetria ===

REM Verifica privilegios de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Execute este instalador como Administrador.
    pause
    exit /b 1
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /Y "%~dp0coleta.ps1" "%INSTALL_DIR%\coleta.ps1" >nul

REM Tarefa agendada: executa a coleta a cada 5 minutos como SYSTEM
schtasks /Create /F /TN "%TAREFA%" /SC MINUTE /MO 5 /RU SYSTEM ^
  /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%INSTALL_DIR%\coleta.ps1\" -ApiUrl \"%API_URL%\" -AgentKey \"%AGENT_KEY%\""
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao criar a tarefa agendada.
    pause
    exit /b 1
)

REM Primeiro disparo imediato: a estacao entra como PENDENTE na fila do PWA
schtasks /Run /TN "%TAREFA%" >nul

echo.
echo [OK] Agente instalado. A estacao aparecera como PENDENTE no PWA em instantes.
echo      Tarefa agendada: %TAREFA% (a cada 5 minutos)
pause
