$ErrorActionPreference = 'Stop'
$requiredNode = '26.13.0'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js $requiredNode is required. Install it from https://nodejs.org and run this again."
}

$currentNode = node -p "process.versions.node"
if ($currentNode -ne $requiredNode) {
    throw "Node.js $requiredNode is required. Found $currentNode."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is required. It ships with Node.js; reinstall Node.js from https://nodejs.org."
}

$releaseUrl = 'https://github.com/Emmraan/last30days-news/releases/latest/download/last30days-news.tgz'

Write-Host "Installing last30days-news..."
npm install --global $releaseUrl --no-fund --no-audit
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed with exit code $LASTEXITCODE."
}

Write-Host ""
Write-Host "Installed."
Write-Host "Start it with: last30days"
Write-Host "First run password: last30"
Write-Host "Change the password in Settings after you sign in."
Write-Host "If the command is not found, open a new terminal."
