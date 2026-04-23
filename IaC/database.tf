
resource "google_firestore_database" "database" {
  project     = "${var.project_id}"
  name        = "qhoot-database"
  location_id = "${var.region}"
  type        = "FIRESTORE_NATIVE"
  
  delete_protection_state = "DELETE_PROTECTION_DISABLED"
}