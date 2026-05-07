# CloudVote API Gateway (Cloud Run)

## Overview
The **CloudVote API Gateway** is a high-performance, asynchronous REST API designed to handle massive spikes in live voting traffic. It serves as the entry point for the "Write Path" in the CloudVote system, ensuring that high-throughput ingestion does not overwhelm the backend database.

This component is deployed on **Google Cloud Run** to leverage automatic scaling and a serverless execution environment.

## Key Architecture Principles
* **Decoupling**: Separates the fast frontend ingestion from the slower database write operations.
* **Thundering Herd Protection**: Absorbs sudden bursts of hundreds or thousands of concurrent votes by offloading them to an asynchronous queue (Pub/Sub).
* **Fast Response**: Immediately returns an `HTTP 202 Accepted` status to the client once the message is published to Pub/Sub, ensuring minimal latency for the user (SLA < 1s).

## Tech Stack
* **Language**: Python 3.12
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (High performance, easy to use, based on standard Python type hints)
* **Validation**: [Pydantic](https://docs.pydantic.dev/) (Data validation and settings management)
* **Messaging**: `google-cloud-pubsub` (Official Google Cloud client library for Pub/Sub integration)
* **Server**: `uvicorn` (ASGI server for production and development)

## API Design
### Endpoint: `POST /api/v1/vote`
The gateway expects a JSON payload representing a vote and validates it using a Pydantic model.

**Request Body Schema:**
```json
{
  "player": "string",
  "answer": "string"
}
```

**Success Response:**
* **Status**: `202 Accepted`
* **Content**: `{"message": "Vote accepted and queued for processing."}`

## Local Development Setup

### 1. Prerequisites
* Python 3.12 installed.
* [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install) installed and initialized.

### 2. Environment Configuration
Create a virtual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install python-dotenv  # For local environment variable management
```

### 3. Local Variables
Create a `.env` file in the root directory:
```env
PROJECT_ID=your-gcp-project-id
TOPIC_ID=qhoot-incoming-votes
```

### 4. Authentication
To allow your local code to interact with GCP services (like Pub/Sub), run:
```bash
gcloud auth application-default login
```

### 5. Running the Server
```bash
uvicorn main:app --reload
```
Access the interactive API documentation (Swagger UI) at: `http://localhost:8000/docs`

## Deployment to Google Cloud


### Build and Push Image
We use **Cloud Build** to containerize the application without needing a local Docker installation:
```bash
gcloud builds submit --tag <REGION>-docker.pkg.dev/<PROJECT_ID>/cloudvote-repo/api-gateway:latest
```

### Cloud Run Deployment
Once the image is in the registry, it can be deployed via Terraform using the `google_cloud_run_v2_service` resource, referencing the image path and injecting environment variables (`PROJECT_ID`, `TOPIC_ID`).