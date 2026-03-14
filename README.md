# AdaptiveDrive AI — A Multimodal AI Coach for Adaptive Hand-Control Driving

AdaptiveDrive AI is a multimodal AI driving coach designed to help individuals learn and practice adaptive hand-control driving techniques in a safe, simulated environment.

Built for the **Gemini Live Agent Challenge**, this project leverages Gemini 3.1's multimodal capabilities, MediaPipe's computer vision, and Three.js for real-time visual feedback.

## Features

- **Real-time Hand Tracking**: Uses MediaPipe Hands to detect push/pull motions simulating adaptive throttle and brake controls.
- **Multimodal AI Coaching**: Gemini 3.1 acts as a live instructor, providing voice guidance and reacting to user movements.
- **Scenario-Based Training**: Includes guided exercises for starting, stopping, and turning.
- **3D Visualization**: A responsive Three.js environment providing visual context for driving scenarios.
- **Accessible UI**: A clean, dashboard-inspired interface focused on clarity and ease of use.

## Technology Stack

- **Frontend**: React, TypeScript, Three.js, MediaPipe Hands
- **AI**: Gemini 3.1 (Google GenAI SDK)
- **Backend**: Node.js, Express (Google Cloud Run ready)
- **Styling**: Tailwind CSS, Motion (Framer Motion)

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Gemini API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/adaptive-drive-ai.git
   cd adaptive-drive-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

### Running Locally

```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

## Deployment (Google Cloud Run)

To deploy the backend to Google Cloud Run:

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy using gcloud CLI:
   ```bash
   gcloud run deploy adaptive-drive-ai \
     --source . \
     --env-vars-file .env.yaml \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

## Architecture

See [docs/architecture.md](./docs/architecture.md) for a detailed system overview.

## License

Apache-2.0
