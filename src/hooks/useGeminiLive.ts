import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export function useGeminiLive() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isMicActive, setIsMicActive] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const ensureAudioContext = () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playNextAudioChunk = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    isPlayingRef.current = true;
    const ctx = ensureAudioContext();

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;

      try {
        const int16Array = new Int16Array(chunk);
        const float32Array = new Float32Array(int16Array.length);

        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }

        const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        await new Promise<void>((resolve) => {
          source.onended = () => resolve();
          source.start();
        });
      } catch (e) {
        console.warn("Audio playback error:", e);
      }
    }

    isPlayingRef.current = false;
  };

  // Start streaming microphone audio to Gemini Live
  const startMic = useCallback(async () => {
    if (!sessionRef.current || isMicActive) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      micStreamRef.current = stream;

      // Create audio context for mic processing at 16kHz (Gemini input rate)
      const micCtx = new AudioContext({ sampleRate: 16000 });
      const source = micCtx.createMediaStreamSource(stream);
      micSourceRef.current = source;

      // Use ScriptProcessor to get raw PCM data
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!sessionRef.current) return;

        const inputData = event.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64 for Gemini Live API
        const bytes = new Uint8Array(int16Data.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        try {
          sessionRef.current.sendRealtimeInput({
            media: {
              data: base64,
              mimeType: 'audio/pcm;rate=16000',
            }
          });
        } catch (e) {
          // Connection may have closed
        }
      };

      source.connect(processor);
      processor.connect(micCtx.destination);
      setIsMicActive(true);
    } catch (err) {
      console.error("Microphone access error:", err);
    }
  }, [isMicActive]);

  const stopMic = useCallback(() => {
    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    setIsMicActive(false);
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is not set");
        setStatus('error');
        setTranscript(prev => [...prev, 'AI: API key not configured. Please set GEMINI_API_KEY in your .env file.']);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      ensureAudioContext();

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-preview-native-audio-dialog",
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are AdaptiveDrive AI Coach, a supportive and proactive driving instructor for adaptive hand controls.

YOUR JOB: Actively coach the user through driving exercises in real time. Do NOT wait for them to ask. YOU lead the lesson.

HOW THE CONTROLS WORK:
The user holds one hand in front of their webcam. The camera tracks hand height and position:
- Raising hand UP from neutral = Accelerate (like pulling a lever up)
- Lowering hand DOWN from neutral = Brake (like pushing a lever down)
- Moving hand LEFT or RIGHT = Steering
The camera view is MIRRORED. When the user sees their right hand on screen, it appears on the left side. Account for this when giving directions.

IMPORTANT: The user's webcam is mirrored (selfie mode). Their RIGHT hand appears on the LEFT side of the video feed. When you reference which hand they're using, say "your right hand" or "your left hand" based on their actual physical hand, not the screen position.

DATA FORMAT: You receive [SYSTEM DATA] with real-time values:
- Scenario: what exercise they're doing
- Step: intro/prep/action/feedback phase
- Throttle: 0-100 (how much they're accelerating)
- Brake: 0-100 (how much they're braking)
- Steering: -1 to 1 (negative = left, positive = right)

COACHING BEHAVIOR:
1. When connected, greet them warmly and tell them what to do first: "Welcome! Let's start by raising your hand in front of the camera."
2. During 'intro' phase: Explain the upcoming scenario clearly.
3. During 'prep' phase: Guide hand positioning. "Good, I can see your hand. Now slowly raise it up to start moving forward."
4. During 'action' phase: Give SHORT real-time coaching (1 sentence max):
   - If Throttle is 0 and they should be moving: "Raise your hand higher to accelerate."
   - If Throttle > 60: "Easy, that's a lot of speed. Lower your hand slightly."
   - If Brake > 70: "That's too sudden. Lower your hand more gently for a smoother stop."
   - If approaching a stop: "Start lowering your hand now to brake."
   - If drifting in lane (Steering > 0.4 or < -0.4): "Straighten out, move your hand back to center."
5. During 'feedback': Give one specific positive ("Your acceleration was smooth") and one specific improvement ("Try starting the brake a bit earlier next time").

PROACTIVE COACHING: Do not wait for the user to ask. If you see them not moving (Throttle: 0 for more than a few updates), say something like "Go ahead and raise your hand up to start moving." If their hand is lost, say "I can't see your hand. Bring it back in front of the camera."

VOICE CONVERSATION: The user can speak to you through their microphone. Listen for questions and respond naturally. Keep driving-related responses short during action phases.

TONE: Encouraging, clear, patient. Like a calm driving instructor. Never say "push" or "pull." Always say "raise your hand" to go and "lower your hand" to brake.`,
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            console.log("Gemini Live connected");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.text) {
                  setTranscript(prev => [...prev, `AI: ${part.text}`]);
                }

                if (part.inlineData?.data) {
                  try {
                    const binaryString = atob(part.inlineData.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    audioQueueRef.current.push(bytes.buffer);
                    playNextAudioChunk();
                  } catch (e) {
                    console.warn("Audio processing error:", e);
                  }
                }
              }
            }
          },
          onerror: (error: any) => {
            console.error("Gemini Live error:", error);
            setStatus('error');
            setTranscript(prev => [...prev, 'AI: Connection lost. Please refresh and try again.']);
          },
          onclose: () => {
            setStatus('idle');
            console.log("Gemini Live closed");
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Failed to connect to Gemini Live:", err);
      setStatus('error');

      const errorMsg = err?.message || 'Unknown error';
      if (errorMsg.includes('API key') || errorMsg.includes('401')) {
        setTranscript(prev => [...prev, 'AI: Invalid API key. Please check your GEMINI_API_KEY.']);
      } else if (errorMsg.includes('model')) {
        setTranscript(prev => [...prev, 'AI: The AI model is currently unavailable. Please try again later.']);
      } else {
        setTranscript(prev => [...prev, `AI: Could not connect to the AI coach. Error: ${errorMsg}`]);
      }
    }
  }, []);

  const sendHandUpdate = useCallback((handData: any) => {
    if (sessionRef.current && status === 'connected') {
      const message = handData.context || `[SYSTEM DATA] Throttle: ${handData.throttle}, Brake: ${handData.brake}, Steering: ${handData.steering}`;
      try {
        sessionRef.current.sendRealtimeInput({ text: message });
      } catch (e) {
        console.warn("Failed to send hand update:", e);
      }
    }
  }, [status]);

  const sendMessage = useCallback((text: string) => {
    if (sessionRef.current && status === 'connected') {
      try {
        sessionRef.current.sendRealtimeInput({ text });
        // Only show user messages in transcript, not system messages
        if (!text.startsWith('[SYSTEM')) {
          setTranscript(prev => [...prev, `You: ${text}`]);
        }
      } catch (e) {
        console.warn("Failed to send message:", e);
      }
    } else {
      if (!text.startsWith('[SYSTEM')) {
        setTranscript(prev => [...prev, `You: ${text}`]);
      }
    }
  }, [status]);

  const disconnect = useCallback(() => {
    stopMic();
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        // ignore
      }
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setStatus('idle');
  }, [stopMic]);

  return { status, connect, disconnect, transcript, sendHandUpdate, sendMessage, startMic, stopMic, isMicActive };
}
