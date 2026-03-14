# AdaptiveDrive AI

**A multimodal AI driving coach for adaptive hand-control driving.**

AdaptiveDrive AI is a training simulator that teaches adaptive hand-control driving techniques through gesture recognition, real-time AI coaching, and 3D driving environments. Built for the Gemini Live Agent Challenge.

## Why This Exists

Over 600,000 people in the U.S. drive with adaptive hand controls. Learning to operate push/pull throttle-brake levers is challenging, and real-world practice can feel high-stakes. AdaptiveDrive AI provides a safe, interactive environment where users can build muscle memory and confidence before they ever touch a real vehicle.

## How It Works

1. **Hand Tracking**: Your webcam tracks hand movements using MediaPipe. Push forward to brake. Pull back to accelerate. Move left/right to steer. No special hardware needed.

2. **3D Driving Environment**: A Three.js scene renders a road with trees, buildings, stop signs, and intersections. The car responds to your hand movements in real time.

3. **AI Coaching**: Gemini connects as a live driving instructor via the Live API. It watches your hand data, coaches you through scenarios ("Ease off the throttle... begin braking now..."), and provides performance feedback.

4. **AI-Generated Scenery**: In Scenario Mode, Gemini generates photorealistic background images matching each driving scenario for visual immersion.

## Scenarios

| Scenario | What You Practice |
|----------|------------------|
| Starting the Vehicle | Smooth, gentle acceleration from a stop |
| Approaching a Stop Sign | Gradual braking with distance-based coaching |
| Turning at an Intersection | Coordinating speed control with steering |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| 3D Rendering | Three.js (procedural scene with shadows, fog, trees, buildings) |
| Hand Tracking | MediaPipe Hands (single hand, push/pull/steer detection) |
| AI Coaching | Gemini Live API (real-time audio + text, native audio dialog) |
| Image Generation | Gemini Image Generation (scenario backgrounds) |
| Animation | Motion (Framer Motion) |
| Backend | Express + Vite dev server |
| Deployment | Google Cloud Run ready |

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Gemini API Key with access to the Live API

### Installation

```bash
git clone https://github.com/your-repo/adaptive-drive-ai.git
cd adaptive-drive-ai
npm install
```

### Environment Setup

Create a `.env` file in the root:

```env
GEMINI_API_KEY=your_api_key_here
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
npm start
```

## Architecture

```
User (Webcam + Hands)
    |
    v
MediaPipe Hands --> useHandTracking hook
    |                   |
    |     Throttle / Brake / Steering (normalized 0-100 / -1 to 1)
    |                   |
    v                   v
DrivingScene        useGeminiLive hook
(Three.js 3D)       (Gemini Live API)
    |                   |
    |    Real-time       |    AI coaching
    |    visual          |    (voice + text)
    |    feedback        |
    v                   v
         App.tsx (React)
         Dashboard UI + Scenario Engine
```

**Key design decisions:**
- Single-hand tracking for accessibility (many adaptive drivers use one hand)
- Push/pull Z-axis detection maps directly to real adaptive lever mechanics
- 15-frame calibration period on hand detection for stable neutral position
- Exponential moving average smoothing on all hand values to reduce jitter
- Gemini receives structured `[SYSTEM DATA]` payloads with scenario context
- Audio playback handles raw 16-bit PCM at 24kHz (Gemini Live output format)
- 3D scenery (trees, buildings, lights) scrolls past the camera for motion illusion
- Road dashed lines animate independently for visible road movement

## Deployment (Google Cloud Run)

```bash
npm run build

gcloud run deploy adaptive-drive-ai \
  --source . \
  --env-vars-file .env.yaml \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Accessibility

This project is built with accessibility in mind:
- Single-hand operation (matches real adaptive driving controls)
- High-contrast UI with clear visual feedback
- Text transcripts of all AI coaching (not audio-only)
- Large, clearly labeled controls
- No reliance on color alone for status indicators

## License

Apache-2.0
