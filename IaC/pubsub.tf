resource "google_pubsub_topic" "incoming_votes" {
  name = "qhoot-incoming-votes"

  labels = {
    environment = "dev"
    component   = "ingestion"
  }
}

resource "google_pubsub_subscription" "incoming_votes_sub" {
  name  = "qhoot-incoming-votes-sub"
  topic = google_pubsub_topic.incoming_votes.name

  ack_deadline_seconds = 60

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }

  labels = {
    environment = "dev"
    component   = "ingestion"
  }
}