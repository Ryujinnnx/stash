$ErrorActionPreference = "Stop"

Write-Host "Checking Stash Shelbinet readiness..."

$required = @(
  "VITE_APTOS_NETWORK",
  "VITE_APTOS_FULLNODE_URL",
  "VITE_APTOS_INDEXER_URL",
  "VITE_SHELBY_RPC_URL",
  "VITE_STASH_MODULE_ADDRESS"
)

foreach ($key in $required) {
  $value = [Environment]::GetEnvironmentVariable($key)
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Warning "$key is missing in the current shell. Check .env.local or hosting env."
  } else {
    Write-Host "$key is set"
  }
}

npm.cmd run typecheck
npm.cmd run build
aptos move compile --skip-fetch-latest-git-deps --dev
aptos move test --skip-fetch-latest-git-deps --dev
