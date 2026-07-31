param(
  [Parameter(Mandatory = $true)]
  [string]$Address,

  [string]$Profile = "shelbynet",
  [string]$Fullnode = "https://api.shelbynet.shelby.xyz/v1",
  [string]$AptosApiKey = $env:VITE_APTOS_API_KEY
)

$ErrorActionPreference = "Stop"

if ($Address -notmatch '^0x[a-fA-F0-9]{1,64}$' -or $Address.ToLowerInvariant() -eq '0xcafe') {
  throw "Address must be the real Shelbinet deployer address, not empty or 0xcafe."
}

$common = @("--skip-fetch-latest-git-deps", "--named-addresses", "stash=$Address")

Write-Host "Compiling Stash Move package for $Address..."
aptos move compile @common

Write-Host "Running Move unit tests in dev mode..."
aptos move test --skip-fetch-latest-git-deps --dev

Write-Host "Publishing Stash package to Shelbinet..."
$publishArgs = @(
  "move", "publish",
  "--url", $Fullnode,
  "--profile", $Profile,
  "--named-addresses", "stash=$Address",
  "--included-artifacts", "sparse",
  "--assume-yes"
)

if ($AptosApiKey) {
  $publishArgs += @("--node-api-key", $AptosApiKey)
}

aptos @publishArgs

Write-Host "Published. Set VITE_STASH_MODULE_ADDRESS=$Address in .env.local and hosting env."
