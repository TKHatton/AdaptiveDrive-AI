# Demo Script: AdaptiveDrive AI

This script outlines the flow for a 3-minute demo video of AdaptiveDrive AI.

## 1. Introduction (0:00 - 0:45)
- **Visual**: Show the landing page with the "Start Training Session" button.
- **Narration**: "Welcome to AdaptiveDrive AI. For many drivers with disabilities, hand controls are the gateway to independence. But learning them can be intimidating. AdaptiveDrive AI is a multimodal coach that lets you practice safely before you ever hit the road."

## 2. Setup & Hand Tracking (0:45 - 1:15)
- **Action**: Click "Start Training". Show the webcam feed detecting the hand.
- **Visual**: Move hand forward and backward. Show the HUD bars (Throttle/Brake) reacting in real-time.
- **Narration**: "Using MediaPipe, we track hand movements with zero custom hardware. A push motion simulates the throttle, while a pull motion applies the brakes. Our 3D environment reacts instantly, giving the user immediate visual feedback."

## 3. AI Coaching in Action (1:15 - 2:30)
- **Action**: Select the "Approaching a Stop Sign" scenario.
- **Visual**: The AI transcript shows: "AI: You're approaching a stop sign. Start easing off the throttle and prepare to brake."
- **Action**: Pull the hand back abruptly.
- **Visual**: AI Transcript: "AI: That was a bit sharp! Try to pull the lever more gradually next time for a smoother stop."
- **Narration**: "The heart of the system is Gemini 3.1. It doesn't just see the data; it understands the context. It acts as a supportive instructor, providing real-time corrections and encouragement based on the user's performance."

## 4. Conclusion & Cloud Deployment (2:30 - 3:00)
- **Visual**: Show the architecture diagram and the Cloud Run deployment command in a terminal.
- **Narration**: "AdaptiveDrive AI is built for scale, deployed on Google Cloud Run, and ready to help the next generation of adaptive drivers gain confidence. Driving is freedom, and we're making it more accessible than ever."
