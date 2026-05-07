import os
import functions_framework
from google.cloud import bigquery

# Attempt to load local environment variables for local testing
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Initialize BigQuery client globally to reuse the connection
project_id = os.environ.get("PROJECT_ID")
bq_client = bigquery.Client(project=project_id)
dataset_id = os.environ.get("BQ_DATASET_ID", "cloudvote_archive")
table_id = os.environ.get("BQ_TABLE_ID", "game_results")

@functions_framework.cloud_event
def archive_finished_game(cloud_event):
    """
    Triggered by a change in a Firestore document.
    Checks if the game status is 'finished' and archives the data to BigQuery.
    """
    try:
        # 1. Parse the Firestore event data
        # Firestore events contain 'value' (new state) and 'oldValue' (previous state)
        data = cloud_event.data
        
        # Extract the new document state
        new_value = data.get("value", {})
        fields = new_value.get("fields", {})
        
        # Look for the 'status' field. Protobuf wraps strings in 'stringValue'
        status = fields.get("status", {}).get("stringValue")
        
        # Extract the game ID from the full document path
        # Path format: projects/.../databases/(default)/documents/games/{gameId}
        document_path = new_value.get("name", "")
        game_id = document_path.split("/")[-1] if document_path else "unknown_game"

        # 2. Check if the game is actually finished
        if status != "finished":
            print(f"Game {game_id} is still in progress (status: {status}). Skipping archival.")
            return

        print(f"Game {game_id} finished. Starting archival to BigQuery...")

        # 3. Prepare data for BigQuery
        # In a real app, you would extract more fields here (e.g., scores, winner)
        row_to_insert = [
            {
                "game_id": game_id,
                "status": status
            }
        ]

        # 4. Insert into BigQuery
        table_ref = f"{project_id}.{dataset_id}.{table_id}"
        errors = bq_client.insert_rows_json(table_ref, row_to_insert)

        if not errors:
            print(f"Successfully archived game {game_id} to BigQuery.")
        else:
            print(f"Errors encountered while inserting to BigQuery: {errors}")

    except Exception as e:
        print(f"Error during archival process: {str(e)}")
        # Raise the exception so Eventarc knows it failed and can retry
        raise e