# Infrastructure as Code (Terraform)

This directory contains the Terraform configuration required to provision the Google Cloud Platform (GCP) resources for the Quiz Application.

## Prerequisites

Before running the code, ensure you have the following:

1.  A Google Cloud Project with an active **Billing Account** linked.
2.  [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) installed locally.
3.  [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated.

To authenticate your local environment with GCP, run:
```bash
gcloud auth application-default login