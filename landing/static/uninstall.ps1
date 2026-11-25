$ErrorActionPreference = 'Continue'

function Remove-Target($path) {
    if ($path -and (Test-Path -LiteralPath $path)) {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Removed $path"
    }
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    npm uninstall --global last30days-news 2>$null | Out-Null
    Write-Host "Removed the global npm package if it was installed."

    $cache = npm config get cache 2>$null
    if ($cache -and (Test-Path "$cache\_npx")) {
        Get-ChildItem "$cache\_npx" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $package = Join-Path $_.FullName 'node_modules\last30days-news'
            if (Test-Path -LiteralPath $package) {
                Remove-Item -LiteralPath $package -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "Removed cached npx copy $package"
            }
        }
    }
} else {
    Write-Host "npm is not installed; skipped the npm package."
}

Remove-Target (Join-Path $env:APPDATA 'last30days-news')
if ($env:L30_DATA_DIR) {
    Remove-Target $env:L30_DATA_DIR
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) {
        docker container inspect last30days-news *> $null
        if ($LASTEXITCODE -eq 0) {
            docker rm -f last30days-news | Out-Null
            Write-Host "Removed the Docker container."
        }

        docker volume inspect last30days-data *> $null
        if ($LASTEXITCODE -eq 0) {
            docker volume rm last30days-data | Out-Null
            Write-Host "Removed the Docker volume."
        }

        docker image inspect ghcr.io/emmraan/last30days-news:latest *> $null
        if ($LASTEXITCODE -eq 0) {
            docker image rm ghcr.io/emmraan/last30days-news:latest | Out-Null
            Write-Host "Removed the Docker image."
        }
    } else {
        Write-Host "Docker is installed but not reachable; skipped the Docker cleanup."
    }
}

Write-Host ""
Write-Host "Done. Caddy and Vercel settings are not touched."
Write-Host "Remove the Caddy site block or the Vercel project by hand if you used them."
