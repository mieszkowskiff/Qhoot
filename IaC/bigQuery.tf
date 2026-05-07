# Creates the BigQuery dataset for post-event analytics
resource "google_bigquery_dataset" "quiz_analytics" {
  dataset_id  = "quiz_analytics"
  location    = var.region
  description = "Dataset for storing historical data and reporting"
  
  labels = {
    environment = "dev"
    component   = "analytics"
  }
}

# Creates the main table for streaming quiz rows
resource "google_bigquery_table" "quiz_results" {
  dataset_id = google_bigquery_dataset.quiz_analytics.dataset_id
  table_id   = "results"
  
  # Set to true for production to prevent accidental data loss
  deletion_protection = false 
  
  # Note: The exact schema depends on the payload sent by the Analytics Worker.
}

# Defines the Cloud Run service for the API Gateway
resource "google_cloud_run_v2_service" "api_gateway" {
  name     = "api-gateway"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      # Points to the Docker image we just built and pushed
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cloudvote-repo/api-gateway:latest"
      
      # Injects environment variables directly into the container
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      
      env {
        name  = "TOPIC_ID"
        # Best practice: reference the Pub/Sub topic resource dynamically
        value = google_pubsub_topic.incoming_votes.name
      }
    }
  }
}

# Grants public access to the Cloud Run service so players can submit votes
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.api_gateway.location
  project  = google_cloud_run_v2_service.api_gateway.project
  service  = google_cloud_run_v2_service.api_gateway.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}