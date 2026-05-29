gcloud builds submit --tag europe-central2-docker.pkg.dev/ahds-adhs-ajds-sjhd-djsh/cloudvote-repo/api-gateway:latest

gcloud run deploy qhoot-api-gateway \
  --image europe-central2-docker.pkg.dev/ahds-adhs-ajds-sjhd-djsh/cloudvote-repo/api-gateway:latest \
  --region europe-central2