# Creates a dedicated Service Account for the Archiver Cloud Function
resource "google_service_account" "function_runner" {
  account_id   = "archiver-function-sa"
  display_name = "Service Account for Archiver Function"
}

# Grants the function permission to receive events from Eventarc (Firestore triggers)
resource "google_project_iam_member" "eventarc_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.function_runner.email}"
}

# Grants the function permission to read from Firestore
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.function_runner.email}"
}

# Grants the function permission to edit data in BigQuery (insert rows)
resource "google_project_iam_member" "bigquery_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.function_runner.email}"
}

# Creates a Cloud Storage bucket to hold the zipped source code of our functions
resource "google_storage_bucket" "functions_bucket" {
  name                        = "${var.project_id}-functions-source"
  location                    = var.region
  uniform_bucket_level_access = true
}

# Enables the Eventarc API required for Cloud Functions Gen2 Pub/Sub triggers
resource "google_project_service" "eventarc" {
  project = var.project_id
  service = "eventarc.googleapis.com"
  disable_on_destroy = false
}

# Automatically zips the contents of the worker directory based on the new project structure
# Assuming this Terraform code is executed from the /IaC directory
data "archive_file" "worker_source" {
  type        = "zip"
  source_dir  = "${path.module}/../vote_worker"
  output_path = "${path.module}/worker-source.zip"
}

# Uploads the generated zip file to the Cloud Storage bucket
resource "google_storage_bucket_object" "worker_zip" {
  # We append the MD5 hash so Terraform knows when the code has changed and forces an update
  name   = "worker-${data.archive_file.worker_source.output_md5}.zip"
  bucket = google_storage_bucket.functions_bucket.name
  source = data.archive_file.worker_source.output_path
}

# Defines the actual Cloud Function Gen2 (Worker)
resource "google_cloudfunctions2_function" "vote_worker" {
  name        = "vote-worker"
  location    = var.region
  description = "Worker that processes votes from Pub/Sub and updates Firestore"

  build_config {
    runtime     = "python312"
    entry_point = "process_vote" # This will be the name of the python function inside main.py
    source {
      storage_source {
        bucket = google_storage_bucket.functions_bucket.name
        object = google_storage_bucket_object.worker_zip.name
      }
    }
  }

  service_config {
    max_instance_count = 100
    min_instance_count = 0
    available_memory   = "256M"
    timeout_seconds    = 60
    
    environment_variables = {
      PROJECT_ID = var.project_id
    }
  }

  # Configures the trigger to be our Pub/Sub topic
  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.incoming_votes.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }
}