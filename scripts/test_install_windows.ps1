#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$installer = Join-Path (Split-Path $PSScriptRoot -Parent) 'install.ps1'
$parseErrors = $null
$tokens = $null
$installerAst = [Management.Automation.Language.Parser]::ParseFile($installer, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$root = Join-Path ([IO.Path]::GetTempPath()) ('rauto-installer-test-' + [Guid]::NewGuid().ToString('N'))
$originalUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$originalEnvironment = @{}
foreach ($name in @('TEMP', 'TMP', 'PATH', 'RAUTO_HOME', 'PROCESSOR_ARCHITECTURE', 'PROCESSOR_ARCHITEW6432', 'RAUTO_FIXTURE_VERSION', 'RAUTO_FIXTURE_EXIT')) {
    $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$originalTls = [Net.ServicePointManager]::SecurityProtocol
$originalProfile = $PROFILE
$fixture = @{
    Requests = [Collections.Generic.List[string]]::new()
    Mode = ''
    Digest = ''
    Archive = ''
}
$script:passed = 0

function Assert-True($Condition, $Message) {
    if (-not $Condition) { throw $Message }
}

# Bind mutable fixture state to each mock instead of the caller's script scope.
Set-Item -Path Function:Invoke-RestMethod -Value ({
    param($Uri, $Headers, $TimeoutSec)
    $fixture.Requests.Add($Uri)
    if ($Uri.EndsWith('/latest')) { return @{ tag_name = 'v9.8.7' } }
    return @{ assets = @(@{ name = 'rauto-windows-amd64.exe.zip'; digest = "sha256:$($fixture.Digest)" }) }
}.GetNewClosure())

Set-Item -Path Function:Invoke-WebRequest -Value ({
    param([switch]$UseBasicParsing, $Uri, $OutFile, $Headers, $TimeoutSec)
    $fixture.Requests.Add($Uri)
    if ($fixture.Mode -eq 'download-failure') { throw 'Fixture download failed' }
    if ($Uri.EndsWith('.sha256')) {
        if ($fixture.Mode -eq 'missing-checksum') { throw 'Fixture checksum unavailable' }
        $checksum = $fixture.Digest
        if ($fixture.Mode -eq 'mismatch') { $checksum = '0' * 64 }
        if ($fixture.Mode -eq 'invalid-checksum') { $checksum = 'invalid' }
        "$checksum  rauto-windows-amd64.exe.zip" | Set-Content -LiteralPath $OutFile -Encoding ascii
    }
    else { Copy-Item -LiteralPath $fixture.Archive -Destination $OutFile }
}.GetNewClosure())

function Test-DownloadMockScopes {
    $directory = Join-Path ([IO.Path]::GetTempPath()) ('rauto-mock-scope-test-' + [Guid]::NewGuid().ToString('N'))
    try {
        $null = New-Item -ItemType Directory -Path $directory
        $fixture.Archive = Join-Path $directory 'source.zip'
        $fixture.Digest = 'a' * 64
        'fixture archive' | Set-Content -LiteralPath $fixture.Archive -Encoding ascii
        $probe = Join-Path $directory 'probe.ps1'
        @'
param([string]$OutputDir)
Set-StrictMode -Version Latest
$release = Invoke-RestMethod -Uri 'https://fixture/latest'
if ($release.tag_name -ne 'v9.8.7') { throw 'Mock release version mismatch' }
$release = Invoke-RestMethod -Uri 'https://fixture/tags/v9.8.7'
Invoke-WebRequest -Uri 'https://fixture/release.zip' -OutFile (Join-Path $OutputDir 'download.zip')
Invoke-WebRequest -Uri 'https://fixture/release.zip.sha256' -OutFile (Join-Path $OutputDir 'checksum')
$expected = $release.assets[0].digest.Substring(7)
$checksum = (Get-Content -LiteralPath (Join-Path $OutputDir 'checksum') -Raw).Trim().Split(' ')[0]
if ($checksum -ne $expected) { throw 'Mock checksum mismatch' }
'@ | Set-Content -LiteralPath $probe -Encoding ascii
        foreach ($scriptBlock in @($false, $true)) {
            $fixture.Requests.Clear()
            if ($scriptBlock) { & ([scriptblock]::Create((Get-Content -LiteralPath $probe -Raw))) -OutputDir $directory }
            else { & $probe -OutputDir $directory }
            Assert-True ($fixture.Requests.Count -eq 4) 'Mock requests were not shared across script scopes'
            Assert-True ((Get-FileHash -LiteralPath (Join-Path $directory 'download.zip')).Hash -eq (Get-FileHash -LiteralPath $fixture.Archive).Hash) 'Mock archive was not copied'
        }
        $fixture.Mode = 'download-failure'
        $failure = $null
        try { & $probe -OutputDir $directory } catch { $failure = $_ }
        Assert-True ($null -ne $failure -and $failure.Exception.Message -eq 'Fixture download failed') 'Mock did not observe an updated failure mode'
        Write-Host 'PASS: download mocks share state across file and scriptblock invocations'
    }
    finally {
        $fixture.Requests.Clear()
        $fixture.Mode = ''
        $fixture.Archive = ''
        $fixture.Digest = ''
        if (Test-Path -LiteralPath $directory) { Remove-Item -LiteralPath $directory -Recurse -Force }
    }
}

Test-DownloadMockScopes

function Test-CompletionProfileEncodings {
    $directory = Join-Path ([IO.Path]::GetTempPath()) ('rauto-profile-test-' + [Guid]::NewGuid().ToString('N'))
    $PROFILE = Join-Path $directory 'profile.ps1'
    $definition = $installerAst.Find({ param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Install-RautoCompletions'
    }, $true)
    . ([scriptblock]::Create($definition.Extent.Text))
    function Invoke-FixtureCompletion {
        $script:LASTEXITCODE = 0
        '# fixture PowerShell completions'
    }
    try {
        $null = New-Item -ItemType Directory -Path $directory
        $content = '$work = "C:\caf' + [char]233 + '"'
        foreach ($encoding in @(
            [Text.Encoding]::GetEncoding(1252),
            [Text.UTF8Encoding]::new($false),
            [Text.UTF8Encoding]::new($true),
            [Text.Encoding]::Unicode,
            [Text.Encoding]::BigEndianUnicode,
            [Text.Encoding]::UTF32
        )) {
            $original = [byte[]]($encoding.GetPreamble() + $encoding.GetBytes($content))
            [IO.File]::WriteAllBytes($PROFILE, $original)
            Install-RautoCompletions -Binary Invoke-FixtureCompletion -Directory $directory
            $after = [IO.File]::ReadAllBytes($PROFILE)
            Assert-True ($after.Length -gt $original.Length) 'Completion registration was not appended'
            Assert-True ([Convert]::ToBase64String($after[0..($original.Length - 1)]) -eq [Convert]::ToBase64String($original)) "Profile bytes changed for $($encoding.WebName)"
            Install-RautoCompletions -Binary Invoke-FixtureCompletion -Directory $directory
            Assert-True ([Convert]::ToBase64String([IO.File]::ReadAllBytes($PROFILE)) -eq [Convert]::ToBase64String($after)) "Duplicate registration for $($encoding.WebName)"
        }
        Write-Host 'PASS: completion registration preserves ANSI, UTF-8, UTF-16 and UTF-32 profile bytes'
    }
    finally { if (Test-Path -LiteralPath $directory) { Remove-Item -LiteralPath $directory -Recurse -Force } }
}

Test-CompletionProfileEncodings
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    Write-Host 'PowerShell syntax and mock scopes OK. Windows is required for installation tests.'
    return
}

function Test-Install {
    param([string]$Name, [string]$Mode = '', [string]$RequestedVersion, [switch]$Fails, [switch]$UpdatePath, [switch]$ScriptBlock, [switch]$Fresh, [switch]$Completions)
    $fixture.Mode = $Mode
    $fixture.Requests.Clear()
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
    $fixture.Archive = Join-Path $root 'release.zip'
    if ($Mode -eq 'missing-binary') { $fixture.Archive = Join-Path $root 'missing.zip' }
    $fixture.Digest = (Get-FileHash -LiteralPath $fixture.Archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $parameters = @{ InstallDir = $bin; NoPathUpdate = -not $UpdatePath; NoCompletions = -not $Completions }
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
    $PROFILE = Join-Path $root 'profile\Microsoft.PowerShell_profile.ps1'
    $null = New-Item -ItemType Directory -Path $root
    $env:TEMP = Join-Path $root 'temp'
    $env:TMP = $env:TEMP
    $null = New-Item -ItemType Directory -Path $env:TEMP
    $source = Join-Path $root 'fixture.cs'
    @'
using System;
class Fixture {
    static int Main(string[] args) {
        if (args.Length > 0 && args[0] == "completion") {
            Console.WriteLine("# fixture PowerShell completions");
            return 0;
        }
        if (!Environment.GetEnvironmentVariable("RAUTO_HOME").Contains("rauto-install-")) return 2;
        Console.WriteLine("rauto " + Environment.GetEnvironmentVariable("RAUTO_FIXTURE_VERSION"));
        return int.Parse(Environment.GetEnvironmentVariable("RAUTO_FIXTURE_EXIT"));
    }
}
'@ | Set-Content -LiteralPath $source -Encoding ascii
    $binary = Join-Path $root 'rauto.exe'
    # Resolve the compiler from the legacy .NET Framework and Visual Studio
    # Roslyn locations so the fixture works across runner image versions.
    $compilerCandidates = @(
        (Get-Command csc.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source),
        (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
        (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'),
        (Join-Path $env:ProgramFiles 'Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\Roslyn\csc.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\Roslyn\csc.exe')
    )
    $compiler = $compilerCandidates |
        Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
        Select-Object -First 1
    if (-not $compiler) { throw 'Could not locate the C# compiler on the Windows runner.' }
    & $compiler /nologo /target:exe "/out:$binary" $source
    if ($LASTEXITCODE -ne 0) { throw 'Fixture compilation failed' }
    $script:binaryHash = (Get-FileHash -LiteralPath $binary).Hash
    Compress-Archive -LiteralPath $binary -DestinationPath (Join-Path $root 'release.zip')
    Compress-Archive -LiteralPath $source -DestinationPath (Join-Path $root 'missing.zip')

    Test-Install 'first installation' -Fresh
    Test-Install 'latest release'
    Assert-True ($fixture.Requests[0].EndsWith('/latest')) 'Latest release was not resolved'
    Test-Install 'explicit version' -RequestedVersion 'v9.8.7'
    Assert-True (-not ($fixture.Requests -match '/latest$')) 'Explicit version queried latest'
    Test-Install 'README scriptblock invocation' -ScriptBlock
    Test-Install '0.5.2 API digest' -Mode legacy -RequestedVersion '0.5.2'
    foreach ($mode in @('mismatch', 'invalid-checksum', 'missing-checksum', 'download-failure', 'missing-binary', 'wrong-version', 'unrunnable', 'locked', 'unsupported')) {
        Test-Install $mode -Mode $mode -Fails
    }
    Test-Install 'invalid version' -RequestedVersion '../bad' -Fails
    Assert-True ($fixture.Requests.Count -eq 0) 'Invalid version attempted a download'
    Assert-True (-not (Test-Path -LiteralPath $PROFILE)) 'NoCompletions changed the PowerShell profile'
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $PROFILE) -Force
    '# existing settings' | Set-Content -LiteralPath $PROFILE
    Test-Install 'PowerShell completions' -Completions -ScriptBlock
    Test-Install 'PowerShell completion registration is idempotent' -Completions
    Assert-True ((Get-Content -LiteralPath $PROFILE -Raw).StartsWith('# existing settings')) 'Completion setup replaced the profile'
    Assert-True (@(Get-Content -LiteralPath $PROFILE | Where-Object { $_ -like '*# rauto completion' }).Count -eq 1) 'Duplicate completion profile entry'
    Assert-True ((Get-Content -LiteralPath (Join-Path $root 'installed bin\rauto-completion.ps1') -Raw) -match 'fixture PowerShell completions') 'Completion script was not installed'
    [IO.File]::WriteAllText($PROFILE, '# UTF-16 profile', [Text.Encoding]::Unicode)
    Test-Install 'UTF-16 PowerShell profile' -Completions
    $profileBytes = [IO.File]::ReadAllBytes($PROFILE)
    Assert-True ($profileBytes[0] -eq 255 -and $profileBytes[1] -eq 254) 'Profile encoding changed'
    Assert-True ((Get-Content -LiteralPath $PROFILE -Raw).StartsWith('# UTF-16 profile')) 'UTF-16 profile content changed'
    Test-Install 'user PATH registration' -UpdatePath
    Test-Install 'PATH registration is idempotent' -UpdatePath
    $entries = [Environment]::GetEnvironmentVariable('Path', 'User') -split ';'
    Assert-True (@($entries | Where-Object { $_ -eq (Join-Path $root 'installed bin') }).Count -eq 1) 'Duplicate user PATH entry'
    Write-Host "$script:passed Windows installer tests passed"
}
finally {
    $PROFILE = $originalProfile
    [Environment]::SetEnvironmentVariable('Path', $originalUserPath, 'User')
    foreach ($name in $originalEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $originalEnvironment[$name], 'Process')
    }
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
