# video-studio - link the skill into every agent that reads SKILL.md
#
#   .\install.ps1                 # every agent skill dir found on this machine
#   .\install.ps1 -Targets dsh    # just one
#   .\install.ps1 -Remove         # remove the links (this repo is untouched)
#   .\install.ps1 -Verify         # only prove what is already wired
#
# Links are junctions: editing this folder updates the skill everywhere, no copy step.

[CmdletBinding()]
param(
  [string[]]$Targets = @('dsh', 'claude', 'opencode', 'agents', 'hermes'),
  [switch]$Remove,
  [switch]$Verify
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillName = 'video-studio'

# Where each agent looks for skills.
$map = [ordered]@{
  'dsh'      = Join-Path $HOME '.dsh\skills'
  'claude'   = Join-Path $HOME '.claude\skills'
  'opencode' = Join-Path $HOME '.config\opencode\skills'
  'agents'   = Join-Path $HOME '.agents\skills'
  'hermes'   = Join-Path $HOME '.hermes\skills'
}

if (-not (Test-Path (Join-Path $here 'SKILL.md'))) {
  throw 'SKILL.md not found next to this script. Run it from the repo root.'
}

function Invoke-Verify {
  $py = Get-Command python -ErrorAction SilentlyContinue
  if ($py) {
    & $py.Source (Join-Path $here 'scripts\install_check.py')
    exit $LASTEXITCODE
  }
  Write-Host 'python not found - checking links directly'
  $bad = 0
  foreach ($t in $map.Keys) {
    $link = Join-Path $map[$t] $skillName
    $ok = (Test-Path (Join-Path $link 'SKILL.md')) -and (Test-Path (Join-Path $link 'references\corpus\index.json'))
    if (-not $ok) { $bad++ }
    Write-Host ("  [{0}] {1,-9} {2}" -f $(if ($ok) { 'OK ' } else { 'ERR' }), $t, $link)
  }
  exit $(if ($bad -eq 0) { 0 } else { 1 })
}

if ($Verify) { Invoke-Verify }

$results = @()
foreach ($t in $Targets) {
  if (-not $map.Contains($t)) { Write-Host "skip: unknown target '$t'"; continue }
  $dir = $map[$t]
  $link = Join-Path $dir $skillName

  if ($Remove) {
    if (Test-Path $link) {
      $item = Get-Item $link -Force
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $item.Delete() }
      else { Remove-Item $link -Recurse -Force }
      $results += [pscustomobject]@{ Agent = $t; Path = $link; State = 'removed' }
    }
    continue
  }

  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $state = 'linked'
  if (Test-Path $link) {
    $item = Get-Item $link -Force
    $isLink = [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
    if ($isLink) {
      $item.Delete()
      $state = 'relinked'
    } else {
      # a real directory is someone's work - never delete it
      Write-Host "skip: $link exists and is not a link (remove it by hand)"
      $results += [pscustomobject]@{ Agent = $t; Path = $link; State = 'skipped (real dir)' }
      continue
    }
  }
  New-Item -ItemType Junction -Path $link -Target $here | Out-Null
  $results += [pscustomobject]@{ Agent = $t; Path = $link; State = $state }
}

$results | Format-Table -AutoSize

if (-not $Remove) {
  Write-Host ''
  Write-Host 'Verify:' -ForegroundColor Cyan
  foreach ($r in $results) {
    if ($r.State -eq 'skipped (real dir)') { continue }
    $ok = Test-Path (Join-Path $r.Path 'SKILL.md')
    $mark = if ($ok) { 'OK ' } else { 'ERR' }
    Write-Host ("  [{0}] {1,-9} {2}" -f $mark, $r.Agent, $r.Path)
  }
  Write-Host ''
  Write-Host 'Deep check (links, frontmatter, every file an agent needs):' -ForegroundColor Cyan
  $py = Get-Command python -ErrorAction SilentlyContinue
  if ($py) { & $py.Source (Join-Path $here 'scripts\install_check.py') } else { Write-Host '  python not found; skipped' }
  Write-Host ''
  Write-Host 'Next: ask the agent for a video - the skill triggers on its own.' -ForegroundColor Green
  Write-Host 'First run in the repo:  npm install  then  pip install -r requirements.txt  then  python scripts/studio.py doctor'
}