#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$installer = Join-Path (Split-Path $PSScriptRoot -Parent) 'install.ps1'
$parseErrors = $null
$tokens = $null
$null = [Management.Automation.Language.Parser]::ParseFile($installer, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    Write-Host 'PowerShell syntax OK. Windows is required for installation tests.'
    return
}

$root = Join-Path ([IO.Path]::GetTempPath()) ('rauto-installer-test-' + [Guid]::NewGuid().ToString('N'))
$originalUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$originalEnvironment = @{}
foreach ($name in @('TEMP', 'TMP', 'PATH', 'RAUTO_HOME', 'PROCESSOR_ARCHITECTURE', 'PROCESSOR_ARCHITEW6432', 'RAUTO_FIXTURE_VERSION', 'RAUTO_FIXTURE_EXIT')) {
    $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$originalTls = [Net.ServicePointManager]::SecurityProtocol
$script:requests = [Collections.Generic.List[string]]::new()
$script:mode = ''
$script:passed = 0

function Assert-True($Condition, $Message) {
    if (-not $Condition) { throw $Message }
}

function Invoke-RestMethod {
    param($Uri, $Headers, $TimeoutSec)
    $script:requests.Add($Uri)
    if ($Uri.EndsWith('/latest')) { return @{ tag_name = 'v9.8.7' } }
    return @{ assets = @(@{ name = 'rauto-windows-amd64.exe.zip'; digest = "sha256:$script:digest" }) }
}

function Invoke-WebRequest {
    param([switch]$UseBasicParsing, $Uri, $OutFile, $Headers, $TimeoutSec)
    $script:requests.Add($Uri)
    if ($script:mode -eq 'download-failure') { throw 'Fixture download failed' }
    if ($Uri.EndsWith('.sha256')) {
        if ($script:mode -eq 'missing-checksum') { throw 'Fixture checksum unavailable' }
        $checksum = $script:digest
        if ($script:mode -eq 'mismatch') { $checksum = '0' * 64 }
        if ($script:mode -eq 'invalid-checksum') { $checksum = 'invalid' }
        "$checksum  rauto-windows-amd64.exe.zip" | Set-Content -LiteralPath $OutFile -Encoding ascii
    }
    else { Copy-Item -LiteralPath $script:archive -Destination $OutFile }
}

function Test-Install {
    param([string]$Name, [string]$Mode = '', [string]$RequestedVersion, [switch]$Fails, [switch]$UpdatePath, [switch]$ScriptBlock, [switch]$Fresh)
    $script:mode = $Mode
    $script:requests.Clear()
    $bin = Join-Path $root 'installed bin'
    if (Test-Path -LiteralPath $bin) { Remove-Item -LiteralPath $bin -Recurse -Force }
    $null = New-Item -ItemType Directory -Path $bin
    $destination = Join-Path $bin 'rauto.exe'
    'old installation' | Set-Content -LiteralPath $destination
    $oldHash = (Get-FileHash -LiteralPath $destination).Hash
    if ($Fresh) { Remove-Item -LiteralPath $destination }
    $env:RAUTO_HOME = 'original-runtime-directory'
    $env:RAUTO_FIXTURE_VERSION = '9.8.7'
    $env:RAUTO_FIXTURE_EXIT = '0'
    $env:PROCESSOR_ARCHITECTURE = 'AMD64'
    $env:PROCESSOR_ARCHITEW6432 = $null
    if ($Mode -eq 'wrong-version') { $env:RAUTO_FIXTURE_VERSION = '1.0.0' }
    if ($Mode -eq 'legacy') { $env:RAUTO_FIXTURE_VERSION = '0.5.2' }
    if ($Mode -eq 'unrunnable') { $env:RAUTO_FIXTURE_EXIT = '1' }
    if ($Mode -eq 'unsupported') { $env:PROCESSOR_ARCHITECTURE = 'ARM64' }
    $script:archive = Join-Path $root 'release.zip'
    if ($Mode -eq 'missing-binary') { $script:archive = Join-Path $root 'missing.zip' }
    $script:digest = (Get-FileHash -LiteralPath $script:archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $parameters = @{ InstallDir = $bin; NoPathUpdate = -not $UpdatePath }
    if ($RequestedVersion) { $parameters.Version = $RequestedVersion }
    $lock = $null
    if ($Mode -eq 'locked') { $lock = [IO.File]::Open($destination, 'Open', 'Read', 'None') }
    $failure = $null
    try {
        if ($ScriptBlock) {
            & ([scriptblock]::Create((Get-Content -LiteralPath $installer -Raw))) @parameters
        }
        else { & $installer @parameters }
    }
    catch { $failure = $_ }
    finally { if ($lock) { $lock.Dispose() } }
    if ($Fails) {
        Assert-True ($null -ne $failure) "$Name should fail"
        Assert-True ((Get-FileHash -LiteralPath $destination).Hash -eq $oldHash) "$Name replaced the old installation"
    }
    else {
        if ($failure) { throw $failure }
        Assert-True ((Get-FileHash -LiteralPath $destination).Hash -eq $script:binaryHash) "$Name did not install the binary"
    }
    Assert-True ($env:RAUTO_HOME -eq 'original-runtime-directory') "$Name changed RAUTO_HOME"
    Assert-True ([Net.ServicePointManager]::SecurityProtocol -eq $originalTls) "$Name changed TLS settings"
    Assert-True (@(Get-ChildItem -LiteralPath $env:TEMP -Force).Count -eq 0) "$Name left temporary files"
    Assert-True (@(Get-ChildItem -LiteralPath $bin -Filter '.rauto-install-*').Count -eq 0) "$Name left staging files"
    if ($UpdatePath) {
        Assert-True (($env:PATH -split ';') -contains $bin) 'Current PATH missing install directory'
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        Assert-True (($userPath -split ';') -contains $bin) 'User PATH missing install directory'
    }
    else {
        Assert-True ([Environment]::GetEnvironmentVariable('Path', 'User') -eq $originalUserPath) "$Name changed user PATH"
        Assert-True ($env:PATH -eq $originalEnvironment['PATH']) "$Name changed current PATH"
    }
    $script:passed++
    Write-Host "PASS: $Name"
}

try {
    $null = New-Item -ItemType Directory -Path $root
    $env:TEMP = Join-Path $root 'temp'
    $env:TMP = $env:TEMP
    $null = New-Item -ItemType Directory -Path $env:TEMP
    $source = Join-Path $root 'fixture.cs'
    @'
using System;
class Fixture {
    static int Main(string[] args) {
        if (!Environment.GetEnvironmentVariable("RAUTO_HOME").Contains("rauto-install-")) return 2;
        Console.WriteLine("rauto " + Environment.GetEnvironmentVariable("RAUTO_FIXTURE_VERSION"));
        return int.Parse(Environment.GetEnvironmentVariable("RAUTO_FIXTURE_EXIT"));
    }
}
'@ | Set-Content -LiteralPath $source -Encoding ascii
    $binary = Join-Path $root 'rauto.exe'
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    & $compiler /nologo /target:exe "/out:$binary" $source
    if ($LASTEXITCODE -ne 0) { throw 'Fixture compilation failed' }
    $script:binaryHash = (Get-FileHash -LiteralPath $binary).Hash
    Compress-Archive -LiteralPath $binary -DestinationPath (Join-Path $root 'release.zip')
    Compress-Archive -LiteralPath $source -DestinationPath (Join-Path $root 'missing.zip')

    Test-Install 'first installation' -Fresh
    Test-Install 'latest release'
    Assert-True ($script:requests[0].EndsWith('/latest')) 'Latest release was not resolved'
    Test-Install 'explicit version' -RequestedVersion 'v9.8.7'
    Assert-True (-not ($script:requests -match '/latest$')) 'Explicit version queried latest'
    Test-Install 'README scriptblock invocation' -ScriptBlock
    Test-Install '0.5.2 API digest' -Mode legacy -RequestedVersion '0.5.2'
    foreach ($mode in @('mismatch', 'invalid-checksum', 'missing-checksum', 'download-failure', 'missing-binary', 'wrong-version', 'unrunnable', 'locked', 'unsupported')) {
        Test-Install $mode -Mode $mode -Fails
    }
    Test-Install 'invalid version' -RequestedVersion '../bad' -Fails
    Assert-True ($script:requests.Count -eq 0) 'Invalid version attempted a download'
    Test-Install 'user PATH registration' -UpdatePath
    Test-Install 'PATH registration is idempotent' -UpdatePath
    $entries = [Environment]::GetEnvironmentVariable('Path', 'User') -split ';'
    Assert-True (@($entries | Where-Object { $_ -eq (Join-Path $root 'installed bin') }).Count -eq 1) 'Duplicate user PATH entry'
    Write-Host "$script:passed Windows installer tests passed"
}
finally {
    [Environment]::SetEnvironmentVariable('Path', $originalUserPath, 'User')
    foreach ($name in $originalEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $originalEnvironment[$name], 'Process')
    }
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
