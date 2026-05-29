resource "google_cloud_run_v2_service" "api_gateway" {
  name     = "qhoot-api-gateway"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cloudvote-repo/api-gateway:latest"

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "TOPIC_ID"
        value = "qhoot-incoming-votes"
      }
    }
  }

  depends_on = [google_project_service.enabled_apis]
}

# Allow unauthenticated requests (players don't log in)
resource "google_cloud_run_v2_service_iam_member" "api_gateway_public" {
  name     = google_cloud_run_v2_service.api_gateway.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}