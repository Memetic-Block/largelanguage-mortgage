# Stub Nomad job spec for Redis
job "mortgage-redis" {
  datacenters = ["dc1"]
  group "redis" {
    task "redis" {
      driver = "docker"
      
      config {
        image = "redis:7-alpine"
      }
    }
  }
}