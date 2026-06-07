# analytics.tf
#
# Event-Driven Analytics Pipeline
#
# Flow:
#   Firestore (rooms/{roomId}.status = "finished")
#     → Eventarc trigger
#     → Cloud Function "qhoot-analytics-worker"
#     → BigQuery (3 tabele)
#     → Looker Studio (https://lookerstudio.google.com)

# ── 1. Enable required APIs ──────────────────────────────────────────────────

resource "google_project_service" "analytics_apis" {
  for_each = toset([
    "bigquery.googleapis.com",
    "eventarc.googleapis.com",
    "storage.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# ── 2. BigQuery dataset & tables ─────────────────────────────────────────────

resource "google_bigquery_dataset" "quiz_analytics" {
  dataset_id  = "quiz_analytics"
  description = "Real-time quiz statistics written by analytics-worker on quiz completion"
  location    = var.region

  depends_on = [google_project_service.analytics_apis]
}

# Jedna sesja = jeden rozegrany pokój
resource "google_bigquery_table" "quiz_sessions" {
  dataset_id          = google_bigquery_dataset.quiz_analytics.dataset_id
  table_id            = "quiz_sessions"
  deletion_protection = false

  schema = jsonencode([
    { name = "room_id",        type = "STRING",    mode = "REQUIRED", description = "Firestore room document ID" },
    { name = "quiz_id",        type = "STRING",    mode = "NULLABLE" },
    { name = "player_count",   type = "INTEGER",   mode = "NULLABLE" },
    { name = "question_count", type = "INTEGER",   mode = "NULLABLE" },
    { name = "avg_score",      type = "FLOAT",     mode = "NULLABLE" },
    { name = "max_score",      type = "INTEGER",   mode = "NULLABLE", description = "Winning score" },
    { name = "finished_at",    type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "inserted_at",    type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# Wyniki per gracz per sesja — ranking, score, ile poprawnych
resource "google_bigquery_table" "player_results" {
  dataset_id          = google_bigquery_dataset.quiz_analytics.dataset_id
  table_id            = "player_results"
  deletion_protection = false

  schema = jsonencode([
    { name = "room_id",       type = "STRING",    mode = "REQUIRED" },
    { name = "player_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "nickname",      type = "STRING",    mode = "NULLABLE" },
    { name = "final_score",   type = "INTEGER",   mode = "NULLABLE" },
    { name = "correct_count", type = "INTEGER",   mode = "NULLABLE", description = "Liczba poprawnych odpowiedzi" },
    { name = "rank",          type = "INTEGER",   mode = "NULLABLE", description = "1 = winner" },
    { name = "inserted_at",   type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# Statystyki per pytanie — które było najtrudniejsze
resource "google_bigquery_table" "question_stats" {
  dataset_id          = google_bigquery_dataset.quiz_analytics.dataset_id
  table_id            = "question_stats"
  deletion_protection = false

  schema = jsonencode([
    { name = "room_id",         type = "STRING",    mode = "REQUIRED" },
    { name = "question_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "question_index",  type = "INTEGER",   mode = "NULLABLE", description = "Kolejność pytania (0-based)" },
    { name = "question_text",   type = "STRING",    mode = "NULLABLE" },
    { name = "total_answers",   type = "INTEGER",   mode = "NULLABLE" },
    { name = "correct_answers", type = "INTEGER",   mode = "NULLABLE" },
    { name = "correct_rate",    type = "FLOAT",     mode = "NULLABLE", description = "0.0 to 1.0" },
    { name = "inserted_at",     type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── 3. GCS bucket dla source code funkcji ────────────────────────────────────

resource "google_storage_bucket" "analytics_fn_source" {
  name                        = "${var.project_id}-analytics-fn-source"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true

  depends_on = [google_project_service.analytics_apis]
}

data "archive_file" "analytics_worker_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../analytics_worker"
  output_path = "${path.module}/.terraform/analytics_worker.zip"
  excludes    = ["__pycache__", "*.pyc", ".env"]
}

resource "google_storage_bucket_object" "analytics_fn_zip" {
  # Hash w nazwie → Terraform wykryje zmianę kodu i zrobi redeploy automatycznie
  name   = "analytics_worker-${data.archive_file.analytics_worker_zip.output_md5}.zip"
  bucket = google_storage_bucket.analytics_fn_source.name
  source = data.archive_file.analytics_worker_zip.output_path
}

# ── 4. Service account ────────────────────────────────────────────────────────

resource "google_service_account" "analytics_worker" {
  account_id   = "analytics-worker-sa"
  display_name = "Analytics Worker — Firestore → BigQuery"
}

resource "google_project_iam_member" "analytics_firestore_reader" {
  project = var.project_id
  role    = "roles/datastore.viewer"
  member  = "serviceAccount:${google_service_account.analytics_worker.email}"
}

resource "google_project_iam_member" "analytics_bq_writer" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.analytics_worker.email}"
}

resource "google_project_iam_member" "analytics_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.analytics_worker.email}"
}

resource "google_project_iam_member" "analytics_eventarc_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.analytics_worker.email}"
}

# ── 5. Cloud Function Gen2 ────────────────────────────────────────────────────

resource "google_cloudfunctions2_function" "analytics_worker" {
  name        = "qhoot-analytics-worker"
  location    = var.region
  description = "Firestore-triggered: aggregates room stats and streams to BigQuery"

  build_config {
    runtime     = "python312"
    entry_point = "process_room_completion"

    source {
      storage_source {
        bucket = google_storage_bucket.analytics_fn_source.name
        object = google_storage_bucket_object.analytics_fn_zip.name
      }
    }
  }

  service_config {
    max_instance_count    = 10
    min_instance_count    = 0
    available_memory      = "256M"
    timeout_seconds       = 120
    service_account_email = google_service_account.analytics_worker.email

    environment_variables = {
      GCP_PROJECT_ID    = var.project_id
      FIRESTORE_DB_NAME = "qhoot-database"
      BQ_DATASET        = google_bigquery_dataset.quiz_analytics.dataset_id
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.firestore.document.v1.updated"
    service_account_email = google_service_account.analytics_worker.email

    event_filters {
      attribute = "database"
      value     = "qhoot-database"
    }
    event_filters {
      attribute = "namespace"
      value     = "(default)"
    }
    # Słucha na rooms/{roomId}, nie quizzes/{quizId}
    # bo vote_worker zmienia status w rooms
    event_filters {
      attribute = "document"
      value     = "rooms/{roomId}"
      operator  = "match-path-pattern"
    }

    retry_policy = "RETRY_POLICY_DO_NOT_RETRY"
  }

  depends_on = [
    google_project_service.analytics_apis,
    google_storage_bucket_object.analytics_fn_zip,
  ]
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "analytics_bq_dataset" {
  value       = google_bigquery_dataset.quiz_analytics.dataset_id
  description = "Połącz Looker Studio z tym datasetem: https://lookerstudio.google.com"
}

output "analytics_function_name" {
  value       = google_cloudfunctions2_function.analytics_worker.name
}
