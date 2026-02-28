# PowerShell script to run frontend in LAN mode (HTTPS)
# Shows your local IP address for easy access from mobile devices

Write-Host "`n=== CRM Frontend - LAN Development Mode (HTTPS) ===" -ForegroundColor Cyan
Write-Host ""

# Get local IP address
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"} | Select-Object -First 1).IPAddress

# Check if mkcert certificates exist
$certFile = Join-Path $PSScriptRoot "..\certs\localhost+3.pem"
$keyFile = Join-Path $PSScriptRoot "..\certs\localhost+3-key.pem"
$hasHttps = (Test-Path $certFile) -and (Test-Path $keyFile)

if ($hasHttps) {
    $proto = "https"
    Write-Host "HTTPS: " -NoNewline
    Write-Host "Enabled (mkcert)" -ForegroundColor Green
} else {
    $proto = "http"
    Write-Host "HTTPS: " -NoNewline
    Write-Host "Disabled (no certs found)" -ForegroundColor Yellow
    Write-Host "  Microphone will NOT work on mobile!" -ForegroundColor Red
    Write-Host "  Run: mkcert -install && mkcert -cert-file ../certs/localhost+3.pem -key-file ../certs/localhost+3-key.pem localhost 127.0.0.1 $localIP" -ForegroundColor Gray
}

Write-Host ""

if ($localIP) {
    Write-Host "Your local IP address: " -NoNewline
    Write-Host "$localIP" -ForegroundColor Green
    Write-Host ""
    Write-Host "Frontend will be accessible at:" -ForegroundColor Yellow
    Write-Host "  Local:   ${proto}://localhost:3000" -ForegroundColor White
    Write-Host "  Network: ${proto}://${localIP}:3000" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backend should be running at:" -ForegroundColor Yellow
    Write-Host "  http://${localIP}:8000" -ForegroundColor White
    Write-Host ""
    Write-Host "Open on your mobile device:" -ForegroundColor Cyan
    Write-Host "  ${proto}://${localIP}:3000" -ForegroundColor Green -BackgroundColor DarkGray
    Write-Host ""
} else {
    Write-Host "Could not detect local IP address." -ForegroundColor Red
    Write-Host "Please check your network connection." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Starting Vite dev server in LAN mode..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host ""

# Start dev server
npm run dev:lan
