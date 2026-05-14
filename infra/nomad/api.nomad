# Stub Nomad job spec for API
job "mortgage-api" {
  datacenters = ["dc1"]
  group "api" {
    task "api" {
      driver = "docker"
      
      config {
        image = "mortgage/api:latest"
      }
    }
  }
}