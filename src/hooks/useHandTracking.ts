import { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import * as cam from '@mediapipe/camera_utils';
import { HandState } from '../shared/types';

export default function useHandTracking(enabled: boolean = false) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [handState, setHandState] = useState<HandState>({
    throttle: 0,
    brake: 0,
    steering: 0,
    isPresent: false,
  });
  const [error, setError] = useState<string | null>(null);

  const prevZRef = useRef<number | null>(null);
  const neutralZRef = useRef<number | null>(null);
  const cameraRef = useRef<cam.Camera | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      return;
    }

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results: Results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const currentZ = indexTip.z;

        if (neutralZRef.current === null) {
          neutralZRef.current = currentZ;
        }

        const displacement = currentZ - neutralZRef.current;
        let throttle = 0;
        let brake = 0;
        const threshold = 0.05;
        const maxRange = 0.2;

        if (displacement < -threshold) {
          // Pull (towards camera, Z decreases) -> Accelerate (Throttle)
          throttle = Math.min(((Math.abs(displacement) - threshold) / (maxRange - threshold)) * 100, 100);
        } else if (displacement > threshold) {
          // Push (away from camera, Z increases) -> Brake
          brake = Math.min(((displacement - threshold) / (maxRange - threshold)) * 100, 100);
        }

        const steering = (indexTip.x - 0.5) * 2;

        setHandState({
          throttle: Math.round(throttle),
          brake: Math.round(brake),
          steering: parseFloat(steering.toFixed(2)),
          isPresent: true,
        });

        prevZRef.current = currentZ;
      } else {
        setHandState(prev => ({ ...prev, isPresent: false }));
        neutralZRef.current = null;
      }
    });

    if (videoRef.current) {
      const camera = new cam.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            try {
              await hands.send({ image: videoRef.current });
            } catch (e) {
              console.error("Hands send error:", e);
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
          setError("Camera access required for hand tracking.");
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
