# I Built an AI Driving Coach for People Who Can't Use Foot Pedals. Here's How.

*This blog post was created for the purposes of entering the Gemini Live Agent Challenge hackathon. #GeminiLiveAgentChallenge*

---

Let me tell you something that surprised me.

6.8 million Americans have a disability that makes it difficult or impossible to use foot pedals to drive. And for most of them, learning to drive with adaptive hand controls means finding one of fewer than 200 certified specialists in the entire country, waiting months for an appointment, and then figuring out how to afford the training.

That hit me. Because driving is not just about getting places. It is freedom. It is the difference between depending on someone else for every doctor visit, every grocery run, every moment of connection with the outside world, and being able to just... go. Loneliness and isolation are real health risks, and when you cannot drive, the world gets very small very fast.

So I asked myself: what if someone could practice adaptive hand controls from home, with just a webcam and a browser, before they ever sit in a real vehicle?

That question became **AdaptiveDrive AI**.

## What It Actually Does

Here is the idea. You open the app in Chrome. You hold one hand up in front of your webcam. Raise it to accelerate. Lower it to brake. Move it left or right to steer. Your hand is simulating a real push-pull adaptive driving lever, the kind that drivers with physical disabilities actually use.

And while you are doing all of this, a live AI coach is talking to you. Not reading a script. Actually watching your speed, your steering, how far you are from a traffic light, and coaching you through it in real time. You can talk back to it, hands-free. It is like having a driving instructor in the passenger seat, except you are sitting at your desk.

The training is progressive. You start with the basics (can you accelerate? can you brake?), move through speed challenges (hit 40 mph, slow to 10, accelerate to 60), and then face real scenarios like approaching a traffic light that goes from green to yellow to red. The AI coach adapts to what is happening, not what it thinks should be happening.

## The Tech Behind It

Let me break down what is actually going on under the hood, because this is where it gets interesting.

**The Gemini Live API is the heart of this project.** I am using `gemini-2.5-flash-native-audio-preview-12-2025` with bidirectional audio streaming over WebSocket. That means the AI is not just responding to text prompts. It is listening through your microphone and speaking back in real time. Every 2 seconds, the app sends structured data to Gemini with your current speed, steering angle, distance to the next obstacle, what training phase you are in, and what your targets are. Gemini takes all of that context and coaches you naturally.

This is what makes it a *live agent* and not just a chatbot with a driving theme. The AI is actively participating in the experience, reacting to what is happening right now.

**MediaPipe Hands** handles the hand tracking through the webcam. It runs entirely in the browser using WASM, which means no server round trips for the tracking itself. When it first detects your hand, it calibrates over 20 frames to find your neutral position, then uses exponential moving average smoothing to keep the input steady. Y-axis (up and down) maps to throttle and brake. X-axis (left and right) maps to steering.

**Three.js** renders the driving environment. A road, your car, oncoming traffic, trees, buildings, and a full traffic light system with distance-based phase changes. It all runs at 60fps, driven by your hand input.

**Web Audio API** handles gapless audio playback. Gemini streams back 24kHz PCM audio chunks, and I schedule them back-to-back on the audio timeline so the coach's voice sounds natural without gaps or stuttering. Getting this right was one of the harder technical problems in the project.

The whole thing is built with **React 19, TypeScript, and Tailwind CSS v4** on the frontend, with a lightweight **Express server** serving the production build. It is deployed on **Google Cloud Run** using **Cloud Build** and **Artifact Registry** for the container pipeline.

## What Went Wrong (A Lot)

I will be honest. This project fought me at every step.

The Gemini Live API WebSocket kept closing immediately after connecting. Turns out that was a billing configuration issue, but the error messages were not exactly helpful. Then once I got it connected, the reconnect logic had a bug where it would reset its attempt counter every time the socket briefly opened before dying again, creating an infinite reconnect loop. I had to track total attempts separately with a hard cap.

Audio was choppy at first because I was playing each chunk sequentially instead of scheduling them on the Web Audio timeline. React's StrictMode was silently destroying my Three.js renderer by double-mounting the component. A `setInterval` callback was reading stale React state because of JavaScript closures, so the practice checklist never detected any progress.

Each of these bugs took real debugging time. And each one taught me something about how these technologies actually behave under pressure, not how they work in the documentation.

## The Google Cloud Piece

Deployment is on **Google Cloud Run** with a multi-stage Docker build. The first stage installs dependencies and builds the React frontend with Vite (baking in the Gemini API key at build time). The second stage creates a slim production image with just the server and the built assets.

**Cloud Build** handles the container builds using a `cloudbuild.yaml` that passes the API key as a substitution variable. **Artifact Registry** stores the container images. I also wrote a `deploy.sh` script that automates the entire pipeline: setting the project, enabling APIs, building, and deploying. One command and you are live.

Setting `min-instances` to 1 was important. Cloud Run can scale to zero by default, which means cold starts. For a real-time app where someone might be demoing it to judges, you do not want a 30-second loading screen. Keeping one instance warm solved that.

## Why This Matters

Look, this is a hackathon project. It is not a finished product. The AI coach's timing is not perfect. The hand tracking is sensitive to lighting. The driving scenarios are basic.

But here is what I keep coming back to: this concept works. You can sit at your desk, hold up your hand, and practice the fundamental motions of adaptive driving while an AI talks you through it. No special hardware. No expensive simulator. No waiting months for an appointment.

Real adaptive driving involves levers, switches, and many different steering wheel configurations. Every person's needs are different. The next version of this would start matching the simulator to actual adaptive driving equipment. Progress tracking so the AI remembers what you have practiced. Collaboration with rehabilitation specialists to build validated training curricula.

But it starts here. With a webcam, a browser, and the willingness to build something that might actually help people.

## The Tools That Made It Possible

The Gemini Live API is genuinely powerful for this kind of application. Having bidirectional audio streaming with the ability to send structured context data alongside voice input opens up interaction patterns that just were not possible before. The AI is not just answering questions. It is actively coaching, in real time, based on what is actually happening.

Google Cloud Run made deployment straightforward. Docker container, push it up, it scales. Cloud Build and Artifact Registry handled the CI/CD pipeline without me having to think about it too much.

And MediaPipe running entirely in the browser through WASM is remarkable. Real-time hand tracking with no server dependency, no special camera, nothing. Just your webcam.

These tools let me go from idea to working prototype in a hackathon timeframe. The idea has been living in my head for a while, but the technology to actually build it the way I wanted finally exists.

If you want to try it yourself: [https://adaptivedrive-ai-614150524504.us-central1.run.app](https://adaptivedrive-ai-614150524504.us-central1.run.app)

You will need Chrome, a webcam, a microphone, and good lighting (seriously, the lighting matters for hand tracking). Hold your hand up and see what happens.

The code is open source: [https://github.com/TKHatton/AdaptiveDrive-AI](https://github.com/TKHatton/AdaptiveDrive-AI)

---

*Built for the Gemini Live Agent Challenge hackathon on DevPost. #GeminiLiveAgentChallenge*
