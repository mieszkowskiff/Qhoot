from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import pubsub_v1
import json
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://qhoot-player.web.app", "https://qhoot-player.firebaseapp.com"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

PROJECT_ID = os.environ.get("PROJECT_ID", "your-project-id")
TOPIC_ID = os.environ.get("TOPIC_ID", "qhoot-incoming-votes")

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)

class Vote(BaseModel):
    roomId: str
    playerId: str
    questionIndex: int
    answerIndex: int

@app.post("/api/v1/vote")
async def submit_vote(vote: Vote):
    try:
        message_bytes = json.dumps(vote.model_dump()).encode("utf-8")
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

@app.get("/health")
async def health():
    return {"status": "ok"}