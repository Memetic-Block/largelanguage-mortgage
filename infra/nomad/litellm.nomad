# Stub Nomad job spec for LiteLLM
job "mortgage-litellm" {
  datacenters = ["dc1"]
  group "litellm" {
    task "litellm" {
      driver = "docker"
      
      config {
        image = "ghcr.io/berriai/litellm:main-latest"
      }
    }
  }
}