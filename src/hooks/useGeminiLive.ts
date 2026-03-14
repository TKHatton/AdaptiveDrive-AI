import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export function useGeminiLive() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const connect = useCallback(async () => {
    setStatus('connecting');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are AdaptiveDrive AI, a supportive, professional, and highly observant driving instructor specializing in adaptive hand controls.
          Your goal is to coach users through specific driving scenarios with precision and encouragement.
          
          Tone & Style:
          - Professional yet warm (like a real-world driving instructor).
          - Concise and natural. Avoid long monologues.
          - Use automotive terminology (e.g., "feather the throttle," "smooth braking," "maintain lane position").
          - Be proactive: narrate upcoming situations before they happen.
          - Be reactive: immediately correct poor technique or dangerous movements.
          
          Data Interpretation:
          - You will receive [SYSTEM DATA] containing Scenario, Step, Throttle, Brake, Steering, and Gesture.
          - "Gesture" field tells you exactly what the perception system detected (e.g., "Abrupt braking detected").
          - Use this to provide immediate feedback.
          
          Scenarios & Focus:
          1. Starting the vehicle: Ensure the user releases the brake fully before applying gentle, steady throttle.
          2. Stop sign: Watch for gradual deceleration. If "Abrupt braking" is detected, tell them it was "too abrupt." If they don't stop in time, tell them they "overshot the line."
          3. Turning: Focus on the coordination between slowing down and rotating the hand for steering.
          
          Interaction Rules:
          - Ask readiness questions (e.g., "Are you ready to begin the stop sign exercise?").
          - Provide real-time feedback based on the [SYSTEM DATA].
          - If hand tracking is lost (Throttle/Brake/Steering stay 0 and Gesture is None for too long), encourage them to reposition.`,
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            console.log("Gemini Live Connected");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              setTranscript(prev => [...prev, `AI: ${message.serverContent.modelTurn.parts[0].text}`]);
            }
            
            // Handle audio output (simplified for scaffold)
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              playAudio(base64Audio);
            }
          },
          onerror: (error) => {
            console.error("Gemini Live Error:", error);
            setStatus('error');
          },
          onclose: () => {
            setStatus('idle');
            console.log("Gemini Live Closed");
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to connect to Gemini Live:", err);
      setStatus('error');
    }
  }, []);

  const playAudio = async (base64: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
    // Note: Live API uses raw PCM, but for this scaffold we assume a standard decoding approach
    // In a real implementation, you'd handle the PCM stream chunks.
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      console.warn("Audio decode failed (expected for raw PCM in scaffold):", e);
    }
  };

  const sendHandUpdate = useCallback((handData: any) => {
    if (sessionRef.current && status === 'connected') {
      const message = handData.context || `Current Hand State: Throttle ${handData.throttle}, Brake ${handData.brake}, Steering ${handData.steering}`;
      sessionRef.current.sendRealtimeInput({
        text: message
      });
    }
  }, [status]);

  const sendMessage = useCallback((text: string) => {
    if (sessionRef.current && status === 'connected') {
      sessionRef.current.sendRealtimeInput({ text });
      setTranscript(prev => [...prev, `You: ${text}`]);
    }
  }, [status]);

  return { status, connect, transcript, sendHandUpdate, sendMessage };
}
