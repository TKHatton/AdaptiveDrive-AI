# AdaptiveDrive AI

**A multimodal AI driving coach for adaptive hand-control driving.**

AdaptiveDrive AI is a browser-based training simulator that teaches adaptive hand-control driving through real-time gesture recognition, live AI voice coaching, and interactive driving scenarios. Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/).

**Live App**: [https://adaptivedrive-ai-614150524504.us-central1.run.app](https://adaptivedrive-ai-614150524504.us-central1.run.app)

**Category**: Live Agents (Real-time Interaction with Audio/Vision)

---

## For Judges: Quick Testing Guide

**Try the live app (fastest):** [https://adaptivedrive-ai-614150524504.us-central1.run.app](https://adaptivedrive-ai-614150524504.us-central1.run.app)

**Requirements:**
- Google Chrome (required for MediaPipe and Web Audio API)
- A webcam
- A microphone (for talking to the AI coach)
- **Good, even lighting** (this is critical for hand tracking accuracy)

**Steps to test:**
1. Open the link above in Chrome
2. Click **Start Training Session**
3. Allow camera and microphone access when prompted
4. Hold one hand up in front of your webcam, centered in the frame
5. Wait about 1 second for calibration (you will see "Live Tracking" appear)
6. **Raise your hand higher** to accelerate
7. **Lower your hand** to brake
8. **Move your hand left or right** to steer
9. The AI coach will begin speaking. You can talk back hands-free.
10. Follow the practice checklist, then try the traffic light scenario

**Lighting tip:** If tracking seems unresponsive or jumpy, try improving your lighting. A well-lit face and hand against a non-cluttered background gives the best results. Avoid backlighting (window behind you).

---

## Why This Exists

6.8 million Americans have a disability that makes it difficult or impossible to use foot pedals to drive. For many, the inability to drive leads to isolation. There are fewer than 200 certified adaptive driving rehabilitation specialists in the entire US, with months-long wait times. There is currently no accessible way to practice adaptive hand controls before committing to in-person training.

AdaptiveDrive AI provides a safe, interactive environment where users can build familiarity and confidence with hand controls before they ever touch a real vehicle.

## How It Works

1. **Hand Tracking (Vision)**: Your webcam tracks hand movements using MediaPipe. Raise your hand to accelerate, lower it to brake, move left/right to steer. This simulates a real adaptive push-pull driving lever.

2. **Interactive Driving Environment**: A Three.js scene renders a road with your car, oncoming traffic, trees, buildings, and a traffic light system. Everything runs at 60fps based on your hand input.

3. **Live AI Voice Coach (Gemini Live API)**: Gemini connects as a real-time driving instructor using bidirectional audio streaming. It receives your hand tracking data (speed, steering, distance to obstacles) every 2 seconds and coaches you through training exercises and scenarios. You can talk back through your microphone, hands-free.

4. **Progressive Training**: Start with basic controls, move through interactive speed challenges (reach specific targets), then face real driving scenarios like approaching a traffic light that cycles green to yellow to red.

## Technology Stack

| Layer | Technology | Google Cloud |
|-------|-----------|-------------|
| AI Coaching | Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`) | Google GenAI SDK |
| Hand Tracking | MediaPipe Hands (WASM, single hand, Y/X-axis mapping) | - |
| Driving Scene | Three.js (procedural, 60fps animation loop) | - |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion | - |
| Backend | Express (serves SPA in production) | Cloud Run |
| Deployment | Docker, Cloud Build, Artifact Registry, Cloud Run | Google Cloud |
| Audio | Web Audio API (gapless PCM playback, 24kHz out / 16kHz in) | - |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20 recommended)
- A [Google Gemini API Key](https://aistudio.google.com/apikey) with access to the Live API
- A webcam (for hand tracking)
- A microphone (for voice conversation with the AI coach)
- Google Chrome browser

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/TKHatton/AdaptiveDrive-AI.git
cd AdaptiveDrive-AI

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 4. Start the dev server
npm run dev

# 5. Open http://localhost:3000 in Chrome
#    (Chrome required for MediaPipe and Web Audio API)
```

### Production Build (Local)

```bash
npm run build
npm start
# Serves at http://localhost:3000
```

### Reproducible Testing Instructions

To verify the project works from a fresh clone:

```bash
# 1. Clone and install
git clone https://github.com/TKHatton/AdaptiveDrive-AI.git
cd AdaptiveDrive-AI
npm install

# 2. Create .env with your Gemini API key
echo GEMINI_API_KEY="your-gemini-api-key-here" > .env

# 3. Build and run production
npm run build
npm start

# 4. Open http://localhost:3000 in Chrome
# 5. Allow camera + microphone access
# 6. Click "Start Training Session"
# 7. Hold your hand up in front of the webcam
# 8. Follow the AI coach instructions
```

**System requirements:** Chrome browser, webcam, microphone, good lighting.

### Using the Simulator

1. Click **Start Training Session**
2. Allow camera and microphone access when prompted
3. Hold one hand up in front of your webcam
4. Wait for the 20-frame calibration (about 1 second)
5. **Raise your hand up** from neutral to accelerate
6. **Lower your hand down** from neutral to brake
7. **Move your hand left/right** to steer
8. The AI coach will speak to you. Speak back anytime (hands-free)
9. Complete the practice checklist, then try the traffic light scenario

## Google Cloud Deployment (Cloud Run)

**Live deployment:** [https://adaptivedrive-ai-614150524504.us-central1.run.app](https://adaptivedrive-ai-614150524504.us-central1.run.app)

### Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A GCP project with billing enabled

### Automated Deployment

The `deploy.sh` script automates the entire deployment pipeline:

```bash
# Set your API key
export GEMINI_API_KEY=your-key-here

# Deploy (replace YOUR_PROJECT_ID with your GCP project)
chmod +x deploy.sh
./deploy.sh YOUR_PROJECT_ID us-central1
```

This script will:
1. Set the GCP project
2. Enable Cloud Run, Cloud Build, and Artifact Registry APIs
3. Build the Docker image using Cloud Build (injects API key at build time)
4. Deploy to Cloud Run with public access
5. Print the live URL

### Manual Deployment (using cloudbuild.yaml)

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Create Artifact Registry repo (one-time)
gcloud artifacts repositories create adaptivedrive --repository-format=docker --location=us-central1

# Build with API key
gcloud builds submit --config=cloudbuild.yaml --substitutions=_GEMINI_API_KEY="your-key-here"

# Deploy
gcloud run deploy adaptivedrive-ai \
  --image "us-central1-docker.pkg.dev/YOUR_PROJECT_ID/adaptivedrive/adaptivedrive-ai" \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --min-instances 1 \
  --max-instances 3 \
  --set-env-vars "NODE_ENV=production"
```

### Verify Deployment

```bash
# Check service status
gcloud run services describe adaptivedrive-ai --region us-central1

# View logs
gcloud run services logs read adaptivedrive-ai --region us-central1 --limit 50

# Health check
curl https://YOUR-SERVICE-URL/api/health
```

### Proof of Google Cloud Deployment

- **Cloud Run Service:** `adaptivedrive-ai` in `us-central1`
- **Dockerfile:** [`Dockerfile`](Dockerfile) - Multi-stage Docker build for Cloud Run
- **Cloud Build Config:** [`cloudbuild.yaml`](cloudbuild.yaml) - Automated build pipeline
- **Deployment Script:** [`deploy.sh`](deploy.sh) - Infrastructure-as-code automated deployment
- **Server:** [`server.ts`](server.ts) - Express server configured for Cloud Run (PORT env var, health endpoint)

## Architecture

```
+------------------------------------------------------------------+
|                        User's Browser (Chrome)                    |
|                                                                   |
|  +-----------+     +------------------+     +----------------+    |
|  |  Webcam   |---->| MediaPipe Hands  |---->|  Hand State    |    |
|  |           |     | (WASM, 20-frame  |     |  - throttle %  |    |
|  +-----------+     |  calibration,    |     |  - brake %     |    |
|                    |  EMA smoothing)  |     |  - steering    |    |
|  +-----------+     +------------------+     |  - speed (mph) |    |
|  | Microphone|--+                           +-------+--------+    |
|  |  (16kHz)  |  |                                   |             |
|  +-----------+  |                                   |             |
|                 |   System data every 2s            |             |
|                 |   (speed, steering, distance,     |             |
|                 |    training phase, targets)        |             |
|                 |                                   |             |
|                 v                                   v             |
|       +--------------------------------------------+             |
|       |        Gemini Live API (WebSocket)          |             |
|       |  Model: gemini-2.5-flash-native-audio-      |             |
|       |         preview-12-2025                      |             |
|       |  Mode: Audio-only (bidirectional)           |             |
|       +----------+-----------+---------------------+             |
|                  |           |                                    |
|            Voice Out    Audio In                                  |
|            (24kHz PCM,  (16kHz PCM,                              |
|             gapless      mic stream)                              |
|             scheduling)                                          |
|                  |                                                |
|                  v                                                |
|    +-------------------+         +------------------------+      |
|    | AI Coach Panel    |         | Three.js Driving Scene |      |
|    | - Voice playback  |         | - Car + road (60fps)   |      |
|    | - Mic toggle      |         | - Oncoming traffic     |      |
|    | - Connection      |         | - Traffic light system  |      |
|    |   status          |         |   (green/yellow/red)   |      |
|    +-------------------+         | - Trees, buildings     |      |
|                                  +------------------------+      |
|    +-------------------+         +------------------------+      |
|    | Practice System   |         | Dashboard              |      |
|    | - Checklist       |         | - Speed, throttle,     |      |
|    | - Speed targets   |         |   brake, steering      |      |
|    |   (40/10/60 mph)  |         | - Mode + phase         |      |
|    | - Scenario flow   |         | - Distance to light    |      |
|    +-------------------+         +------------------------+      |
+------------------------------------------------------------------+
                            |
                     HTTPS (port 8080)
                            |
+------------------------------------------------------------------+
|                    Google Cloud Run                                |
|   +------------------------------------------------------------+ |
|   | Docker Container (Node.js 20 + Express)                    | |
|   | - Serves built React SPA from /dist                        | |
|   | - /api/health endpoint                                     | |
|   | - GEMINI_API_KEY baked in at build time via Cloud Build     | |
|   +------------------------------------------------------------+ |
|                                                                   |
|   Google Cloud Services:                                          |
|   - Cloud Run (hosting, auto-scaling, min 1 instance)            |
|   - Cloud Build (CI/CD, Docker image builds)                     |
|   - Artifact Registry (container image storage)                  |
+------------------------------------------------------------------+
```

**Key design decisions:**
- **Y-axis hand tracking** (up/down) instead of Z-depth (toward/away) for reliable, intuitive control
- **Single-hand operation** for accessibility (many adaptive drivers use one hand)
- **20-frame calibration** on hand detection to establish a stable neutral position
- **Exponential moving average smoothing** on all hand values to reduce jitter
- **Mirrored camera compensation** for accurate left/right hand identification
- **60fps animation loop** with proper cancellation for clean React lifecycle
- **Gemini receives structured system data** with speed, steering, distance, training phase, and targets every 2 seconds
- **Bidirectional voice**: 24kHz PCM playback (Gemini output) + 16kHz PCM streaming (user microphone input)
- **Gapless audio scheduling** using Web Audio API timeline (`source.start(nextPlayTime)`)
- **Proactive coaching**: The AI coach leads the lesson, does not wait for questions

## Project Structure

```
AdaptiveDrive-AI/
  src/
    App.tsx                    # Main app: UI layout, practice system, scenario engine
    main.tsx                   # React entry point
    components/
      DrivingScene.tsx         # Three.js driving scene (car, road, traffic, traffic lights)
    hooks/
      useHandTracking.ts       # MediaPipe hand tracking (Y-axis, calibration, smoothing)
      useGeminiLive.ts         # Gemini Live API (WebSocket, bidirectional audio)
    shared/
      types.ts                 # HandState interface, Scenario definitions
    index.css                  # Tailwind v4 theme
  server.ts                    # Express server (Cloud Run production)
  Dockerfile                   # Multi-stage Docker build for Cloud Run
  cloudbuild.yaml              # Cloud Build config with API key substitution
  deploy.sh                    # Automated GCP deployment script (bonus: IaC)
  .env.example                 # Environment variable template
```

## Accessibility

This project is designed for accessibility:
- **Single-hand operation** matches real adaptive driving controls
- **Voice interaction** so users never need to drop their hands to type
- **High-contrast UI** with clear visual feedback at every level
- **Text transcripts** of all AI coaching (not audio-only)
- **Large, clearly labeled controls** and status indicators
- **No reliance on color alone** for any status information
- **Camera mirror compensation** for natural left/right orientation

## License

Apache-2.0
