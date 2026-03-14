# AdaptiveDrive AI

**A multimodal AI driving coach for adaptive hand-control driving.**

AdaptiveDrive AI is a training simulator that teaches adaptive hand-control driving techniques through real-time gesture recognition, live AI voice coaching, and interactive 3D driving environments. Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/).

**Category**: Live Agents (Real-time Interaction with Audio/Vision)

## Why This Exists

Over 600,000 people in the U.S. drive with adaptive hand controls. Learning to operate push/pull throttle-brake levers is challenging, and real-world practice can feel high-stakes. AdaptiveDrive AI provides a safe, interactive environment where users can build muscle memory and confidence before they ever touch a real vehicle.

The AI coach sees your hand movements in real time, speaks to you naturally, listens to your questions, and gives personalized feedback throughout every driving exercise.

## How It Works

1. **Hand Tracking (Vision)**: Your webcam tracks hand movements using MediaPipe. Raise your hand to accelerate, lower it to brake, move left/right to steer. The system detects which hand (left or right) you're using, accounting for the mirrored camera view.

2. **3D Driving Environment**: A Three.js scene renders a road with your car in the right lane, oncoming traffic in the left lane, trees, buildings, street lights, stop signs, and intersections. Everything scrolls at 60fps based on your hand input.

3. **Live AI Voice Coach (Gemini Live API)**: Gemini connects as a real-time driving instructor using native audio dialog. It receives your hand tracking data every 2 seconds, coaches you through scenarios ("Raise your hand higher to accelerate..."), and provides performance feedback. You can talk back to the coach through your microphone, hands-free.

4. **AI-Generated Scenery**: In Scenario Mode, Gemini generates photorealistic background images matching each driving scenario for visual immersion.

## Scenarios

| Scenario | What You Practice | Phase Flow |
|----------|------------------|------------|
| Starting the Vehicle | Smooth, gentle acceleration from a stop | Intro (6s) > Prep (8s) > Action (30s) > Feedback |
| Approaching a Stop Sign | Gradual braking with distance-based coaching | Same flow with stop sign + distance HUD |
| Turning at an Intersection | Coordinating speed control with steering | Same flow with crosswalk + turn arrow |

Each scenario moves through 4 coaching phases: the coach introduces the exercise, guides hand positioning, gives real-time micro-feedback during the maneuver, then summarizes with one positive and one improvement.

## Technology Stack

