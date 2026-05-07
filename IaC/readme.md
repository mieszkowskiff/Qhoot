# Infrastructure as Code (Terraform)

This directory contains the Terraform configuration required to provision the Google Cloud Platform (GCP) resources for the Quiz Application.

## Prerequisites

Before running the code, ensure you have the following:

1. A Google Cloud Project with an active **Billing Account** linked.
2. [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) installed locally.
3. [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated.

To authenticate your local environment with GCP, run:
```bash
gcloud auth application-default login
```

## Files Overview

* `variables.tf` - Declares the required inputs (e.g., project ID, region).
* `database.tf` - Configures the native Firestore database.
* `pubsub.tf` - Configures the message topics for event ingestion.
* `main.tf` - Configures the Google provider and enables required GCP APIs.
* `.terraform.lock.hcl` - Dependency lock file. **Must be committed to version control.**

## Deployment Guide

Follow these steps to deploy the infrastructure to your GCP project:

**Step 1: Initialize Terraform**
Before running terraform apply, build the function zip:
cd analytics_worker && zip analytics_worker.zip main.py requirements.txt


Downloads the required provider plugins (Google Cloud).
```bash
terraform init
```

**Step 2: Provide your Variables**
Create a file named `terraform.tfvars` in this directory (this file is ignored by Git). Add your specific project details:
```hcl
project_id = "your-gcp-project-id"
region     = "europe-central2"
```

**Step 3: Preview Changes**
Review the execution plan to see exactly what Terraform will create.
```bash
terraform plan
```

**Step 4: Apply Configuration**
Deploy the resources to Google Cloud. You will be prompted to type `yes` to confirm.
```bash
terraform apply
```

## Tear Down (Cleanup)

To prevent unwanted charges, you can destroy all resources managed by Terraform in this project by running:
```bash
terraform destroy
```