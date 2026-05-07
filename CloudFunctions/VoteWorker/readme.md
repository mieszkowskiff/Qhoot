# CloudVote Worker (Cloud Functions Gen2)

## Overview
The **CloudVote Worker** is an asynchronous, event-driven background processor. It serves as the tail-end of the "Write Path" in the CloudVote architecture. Its primary job is to consume vote messages from the Pub/Sub topic, parse them, and durably write the results to the Firestore database.

It is deployed as a **Google Cloud Function Gen2**, which means it is natively powered by Cloud Run and triggered via Eventarc, offering excellent scalability and longer timeout limits compared to first-generation functions.

## Key Architecture Principles
* **Event-Driven**: Completely decoupled from the API Gateway. It only runs when a new message is published to the queue.
* **Idempotency Ready**: Designed to handle potential duplicate messages from Pub/Sub gracefully.
* **Global Database Connection**: The Firestore client is initialized in the global scope to prevent costly reconnects during traffic spikes (Cold Start optimization).

## Tech Stack
* **Language**: Python 3.12
* **Framework**: `functions-framework` (Google's open-source library for writing portable Python functions)
* **Database**: `google-cloud-firestore`
* **Trigger Mechanism**: Pub/Sub via Eventarc

## Local Development Setup

Because Cloud Functions run in highly isolated environments, it is strongly recommended to use a dedicated Python virtual environment for this component, separate from the API Gateway.

### 1. Environment Configuration
Create a virtual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install python-dotenv  # For local environment variable management
```

### 2. Local Variables
Create a `.env` file in the root directory of the function:
```env
PROJECT_ID=your-gcp-project-id
```

### 3. Authentication
Ensure your local environment is authenticated to write to your live Firestore database:
```bash
gcloud auth application-default login
```

### 4. Running the Local Simulator
Use the Functions Framework to start a local server that mimics the Google Cloud environment:
```bash
functions-framework --target=process_vote --signature-type=cloudevent --port=8080
```

### 5. Testing with Postman (CloudEvents Format)
When testing locally, you must simulate the exact request format that Eventarc/Pub/Sub uses.
* **Method**: `POST`
* **URL**: `http://localhost:8080`
* **Headers** (Required by CloudEvents):
  * `ce-id`: `12345`
  * `ce-specversion`: `1.0`
  * `ce-type`: `google.cloud.pubsub.topic.v1.messagePublished`
  * `ce-source`: `local-test`
* **Body** (raw JSON): The payload must be Base64 encoded.
```json
{
  "message": {
    "data": "eyJwbGF5ZXIiOiAiS2FjcGVyIiwgImFuc3dlciI6ICJCIn0="
  }
}
```
*(Note: The `data` string above is the Base64 representation of `{"player": "Kacper", "answer": "B"}`)*

## Deployment to Google Cloud

### Prerequisites
For Gen2 functions triggered by Pub/Sub, the **Eventarc API** must be enabled in your GCP project. This can be done via Terraform or CLI:
```bash
gcloud services enable eventarc.googleapis.com
```

### Infrastructure as Code (Terraform)
The function is deployed using Terraform. The process involves:
1. Creating a Google Cloud Storage Bucket.
2. Zipping the source code directory.
3. Uploading the Zip file to the bucket.
4. Provisioning the `google_cloudfunctions2_function` resource and linking it to the Pub/Sub topic via Eventarc.

To deploy, navigate to your `/IaC` directory and run:
```bash
terraform apply
```