#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Version = 'latest',
    [string]$InstallDir,
    [switch]$NoPathUpdate
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Install-Rauto {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'Use install.sh on Linux or macOS.'
    }
    $architecture = $env:PROCESSOR_ARCHITEW6432
    if (-not $architecture) { $architecture = $env:PROCESSOR_ARCHITECTURE }
    if ($architecture -ne 'AMD64') {
        throw 'The Windows installer supports x86_64 only. Use Cargo for other architectures.'
    }
    if (-not $InstallDir) {
        $InstallDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\rauto'
    }
    $InstallDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($InstallDir)
    $releaseApi = 'https://api.github.com/repos/demohiiiii/rauto/releases'
    $headers = @{ 'User-Agent' = 'rauto-installer'; Accept = 'application/vnd.github+json' }
    if ($Version -eq 'latest') {
        $release = Invoke-RestMethod -Uri "$releaseApi/latest" -Headers $headers -TimeoutSec 30
        $Version = [string]$release.tag_name
    }
    $Version = $Version -creplace '^v', ''
    if ($Version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') {
        throw 'Invalid version. Example: -Version 0.5.2'
    }

    $asset = 'rauto-windows-amd64.exe.zip'
    $url = "https://github.com/demohiiiii/rauto/releases/download/v$Version/$asset"
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ("rauto-install-" + [Guid]::NewGuid().ToString('N'))
    $staged = $null
    try {
        $null = New-Item -ItemType Directory -Path $temporary
        $archive = Join-Path $temporary $asset
        Write-Host "Downloading rauto $Version (Windows x86_64)..."
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive -Headers $headers -TimeoutSec 300

        if ($Version -eq '0.5.2') {
            # This release predates the per-archive checksum files.
            $release = Invoke-RestMethod -Uri "$releaseApi/tags/v$Version" -Headers $headers -TimeoutSec 30
            $assets = @($release.assets | Where-Object { $_.name -eq $asset })
            if ($assets.Count -ne 1 -or -not $assets[0].digest -or $assets[0].digest -notmatch '^sha256:[0-9a-fA-F]{64}$') {
                throw 'Release SHA-256 digest is unavailable; installation stopped.'
            }
            $expected = $assets[0].digest.Substring(7)
        }
        else {
            $checksum = Join-Path $temporary 'checksum'
            Invoke-WebRequest -UseBasicParsing -Uri "$url.sha256" -OutFile $checksum -Headers $headers -TimeoutSec 30
            $expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0]
        }
        if ($expected -notmatch '^[0-9a-fA-F]{64}$') { throw 'Invalid SHA-256 checksum.' }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) {
            throw 'SHA-256 checksum mismatch; existing installation was not changed.'
        }

        $extracted = Join-Path $temporary 'extracted'
        Expand-Archive -LiteralPath $archive -DestinationPath $extracted
        $binary = Join-Path $extracted 'rauto.exe'
        if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { throw 'Archive does not contain rauto.exe.' }
        $originalRautoHome = $env:RAUTO_HOME
        try {
            $env:RAUTO_HOME = Join-Path $temporary 'data'
            $reported = & $binary --version
            if ($LASTEXITCODE -ne 0 -or "$reported".Trim() -ne "rauto $Version") {
                throw 'The binary cannot start or its version does not match; existing installation was not changed.'
            }
        }
        finally { $env:RAUTO_HOME = $originalRautoHome }

        $null = New-Item -ItemType Directory -Path $InstallDir -Force
        $destination = Join-Path $InstallDir 'rauto.exe'
        $staged = Join-Path $InstallDir ('.rauto-install-' + [Guid]::NewGuid().ToString('N') + '.exe')
        Copy-Item -LiteralPath $binary -Destination $staged
        if (Test-Path -LiteralPath $destination) {
            $item = Get-Item -LiteralPath $destination -Force
            if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw 'Install destination must be a regular file.'
            }
            # Replace on the same volume; a locked executable leaves the old file intact.
            [IO.File]::Replace($staged, $destination, [NullString]::Value)
        }
        else { [IO.File]::Move($staged, $destination) }
        $staged = $null

        if (-not $NoPathUpdate) {
            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
            $entries = @($userPath -split ';' | Where-Object { $_ })
            if ($entries -notcontains $InstallDir) {
                [Environment]::SetEnvironmentVariable('Path', (($entries + $InstallDir) -join ';'), 'User')
            }
            if (($env:PATH -split ';') -notcontains $InstallDir) {
                $env:PATH = "$InstallDir;$env:PATH"
            }
        }
        Write-Host "Installed rauto $Version to $destination"
        if ($NoPathUpdate) { Write-Host "Add $InstallDir to PATH to run rauto by name." }
        else { Write-Host 'PATH updated for this session and future terminals.' }
    }
    finally {
        if ($staged -and (Test-Path -LiteralPath $staged)) { Remove-Item -LiteralPath $staged -Force }
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
    }
}

$originalTls = [Net.ServicePointManager]::SecurityProtocol
try {
    [Net.ServicePointManager]::SecurityProtocol = $originalTls -bor [Net.SecurityProtocolType]::Tls12
    Install-Rauto
}
finally { [Net.ServicePointManager]::SecurityProtocol = $originalTls }
