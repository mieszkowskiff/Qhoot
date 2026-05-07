from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from google.cloud import pubsub_v1
import json
import os

# Próba załadowania zmiennych lokalnych
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI()

# Konfiguracja
PROJECT_ID = os.environ.get("PROJECT_ID", "your-project-id")
TOPIC_ID = os.environ.get("TOPIC_ID", "qhoot-incoming-votes")

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)

# 1. Definiujemy, jakiego JSON-a oczekujemy
class Vote(BaseModel):
    player: str
    answer: str

# 2. Używamy zdefiniowanego modelu zamiast surowego Request
@app.post("/api/v1/vote")
async def submit_vote(vote: Vote):
    """
    Receives a vote payload and publishes it to Pub/Sub.
    """
    try:
        # Pydantic posiada wbudowaną metodę do zamiany modelu na słownik
        vote_data = vote.model_dump()
        
        # Konwersja na bajty dla Pub/Sub
        message_bytes = json.dumps(vote_data).encode("utf-8")
        
        # Publikacja
        publish_future = publisher.publish(topic_path, data=message_bytes)
        publish_future.result() 

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"message": "Vote accepted and queued for processing."}
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": f"Failed to process the vote: {str(e)}"}
        )