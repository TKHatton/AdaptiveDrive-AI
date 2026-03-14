# System Architecture: AdaptiveDrive AI

AdaptiveDrive AI is a multimodal driving simulator built on real-time computer vision, live AI voice coaching, and interactive 3D rendering. It falls under the **Live Agents** category, using the Gemini Live API for bidirectional audio coaching while MediaPipe tracks the user's hand gestures for driving control.

## Architecture Diagram

```text
+================================================================+
|                      USER'S BROWSER (Chrome)                    |
|                                                                 |
|  +-----------+     +------------------+     +---------------+   |
|  |  Webcam   |---->|  MediaPipe Hands  |---->| useHandTracking|  |
|  | (Camera)  |     |  (WASM, 30fps)   |     | Hook          |  |
|  +-----------+     +------------------+     | - Y-axis track |  |
|                                             | - 20-frame cal |  |
|  +-----------+                              | - Smoothing    |  |
|  | Microphone|---+                          | - L/R hand     |  |
|  | (16kHz)   |   |                          +-------+--------+  |
|  +-----------+   |                                  |            |
|                  |                                  v            |
|                  |    +----------+          +---------------+    |
|                  |    | Scenario |          | HandState     |    |
|                  |    | Engine   |          | {throttle,    |    |
|                  |    | (App.tsx)|<---------+  brake,       |    |
|                  |    | 4 phases |          |  steering,    |    |
|                  |    +----+-----+          |  handedness}  |    |
|                  |         |                +-------+-------+    |
|                  |         | System msgs            |            |
|                  |         | + hand data             |            |
|                  v         v (every 2s)              v            |
|          +------------------------------------------+            |
|          |         useGeminiLive Hook                |            |
|          |  +----- WebSocket Connection ------+     |            |
|          |  |  Gemini Live API                |     |            |
|          |  |  gemini-2.5-flash-preview-      |     |            |
|          |  |    native-audio-dialog           |     |            |
|          |  +---------------------------------+     |            |
|          |         |            |          |        |            |
|          |    Voice Out    Text Out    Audio In      |            |
|          |    (24kHz PCM)  (transcript) (16kHz PCM)  |            |
|          +------+----------+----------+---------+---+            |
|                 |          |                                     |
|                 v          v                                     |
|  +------------------+   +-----------------------------------+   |
|  | AI Coach Panel   |   |        DrivingScene (Three.js)    |   |
|  | - Voice playback |   | - 60fps requestAnimationFrame     |   |
|  | - Text transcript|   | - Car in right lane (x=3)         |   |
|  | - Mic toggle     |   | - Oncoming traffic (6 cars)       |   |
|  | - Type or speak  |   | - Trees, buildings, street lights |   |
|  +------------------+   | - Stop signs, crosswalks          |   |
|                         | - Shadow mapping + fog             |   |
|  +------------------+   +-----------------------------------+   |
|  | Gemini Image Gen |                                           |
|  | gemini-2.0-flash |   (Scenario background generation)       |
|  +------------------+                                           |
+================================================================+
                          |
                    HTTPS / Port 8080
                          |
+================================================================+
|                   GOOGLE CLOUD RUN                              |
|  +----------------------------------------------------------+  |
|  | Docker Container (node:20-slim)                           |  |
|  |                                                           |  |
|  |  Express Server (server.ts)                               |  |
|  |  - Serves built React SPA from dist/                      |  |
|  |  - GET /api/health                                        |  |
|  |  - PORT from Cloud Run env (8080)                         |  |
|  |  - GEMINI_API_KEY injected at build time via Docker ARG   |  |
|  +----------------------------------------------------------+  |
|                                                                 |
|  Google Cloud Services Used:                                    |
|  - Cloud Run (serverless container hosting)                     |
|  - Cloud Build (Docker image build pipeline)                    |
|  - Container Registry / Artifact Registry (image storage)       |
+================================================================+
                          |
                    Gemini API
                          |
+================================================================+
|               GOOGLE AI (Gemini Models)                         |
|                                                                 |
|  - gemini-2.5-flash-preview-native-audio-dialog                |
|    (Live API: bidirectional audio + text, real-time coaching)   |
|                                                                 |
|  - gemini-2.0-flash-preview-image-generation                   |
|    (Scenario background generation with caching)                |
+================================================================+
```

## Component Breakdown

### 1. Hand Tracking (MediaPipe Hands via useHandTracking hook)

Uses a single hand for accessibility. Tracks Y-axis (hand height) for throttle/brake and X-axis (hand position) for steering. Detects left vs. right hand with mirror compensation.

