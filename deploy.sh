#!/bin/bash
# AdaptiveDrive AI - Automated Google Cloud Run Deployment
# This script automates the full deployment pipeline for the hackathon.
#
# Prerequisites:
#   1. Google Cloud SDK (gcloud) installed and authenticated
#   2. A GCP project with billing enabled
#   3. GEMINI_API_KEY set in your environment or .env file
#
# Usage:
#   chmod +x deploy.sh
#   export GEMINI_API_KEY=your-key-here
#   ./deploy.sh [PROJECT_ID] [REGION]

set -euo pipefail

# Configuration
PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${2:-us-central1}"
SERVICE_NAME="adaptivedrive-ai"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AdaptiveDrive AI - Cloud Run Deploy   ${NC}"
echo -e "${GREEN}========================================${NC}"

# Validate prerequisites
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: No project ID provided.${NC}"
  echo "Usage: ./deploy.sh PROJECT_ID [REGION]"
  echo "Or set GOOGLE_CLOUD_PROJECT environment variable."
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  # Try loading from .env
  if [ -f .env ]; then
    export $(grep GEMINI_API_KEY .env | xargs)
  fi
  if [ -z "${GEMINI_API_KEY:-}" ]; then
    echo -e "${RED}Error: GEMINI_API_KEY not set.${NC}"
    echo "Set it via: export GEMINI_API_KEY=your-key-here"
    exit 1
  fi
fi

echo -e "${YELLOW}Project:${NC}  $PROJECT_ID"
echo -e "${YELLOW}Region:${NC}   $REGION"
echo -e "${YELLOW}Service:${NC}  $SERVICE_NAME"
echo ""

# Set the project
echo -e "${GREEN}[1/5] Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo -e "${GREEN}[2/5] Enabling required APIs...${NC}"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  --quiet

# Build the container image using Cloud Build
echo -e "${GREEN}[3/5] Building container image with Cloud Build...${NC}"
gcloud builds submit \
  --tag "$IMAGE_NAME" \
  --build-arg "GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --timeout=600s \
  --quiet

# Deploy to Cloud Run
echo -e "${GREEN}[4/5] Deploying to Cloud Run...${NC}"
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "NODE_ENV=production" \
  --quiet

# Get the service URL
echo -e "${GREEN}[5/5] Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --platform managed \
  --region "$REGION" \
  --format 'value(status.url)')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!                  ${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}Live URL:${NC} $SERVICE_URL"
echo -e "${YELLOW}Console:${NC} https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics?project=${PROJECT_ID}"
echo ""
echo "To view logs:"
echo "  gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50"
echo ""
echo "To delete:"
echo "  gcloud run services delete $SERVICE_NAME --region $REGION"
