# Creates an Artifact Registry repository for Docker images
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "cloudvote-repo"
  description   = "Docker repository for CloudVote microservices"
  format        = "DOCKER"
}