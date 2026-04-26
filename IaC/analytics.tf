# analytics.tf
#
# Event-Driven Analytics Pipeline
#
# Flow:
#   Firestore (quiz.status = "finished")
#     → Eventarc trigger (fires on document update in /quizzes/{quizId})
#     → Cloud Function "analytics-worker"
#     → BigQuery Streaming Insert  (data visible in dashboard in ~seconds)
#     → Looker Studio (https://lookerstudio.google.com) connects to BigQuery
#
# No changes required to any other .tf file.
# Before running terraform apply, build the function zip:
#   cd analytics_worker && zip analytics_worker.zip main.py requirements.txt

# ── 1. Enable required APIs ──────────────────────────────────────────────────

resource "google_project_service" "analytics_apis" {
  for_each = toset([
    "bigquery.googleapis.com",
    "eventarc.googleapis.com",
    "storage.googleapis.com",
    # cloudfunctions.googleapis.com and run.googleapis.com already in main.tf
    # safe to re-enable — Terraform deduplicates
  ])
  service            = each.key
  disable_on_destroy = false
}

# ── 2. BigQuery dataset & tables ─────────────────────────────────────────────
#
# Three tables written by the analytics worker on every quiz completion:
#   quiz_sessions    — one row per quiz (aggregate stats)
#   question_stats   — one row per question (difficulty, avg response time)
#   player_results   — one row per player (final score + rank)

resource "google_bigquery_dataset" "quiz_analytics" {
  dataset_id  = "quiz_analytics"
  description = "Real-time quiz statistics written by analytics-worker on quiz completion"
  location    = var.region

  depends_on = [google_project_service.analytics_apis]
}

resource "google_bigquery_table" "quiz_sessions" {
  dataset_id          = google_bigquery_dataset.quiz_analytics.dataset_id
  table_id            = "quiz_sessions"
  deletion_protection = false

  schema = jsonencode([
    { name = "quiz_id",        type = "STRING",    mode = "REQUIRED", description = "Firestore document ID" },
    { name = "title",          type = "STRING",    mode = "NULLABLE" },
    { name = "host_id",        type = "STRING",    mode = "NULLABLE" },
    { name = "player_count",   type = "INTEGER",   mode = "NULLABLE" },
    { name = "question_count", type = "INTEGER",   mode = "NULLABLE" },
    { name = "avg_score",      type = "FLOAT",     mode = "NULLABLE" },
    { name = "max_score",      type = "INTEGER",   mode = "NULLABLE", description = "Winning score" },
    { name = "created_at",     type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "finished_at",    type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "inserted_at",    type = "TIMESTAMP", mode = "REQUIRED", description = "When analytics worker ran" },
  ])
}

resource "google_bigquery_table" "question_stats" {
  dataset_id          = google_bigquery_dataset.quiz_analytics.dataset_id
  table_id            = "question_stats"
  deletion_protection = false

  schema = jsonencode([
    { name = "quiz_id",         type = "STRING",    mode = "REQUIRED" },
    { name = "question_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "question_text",   type = "STRING",    mode = "NULLABLE" },
    { name = "question_order",  type = "INTEGER",   mode = "NULLABLE" },
    { name = "total_answers",   type = "INTEGER",   mode = "NULLABLE" },
    { name = "correct_answers", type = "INTEGER",   mode = "NULLABLE" },
    { name = "correct_rate",    type = "FLOAT",     mode = "NULLABLE", description = "0.0 to 1.0" },
    { name = "avg_response_ms", type = "INTEGER",   mode = "NULLABLE" },
    { name = "inserted_at",     type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

resource "google_bigquery_table" "player_results" {
  dataset_id          = google_bigquery_dataset.quiz_analytics.dataset_id
  table_id            = "player_results"
  deletion_protection = false

  schema = jsonencode([
    { name = "quiz_id",       type = "STRING",    mode = "REQUIRED" },
    { name = "player_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "nickname",      type = "STRING",    mode = "NULLABLE" },
    { name = "total_score",   type = "INTEGER",   mode = "NULLABLE" },
    { name = "rank",          type = "INTEGER",   mode = "NULLABLE", description = "1 = winner" },
    { name = "correct_count", type = "INTEGER",   mode = "NULLABLE" },
    { name = "joined_at",     type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "inserted_at",   type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── 3. GCS bucket for Cloud Function source code ─────────────────────────────

resource "google_storage_bucket" "analytics_fn_source" {
  name                        = "${var.project_id}-analytics-fn-source"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true

  depends_on = [google_project_service.analytics_apis]
}

resource "google_storage_bucket_object" "analytics_fn_zip" {
  name   = "analytics_worker.zip"
  bucket = google_storage_bucket.analytics_fn_source.name
  # Build this zip before terraform apply:
  # cd analytics_worker && zip analytics_worker.zip main.py requirements.txt
  source = "${path.module}/analytics_worker/analytics_worker.zip"
}

# ── 4. Service account for the analytics Cloud Function ──────────────────────

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
#
# Triggered by Eventarc when any document in /quizzes/{quizId} is updated.
# The function checks if quiz.status changed to "finished" and only then
# runs the analytics aggregation — all other updates are ignored cheaply.

resource "google_cloudfunctions2_function" "analytics_worker" {
  name        = "qhoot-analytics-worker"
  location    = var.region
  description = "Firestore-triggered function: aggregates quiz stats and streams to BigQuery"

  build_config {
    runtime     = "python312"
    entry_point = "process_quiz_completion"

    source {
      storage_source {
        bucket = google_storage_bucket.analytics_fn_source.name
        object = google_storage_bucket_object.analytics_fn_zip.name
      }
    }
  }

  service_config {
    max_instance_count    = 10   # up to 10 parallel quizzes finishing simultaneously
    min_instance_count    = 0    # scale to zero when idle
    available_memory      = "256M"
    timeout_seconds       = 120

    service_account_email = google_service_account.analytics_worker.email

    environment_variables = {
      GCP_PROJECT_ID    = var.project_id
      FIRESTORE_DB_NAME = "qhoot-database"
      BQ_DATASET        = google_bigquery_dataset.quiz_analytics.dataset_id
    }
  }

  # Eventarc trigger — fires on every update to /quizzes/{quizId}
  # The function itself filters for status == "finished"
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
    event_filters {
      attribute = "document"
      value     = "quizzes/{quizId}"
      operator  = "match-path-pattern"
    }
  }

  depends_on = [
    google_project_service.analytics_apis,
    google_storage_bucket_object.analytics_fn_zip,
  ]
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "analytics_bq_dataset" {
  value       = google_bigquery_dataset.quiz_analytics.dataset_id
  description = "Connect Looker Studio to this dataset: https://lookerstudio.google.com"
}

output "analytics_function_name" {
  value       = google_cloudfunctions2_function.analytics_worker.name
  description = "Eventarc-triggered analytics Cloud Function"
}
