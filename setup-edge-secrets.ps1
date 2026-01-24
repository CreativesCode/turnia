# Script para configurar los secretos de Edge Functions en Supabase
# Ejecutar con: .\setup-edge-secrets.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configurar Secretos de Edge Functions" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Leer variables del archivo .env
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Error: No se encontró el archivo .env" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envFile
$supabaseUrl = ($envContent | Select-String "NEXT_PUBLIC_SUPABASE_URL=(.+)").Matches.Groups[1].Value
$anonKey = ($envContent | Select-String "NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)").Matches.Groups[1].Value

Write-Host "URL de Supabase: $supabaseUrl" -ForegroundColor Green
Write-Host "Anon Key encontrada: $($anonKey.Substring(0, 20))..." -ForegroundColor Green

# Solicitar el Service Role Key
Write-Host "`nPor favor, copia tu SERVICE_ROLE_KEY desde:" -ForegroundColor Yellow
Write-Host "https://supabase.com/dashboard/project/ievvtebvqswjjmujpbcb/settings/api`n" -ForegroundColor Yellow
$serviceRoleKey = Read-Host "Pega tu SERVICE_ROLE_KEY aquí"

if ([string]::IsNullOrWhiteSpace($serviceRoleKey)) {
    Write-Host "Error: No se proporcionó el SERVICE_ROLE_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "`nConfigurando secretos en Supabase..." -ForegroundColor Cyan

# Configurar SUPABASE_URL
Write-Host "Configurando SUPABASE_URL..." -ForegroundColor Yellow
npx supabase secrets set "SUPABASE_URL=$supabaseUrl"

# Configurar SUPABASE_ANON_KEY
Write-Host "Configurando SUPABASE_ANON_KEY..." -ForegroundColor Yellow
npx supabase secrets set "SUPABASE_ANON_KEY=$anonKey"

# Configurar SUPABASE_SERVICE_ROLE_KEY
Write-Host "Configurando SUPABASE_SERVICE_ROLE_KEY..." -ForegroundColor Yellow
npx supabase secrets set "SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey"

# Configurar APP_URL (para los links de invitación)
Write-Host "Configurando APP_URL..." -ForegroundColor Yellow
npx supabase secrets set "APP_URL=https://turnia.app"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Secretos configurados correctamente!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Ahora redesplegando las Edge Functions..." -ForegroundColor Cyan

npx supabase functions deploy invite-user
npx supabase functions deploy accept-invitation
npx supabase functions deploy validate-invitation

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "¡Listo! Ahora puedes probar la funcionalidad de invitaciones" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
