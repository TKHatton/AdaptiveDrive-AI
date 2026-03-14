import { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import * as cam from '@mediapipe/camera_utils';
import { HandState } from '../shared/types';

// Smoothing helper: exponential moving average
function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

/**
 * Hand tracking using Y-axis (up/down) for throttle/brake.
 *
 * How it works:
 * - When you first put your hand in view, it calibrates the "neutral" Y position
 * - Move your hand UP from neutral = Accelerate (like pulling a lever up)
 * - Move your hand DOWN from neutral = Brake (like pushing a lever down)
 * - Move your hand LEFT/RIGHT = Steering
 *
 * This is much more intuitive than Z-depth because:
 * - Up/down movement is clearly visible on camera
 * - Maps naturally to a lever: up = go, down = stop
 * - Camera can detect Y position very reliably
 */
export default function useHandTracking(enabled: boolean = false) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [handState, setHandState] = useState<HandState>({
    throttle: 0,
    brake: 0,
    steering: 0,
    isPresent: false,
  });
  const [error, setError] = useState<string | null>(null);

  const neutralYRef = useRef<number | null>(null);
  const cameraRef = useRef<cam.Camera | null>(null);
  const smoothedRef = useRef({ throttle: 0, brake: 0, steering: 0 });
  const calibrationFrames = useRef(0);
  const calibrationSumY = useRef(0);

  useEffect(() => {
    if (!enabled) {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      setHandState({ throttle: 0, brake: 0, steering: 0, isPresent: false });
      neutralYRef.current = null;
      calibrationFrames.current = 0;
      calibrationSumY.current = 0;
      return;
    }

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65,
    });

    let lostFrameCount = 0;

    hands.onResults((results: Results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        lostFrameCount = 0;
        const landmarks = results.multiHandLandmarks[0];

        // Detect handedness - MediaPipe reports from camera's perspective
        // Since the video is mirrored, we need to flip: camera's "Right" = user's Left hand
        let detectedHand: 'Left' | 'Right' = 'Right';
        if (results.multiHandedness && results.multiHandedness.length > 0) {
          const cameraLabel = results.multiHandedness[0].label; // "Left" or "Right" from camera POV
          // Mirror it: camera sees "Right" = user's physical Left hand (mirrored video)
          detectedHand = cameraLabel === 'Right' ? 'Left' : 'Right';
        }

        // Use wrist (0) for stable Y-axis tracking (throttle/brake)
        // Use wrist X for steering (more stable than fingertip)
        const wrist = landmarks[0];
        const middleMCP = landmarks[9];

        // Average Y of wrist and middle MCP for stability
        // In MediaPipe, Y goes 0 (top of frame) to 1 (bottom of frame)
        const currentY = (wrist.y + middleMCP.y) / 2;

        // Calibration: average the first 20 frames to find neutral hand height
        if (calibrationFrames.current < 20) {
          calibrationSumY.current += currentY;
          calibrationFrames.current++;
          if (calibrationFrames.current === 20) {
            neutralYRef.current = calibrationSumY.current / 20;
          }
          setHandState(prev => ({ ...prev, isPresent: true }));
          return;
        }

        if (neutralYRef.current === null) {
          neutralYRef.current = currentY;
        }

        // Y displacement from neutral
        // In MediaPipe coordinates: smaller Y = hand is HIGHER on screen
        // Hand UP (Y decreases) = Accelerate
        // Hand DOWN (Y increases) = Brake
        const displacement = currentY - neutralYRef.current;

        let throttle = 0;
        let brake = 0;
        const deadzone = 0.04; // Small deadzone around neutral
        const maxRange = 0.25; // Full range of motion

        if (displacement < -deadzone) {
          // Hand moved UP = Accelerate
          const magnitude = Math.abs(displacement) - deadzone;
          throttle = Math.min((magnitude / (maxRange - deadzone)) * 100, 100);
        } else if (displacement > deadzone) {
          // Hand moved DOWN = Brake
          const magnitude = displacement - deadzone;
          brake = Math.min((magnitude / (maxRange - deadzone)) * 100, 100);
        }

        // Steering: use wrist X position (more stable than fingertip)
        // Video is mirrored, so we invert
        // Range: 0 to 1, center at 0.5
        const rawSteering = -(wrist.x - 0.5) * 3.0;
        const clampedSteering = Math.max(-1, Math.min(1, rawSteering));

        // Smooth all values
        const smooth = smoothedRef.current;
        smooth.throttle = lerp(smooth.throttle, throttle, 0.25);
        smooth.brake = lerp(smooth.brake, brake, 0.25);
        smooth.steering = lerp(smooth.steering, clampedSteering, 0.2);

        setHandState({
          throttle: Math.round(smooth.throttle),
          brake: Math.round(smooth.brake),
          steering: parseFloat(smooth.steering.toFixed(2)),
          isPresent: true,
          handedness: detectedHand,
        });
      } else {
        lostFrameCount++;
        if (lostFrameCount > 5) {
          setHandState(prev => ({ ...prev, isPresent: false }));
          neutralYRef.current = null;
          calibrationFrames.current = 0;
          calibrationSumY.current = 0;
        }
      }
    });

    if (videoRef.current) {
      const camera = new cam.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            try {
              await hands.send({ image: videoRef.current });
            } catch (e) {
              // Silently handle frame processing errors
            }
          }
        },
        width: 640,
        height: 480,
      });

      camera.start()
        .then(() => {
          cameraRef.current = camera;
          setError(null);
        })
        .catch(err => {
          console.error("Camera start error:", err);
          setError("Camera access is required for hand tracking. Please allow camera permissions.");
        });
    }

    return () => {
      hands.close();
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [enabled]);

  return { videoRef, handState, error };
}
