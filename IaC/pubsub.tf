resource "google_pubsub_topic" "incoming_votes" {
  name = "qhoot-incoming-votes"

  labels = {
    environment = "dev"
    component   = "ingestion"
  }
}