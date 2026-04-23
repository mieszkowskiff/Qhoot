# Real-time Quiz Application (Kahoot Clone)

This repository contains the source code and infrastructure definitions for a massively scalable, real-time quiz application built on Google Cloud Platform (GCP).

## Architecture Overview

The system is designed with a Serverless and Event-Driven approach to handle sudden spikes in traffic (e.g., 1000+ players answering simultaneously). The core components include:

* **Frontend:** Single Page Application handling the UI for the Host and Players (Direct connection to Firestore for real-time state sync).
* **API Gateway (Cloud Run):** Python-based service acting as a secure entry point for high-volume voting.
* **Message Broker (Pub/Sub):** Ingestion queue absorbing sudden spikes in traffic.
* **Background Worker (Cloud Functions):** Asynchronous processor calculating scores and validating answers.
* **Database (Firestore):** NoSQL database acting as the single source of truth and real-time state broadcaster.

## Repository Structure

* `/IaC` - Terraform configuration files for deploying the GCP infrastructure.
* `/frontend` - (Planned) Client-side application code.
* `/backend` - (Planned) Python source code for Cloud Run and Cloud Functions.

## Development Guidelines

1.  **Language:** All code, variable names, and inline comments must be written in English.
2.  **Infrastructure Changes:** Any changes to the cloud architecture must be reflected in the `/IaC` Terraform files. Manual changes via the GCP Console are strictly prohibited.
3.  **Secrets:** Never commit sensitive data, service account keys, or `.tfstate` files to this repository.