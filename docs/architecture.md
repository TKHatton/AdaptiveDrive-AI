# System Architecture: AdaptiveDrive AI

AdaptiveDrive AI is built on a multimodal event-driven architecture that bridges computer vision, 3D rendering, and generative AI.

## Architecture Diagram

```text
User Interface (React 19 + Tailwind CSS v4)
|
+-- Input Layer
|   +-- Webcam Feed --> MediaPipe Hands (Gesture Analysis)
|   +-- Text Input --> User questions to AI coach
|
+-- Processing Layer (React Hooks)
|   +-- useHandTracking
|   |   - 15-frame calibration for neutral hand position
|   |   - Z-axis displacement -> throttle/brake (push/pull)
|   |   - X-axis position -> steering (-1 to 1)
|   |   - Exponential moving average smoothing
|   |   - 5-frame debounce on hand loss detection
|   |
|   +-- useGeminiLive
|       - WebSocket connection to Gemini Live API
|       - Sends structured [SYSTEM DATA] every 3 seconds
|       - Receives audio (raw 16-bit PCM @ 24kHz) + text
|       - Audio queue with sequential playback
|
+-- Visualization Layer (Three.js)
|   +-- DrivingScene
|       - Procedural road with dashed lane lines, edge lines, center line
|       - Trees (layered cone geometry with randomized placement)
|       - Buildings with windowed facades (urban scenarios)
|       - Street lights along road shoulders
|       - Stop sign (proper octagonal geometry)
|       - Crosswalk, side road, turn arrow for scenarios
|       - Car model with wheels, cabin, headlights, taillights
|       - Scenery scrolling for motion illusion
|       - Shadow mapping (PCFSoft) + fog + ACES tone mapping
|
+-- AI Layer (Gemini)
|   +-- Live API: Real-time coaching via audio + text
|   +-- Image Generation: Scenario-specific background images
|
+-- Scenario Engine (App.tsx)
    - Phase machine: intro -> prep -> action -> feedback
    - Distance-based coaching cues (stop sign scenario)
    - Gesture classification (heavy accel, hard brake, etc.)
    - Session timer
    - Scenario selector with visual state
```

## Component Breakdown

### 1. Hand Tracking (MediaPipe Hands)

Uses a single hand for accessibility. The wrist (landmark 0) and middle finger MCP (landmark 9) provide stable Z-axis tracking for push/pull detection. Index finger tip (landmark 8) handles X-axis steering.

Key improvements over basic MediaPipe usage:
- **Calibration**: Averages the first 15 detected frames to establish a neutral Z position, preventing drift on startup
- **Smoothing**: Exponential moving average (lerp factor 0.25-0.30) on all values reduces hand jitter
- **Debounce**: Requires 5 consecutive missing frames before marking hand as "lost," preventing flicker
- **Mirror correction**: Inverts X-axis steering to match mirrored video feed

### 2. 3D Environment (Three.js)

A fully procedural scene (no external 3D models required). Key elements:
- **Road**: 12-unit wide, 400-unit long with double yellow center line, white dashed lane lines, and solid edge lines
- **Motion effect**: Dashed lane lines scroll toward the camera at speed-proportional rate, creating the illusion of driving forward
- **Scenery**: Trees, buildings, and street lights scroll past the camera and wrap around when they pass behind
- **Scenario objects**: Stop signs (proper octagon via ExtrudeGeometry), crosswalks, side roads, and turn arrows appear based on active scenario
- **Car**: Multi-part model with metallic body, transparent cabin, wheels with hubcaps, headlights, and taillights
- **Rendering**: Shadow mapping, exponential fog, hemisphere lighting, ACES filmic tone mapping

### 3. Gemini Live Integration

The application maintains a persistent WebSocket connection to Gemini via the Live API.

**Input pipeline**: Every 3 seconds, the app sends a structured text payload:
```
[SYSTEM DATA] Scenario: Approaching a Stop Sign, Step: action,
Throttle: 45, Brake: 0, Steering: -0.12, Gesture: Heavy acceleration
```

**Output pipeline**: Gemini returns both audio (raw 16-bit PCM at 24kHz, mono) and text. Audio chunks are queued and played sequentially through the Web Audio API. Text responses appear in the coach transcript panel.

**System prompt**: The AI adopts the persona of a professional adaptive driving instructor. It provides short, real-time coaching during action phases and longer performance summaries during feedback phases.

### 4. Image Generation

When Scenario Mode is active, the app calls Gemini's image generation model with a detailed prompt describing the driving scenario from the driver's perspective. Generated images are cached per prompt to avoid redundant API calls.

### 5. Backend (Express)

Minimal Express server that:
- Serves the Vite dev middleware in development
- Serves static built assets in production
- Provides a health check endpoint at `/api/health`

## Deployment Strategy

The application is designed for Google Cloud Run:
- Vite builds the frontend into `dist/`
- Express serves the SPA with the health check
- Environment variables (API keys) managed via Cloud Run secrets or `.env.yaml`
- Single container, no additional services required