- **Y-axis tracking**: Hand UP from calibrated neutral = accelerate, hand DOWN = brake
- **20-frame calibration**: Averages first 20 detected frames to establish neutral hand height
- **Smoothing**: Exponential moving average (lerp factor 0.25) on all values reduces jitter
- **Debounce**: 5 consecutive missing frames before marking hand as "lost"
- **Deadzone**: 0.04 around neutral prevents accidental drift
- **Mirror correction**: MediaPipe reports handedness from camera's POV; hook flips it so "your right hand" means the user's physical right hand
- **Steering**: Wrist X position, inverted for mirrored video, multiplied by 3.0 for sensitivity

### 2. 3D Driving Scene (Three.js via DrivingScene component)

Fully procedural scene with no external 3D models. All movement runs in a `requestAnimationFrame` loop at 60fps, reading props from refs for frame-perfect updates.

- **Road**: 12-unit wide, 500-unit long with double yellow center, white dashed lanes, solid edges, sidewalks, curbs
- **Car**: Multi-part sedan with chassis, cabin, windshields, wheels with rims/hubcaps, headlights, taillights, mirrors, bumpers. Positioned in right lane (x=3)
- **Oncoming traffic**: 6 cars in left lane (x=-3), varied colors, rotated 180 degrees, moving toward camera at 1.8x road speed
- **Scenery**: 3 tree variants (deciduous, pine, oak), buildings with windowed facades, street lights. All scroll and wrap.
- **Speed control**: Smooth ramp-up (factor 0.15) and fast brake response (factor 0.25) with 2.5x movement multiplier
- **Rendering**: PCFSoft shadow mapping, exponential fog, hemisphere lighting, ACES filmic tone mapping

### 3. Gemini Live Integration (useGeminiLive hook)

Bidirectional real-time connection using Google GenAI SDK's Live API.

**Text input pipeline** (every 2 seconds):
```
[SYSTEM DATA] Scenario: Approaching a Stop Sign, Step: action,
Throttle: 45, Brake: 0, Steering: -0.12, Hand: Right,
HandVisible: YES, Gesture: Heavy acceleration
```

**Audio input pipeline** (continuous):
- Microphone captured at 16kHz mono with echo cancellation + noise suppression
- Float32 PCM converted to Int16, base64 encoded
- Sent via `sendRealtimeInput({ media: { data, mimeType: 'audio/pcm;rate=16000' } })`

**Output pipeline**:
- Audio: Raw 16-bit PCM at 24kHz mono, decoded from base64, queued for sequential Web Audio API playback
- Text: Displayed in AI Coach transcript panel

**System prompt**: Proactive driving instructor persona that leads lessons, coaches based on real-time hand data, warns about heavy braking or acceleration, prompts idle users, and identifies correct physical hand.

### 4. Scenario Engine (App.tsx)

Phase state machine for structured coaching:
- **Intro** (6s): Coach introduces scenario, image generation starts
- **Prep** (8s): Coach guides hand positioning, calibration happens
- **Action** (30s): Real-time driving with micro-feedback coaching
- **Feedback**: Performance summary (one positive, one improvement)

Distance-based coaching cues in stop sign scenario trigger at 40m, 20m, and 5m.

### 5. Image Generation (imageService.ts)

Uses `gemini-2.0-flash-preview-image-generation` with `responseModalities: ["IMAGE", "TEXT"]`. Results are cached in a Map keyed by prompt to avoid redundant API calls.

### 6. Backend (Express on Cloud Run)

Minimal Express server:
- Development: Vite middleware for HMR
- Production: Serves static `dist/` directory
- Health check: `GET /api/health`
- Cloud Run provides PORT (8080), Node.js 20 runtime via Docker

## Deployment Pipeline

```
deploy.sh
  |
  +-- gcloud config set project
  +-- gcloud services enable (run, cloudbuild, containerregistry)
  +-- gcloud builds submit (builds Docker image with GEMINI_API_KEY ARG)
  +-- gcloud run deploy (deploys container, public access, 512Mi/1CPU)
  +-- prints live URL
```

The entire deployment is automated via `deploy.sh` and can be run with a single command.

## Google Cloud Services

| Service | Purpose |
|---------|---------|
| **Cloud Run** | Hosts the containerized Express + React application |
| **Cloud Build** | Builds the Docker image from source |
| **Container Registry** | Stores the built Docker image |
| **Gemini API** (via GenAI SDK) | Live coaching (audio + text) and image generation |
