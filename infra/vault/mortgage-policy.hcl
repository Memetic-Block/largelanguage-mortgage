# Vault policy for mortgage API
# This policy allows read access to the mortgage API secrets
path "secret/mortgage/api/*" {
  capabilities = ["read"]
}