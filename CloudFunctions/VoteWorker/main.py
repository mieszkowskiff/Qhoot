import base64
import json
import os
import functions_framework
from google.cloud import firestore


# Attempt to load local environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Initialize Firestore client globally.
# This prevents creating a new connection for every single vote,
# significantly improving performance under spike loads.
project_id = os.environ.get("PROJECT_ID", "your-project-id")
db = firestore.Client(project=project_id)

# Triggered by a message on the Pub/Sub topic.
# The entry point name "process_vote" matches the one defined in Terraform.
@functions_framework.cloud_event
def process_vote(cloud_event):
    """
    Validates the incoming vote from Pub/Sub and securely updates Firestore.
    """
    try:
        # 1. Decode the Pub/Sub message
        # The payload inside cloud_event.data is always base64 encoded by Google Cloud
        encoded_data = cloud_event.data["message"]["data"]
        pubsub_message = base64.b64decode(encoded_data).decode("utf-8")
        
        # Parse the JSON string back into a Python dictionary
        vote_data = json.loads(pubsub_message)
        
        player_name = vote_data.get("player")
        answer = vote_data.get("answer")
        
        print(f"Processing vote from {player_name} with answer: {answer}")

        # 2. Save to Firestore database
        # Using a dummy collection "live_scores" for demonstration
        doc_ref = db.collection("live_scores").document(player_name)
        doc_ref.set({
            "latest_answer": answer,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        
        print(f"Vote from {player_name} successfully saved to Firestore.")

    except Exception as e:
        print(f"Error processing vote: {str(e)}")
        # Raising the exception tells Pub/Sub that the execution failed,
        # which triggers the retry mechanism defined in our architecture.
        raise e