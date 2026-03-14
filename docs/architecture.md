# System Architecture: AdaptiveDrive AI

AdaptiveDrive AI is built on a multimodal event-driven architecture that bridges computer vision, 3D rendering, and generative AI.

## Architecture Diagram

```text
User Interface (React)
│
├── Input Layer
│   ├── Webcam Feed ──> MediaPipe Hands (Gesture Analysis)
│   └── Microphone ───> Browser Web Audio API
│
├── Processing Layer (Frontend Hooks)
│   ├── useHandTracking: Normalizes gestures to Throttle/Brake/Steer
│   └── useGeminiLive: Manages WebSocket connection to Gemini 3.1
│
├── Visualization Layer (Three.js)
│   └── DrivingScene: Renders 3D road and car based on normalized inputs
│
└── AI Layer (Gemini 3.1)
    └── Live API: Receives multimodal state, returns voice/text coaching
```

## Component Breakdown

### 1. Hand Tracking (MediaPipe)
The system uses the index finger tip and wrist landmarks to calculate a "push/pull" vector. This vector is mapped to:
- **Push**: Throttle (Acceleration)
- **Pull**: Brake (Deceleration)
- **X-Offset**: Steering

### 2. 3D Environment (Three.js)
A lightweight 3D scene provides visual feedback. The road moves relative to the calculated speed, and the car rotates based on steering input. This creates a closed-loop feedback system for the user.

### 3. Gemini Live Integration
The application establishes a real-time connection to Gemini 3.1. 
- **Input**: The frontend sends periodic "state updates" (JSON strings describing hand positions) and user voice input.
- **Output**: Gemini returns real-time coaching responses via the Live API's audio and text modalities.

### 4. Backend (Express)
The backend serves the static frontend assets and provides a health-check API. In a production environment, it can be extended to handle user authentication and session persistence.

## Deployment Strategy
The application is containerized and optimized for **Google Cloud Run**. 
- The frontend is bundled by Vite.
- The Express server handles routing and serves the SPA.
- Environment variables (API keys) are managed via Cloud Secret Manager.
