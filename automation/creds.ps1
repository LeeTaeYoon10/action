# DPAPI 자격증명 관리 (이 PC+이 Windows계정에서만 복호화 가능)
#   저장:  powershell -File creds.ps1 -Action set -Key cafe24-basetune -Id "아이디" -Pw "비번"
#   확인:  powershell -File creds.ps1 -Action show -Key cafe24-basetune
param([string]$Action = "", [string]$Key = "", [string]$Id = "", [string]$Pw = "")
$ErrorActionPreference = "Stop"
$file = Join-Path $PSScriptRoot "secrets.enc.json"

function Load-Data { if (Test-Path $file) { Get-Content $file -Raw -Encoding utf8 | ConvertFrom-Json } else { [PSCustomObject]@{} } }
function Decrypt-Str([string]$enc) { (New-Object System.Management.Automation.PSCredential 'x', (ConvertTo-SecureString $enc)).GetNetworkCredential().Password }

if ($Action -eq "set") {
  $data = Load-Data
  $enc = [PSCustomObject]@{
    id = (ConvertTo-SecureString $Id -AsPlainText -Force | ConvertFrom-SecureString)
    pw = (ConvertTo-SecureString $Pw -AsPlainText -Force | ConvertFrom-SecureString)
  }
  $data | Add-Member -NotePropertyName $Key -NotePropertyValue $enc -Force
  $data | ConvertTo-Json -Depth 6 | Out-File $file -Encoding utf8 -NoNewline
  Write-Output "저장됨(DPAPI 암호화): $Key"
}
elseif ($Action -eq "show") {
  $e = (Load-Data).$Key
  if (-not $e) { Write-Output "없음: $Key"; exit }
  $id = Decrypt-Str $e.id; $pw = Decrypt-Str $e.pw
  Write-Output "$Key -> id=$id / pw길이=$($pw.Length)"
}
else { Write-Output "Action: set | show" }
