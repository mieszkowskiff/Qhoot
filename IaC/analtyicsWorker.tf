# Zips the source code for the Archiver function
data "archive_file" "archiver_source" {
  type        = "zip"
  source_dir  = "${path.module}/../CloudFunctions/AnalyticsWorker"
  output_path = "${path.module}/archiver-source.zip"
}

# Uploads the zip to the existing bucket
resource "google_storage_bucket_object" "archiver_zip" {
  name   = "archiver-${data.archive_file.archiver_source.output_md5}.zip"
  bucket = google_storage_bucket.functions_bucket.name
  source = data.archive_file.archiver_source.output_path
}

# The Archiver Cloud Function (Gen2)
resource "google_cloudfunctions2_function" "data_archiver" {
  name        = "data-archiver"
  location    = var.region
  description = "Archives finished game data from Firestore to BigQuery"

  build_config {
    runtime     = "python312"
    entry_point = "archive_finished_game"
    source {
      storage_source {
        bucket = google_storage_bucket.functions_bucket.name
        object = google_storage_bucket_object.archiver_zip.name
      }
    }
  }

  service_config {
    max_instance_count = 10
    available_memory   = "256M"
    timeout_seconds    = 120
    
    environment_variables = {
      PROJECT_ID      = var.project_id
      BQ_DATASET_ID   = "cloudvote_archive" # Zmień na swoją nazwę z Terraforma
      BQ_TABLE_ID     = "game_results"      # Zmień na swoją nazwę z Terraforma
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.firestore.v1.document.written"
    retry_policy   = "RETRY_POLICY_RETRY"
    
    # Needs a service account with permissions to read Firestore and write to BigQuery
    service_account_email = google_service_account.function_runner.email

    # Konfiguracja Eventarc dla Gen 2
    event_filters {
      attribute = "database"
      value     = "(default)"
    }

    event_filters {
      attribute = "namespace"
      value     = "(default)"
    }

    event_filters {
      attribute = "document"
      value     = "games/{gameId}"
      operator  = "match-path-pattern"
    }
  }

  depends_on = [google_project_service.eventarc]
}