| Layer | Technology | Google Cloud |
|-------|-----------|-------------|
| AI Coaching | Gemini Live API (`gemini-2.5-flash-preview-native-audio-dialog`) | Google GenAI SDK |
| Image Generation | Gemini (`gemini-2.0-flash-preview-image-generation`) | Google GenAI SDK |
| Hand Tracking | MediaPipe Hands (webcam, single hand, Y-axis + X-axis) | - |
| 3D Rendering | Three.js (procedural scene, 60fps animation loop) | - |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Motion | - |
| Backend | Express (serves SPA in production) | Cloud Run |
| Deployment | Docker, Cloud Build, Cloud Run | Google Cloud |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20 recommended)
- A [Google Gemini API Key](https://aistudio.google.com/apikey) with access to the Live API
- A webcam (for hand tracking)
- A microphone (optional, for voice conversation with the AI coach)

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

### Using the Simulator

1. Click **Start Training Session**
2. Allow camera and microphone access when prompted
3. Hold one hand up in front of your webcam
4. Wait for the 20-frame calibration (about 1 second)
5. **Raise your hand up** from neutral to accelerate
6. **Lower your hand down** from neutral to brake
7. **Move your hand left/right** to steer
8. The AI coach will speak to you. Speak back anytime (hands-free)
9. Click **Next Scenario** after feedback to try the next exercise

## Google Cloud Deployment (Cloud Run)

### Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A GCP project with billing enabled
- Docker (or use Cloud Build)

### Automated Deployment (Recommended)

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
2. Enable Cloud Run, Cloud Build, and Container Registry APIs
3. Build the Docker image using Cloud Build (injects API key at build time)
4. Deploy to Cloud Run with public access
5. Print the live URL

### Manual Deployment

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com

# Build and deploy in one step
gcloud run deploy adaptivedrive-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --set-env-vars "NODE_ENV=production" \
  --build-arg "GEMINI_API_KEY=${GEMINI_API_KEY}"
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

## Architecture

```
+-----------------------------------------------------------+
|                    User's Browser                          |
|                                                           |
|  +----------+    +----------------+    +--------------+   |
|  | Webcam   |--->| MediaPipe      |--->| Hand State   |   |
|  | (Camera) |    | Hands (WASM)   |    | (throttle,   |   |
|  +----------+    +----------------+    |  brake,      |   |
|                                        |  steering,   |   |
|  +----------+                          |  handedness) |   |
|  | Micro-   |----+                     +---------+----+   |
|  | phone    |    |                               |        |
|  +----------+    |    +-----------+              |        |
|                  |    | Scenario  |              |        |
|                  |    | Engine    |<----+---------+        |
|                  |    | (phases,  |    |                   |
|                  |    |  timers)  |    |                   |
|                  |    +-----+-----+    |                   |
|                  |          |          |                   |
|                  v          v          v                   |
|          +-------------------------------+                |
|          |      Gemini Live API          |                |
|          |  (WebSocket Connection)       |                |
|          |  Model: gemini-2.5-flash-     |                |
|          |    preview-native-audio-dialog|                |
|          +------+--------+-------+------+                 |
|                 |        |       |                         |
|           Voice Out  Text Out  Audio In                    |
|           (24kHz    (transcript) (16kHz                    |
|            PCM)                   PCM)                     |
|                 |        |                                 |
|                 v        v                                 |
|          +------------------+    +-------------------+    |
|          | AI Coach Panel   |    | Three.js 3D Scene |    |
|          | (transcript,     |    | (car, road, trees,|    |
|          |  voice playback, |    |  traffic, signs,  |    |
|          |  mic toggle)     |    |  60fps animation) |    |
|          +------------------+    +-------------------+    |
|                                                           |
+-----------------------------------------------------------+
                          |
                  HTTPS (Cloud Run)
                          |
+-----------------------------------------------------------+
|                 Google Cloud Run                           |
|  +---------------------------------------------------+   |
|  | Docker Container                                   |   |
|  | - Node.js 20 + Express                            |   |
|  | - Serves built React SPA (dist/)                  |   |
|  | - /api/health endpoint                            |   |
|  | - GEMINI_API_KEY injected at build time            |   |
|  +---------------------------------------------------+   |
+-----------------------------------------------------------+
                          |
              Google Cloud Services Used:
              - Cloud Run (hosting)
              - Cloud Build (CI/CD)
              - Container Registry (images)
```

**Key design decisions:**
- **Y-axis hand tracking** (up/down) instead of Z-depth (toward/away) for reliable, intuitive control
- **Single-hand operation** for accessibility (many adaptive drivers use one hand)
- **20-frame calibration** on hand detection to establish a stable neutral position
- **Exponential moving average smoothing** on all hand values to reduce jitter
- **Mirrored camera compensation** for accurate left/right hand identification
- **60fps animation loop** (requestAnimationFrame) for smooth, continuous motion
- **Gemini receives structured `[SYSTEM DATA]`** payloads with scenario context, throttle, brake, steering, handedness every 2 seconds
- **Bidirectional voice**: 24kHz PCM playback (Gemini output) + 16kHz PCM streaming (user microphone input)
- **Proactive coaching**: The AI coach leads the lesson, does not wait for questions

## Project Structure

```
AdaptiveDrive-AI/
  src/
    App.tsx                    # Main app: UI layout, scenario engine, coaching logic
    components/
      DrivingScene.tsx         # Three.js 3D scene (car, road, traffic, animation loop)
    hooks/
      useHandTracking.ts       # MediaPipe hand tracking (Y-axis, calibration, smoothing)
      useGeminiLive.ts         # Gemini Live API (WebSocket, audio I/O, mic streaming)
    services/
      imageService.ts          # Gemini image generation (scenario backgrounds)
    shared/
      types.ts                 # HandState interface, Scenario definitions
    index.css                  # Tailwind v4 theme
  server.ts                    # Express server (dev + production)
  Dockerfile                   # Cloud Run container
  deploy.sh                    # Automated GCP deployment script
  docs/
    architecture.md            # Detailed architecture documentation
    demo-script.md             # Demo walkthrough script
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
