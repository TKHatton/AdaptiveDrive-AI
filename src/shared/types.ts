export interface HandState {
  throttle: number; // 0 to 100
  brake: number;    // 0 to 100
  steering: number; // -1 to 1
  isPresent: boolean;
  handedness?: 'Left' | 'Right'; // Which physical hand is being used
  context?: string; // Contextual data sent to Gemini
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  instruction: string;
  prompt: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'start',
    title: 'Starting the Vehicle',
    description: 'Learn to release the brake and apply gentle, steady throttle to move forward smoothly.',
    instruction: 'Raise your hand up slowly to accelerate. Keep the motion smooth and steady.',
    prompt: 'A realistic first-person view from inside a car on a quiet residential street. Daytime, clear blue sky, suburban houses and trees lining both sides of a two-lane road. The car is parked and ready to move. Photorealistic, wide angle.'
  },
  {
    id: 'stop',
    title: 'Approaching a Stop Sign',
    description: 'Practice gradual braking as you approach a stop sign. The goal is a smooth, controlled stop at the line.',
    instruction: 'As the stop sign approaches, lower your hand down to brake. Start gently and lower further for harder braking.',
    prompt: 'A realistic first-person view from inside a car approaching a stop sign at an intersection. Urban street with buildings, daytime, clear weather. The stop sign is visible ahead. Photorealistic, wide angle, driver perspective.'
  },
  {
    id: 'turn',
    title: 'Turning at an Intersection',
    description: 'Coordinate steering with speed control to make a smooth right turn at an intersection.',
    instruction: 'Lower your hand to slow down, then move it to the right to steer through the turn. Keep your hand at a steady height for consistent speed.',
    prompt: 'A realistic first-person view from inside a car at an intersection ready to make a right turn. City street with crosswalk markings visible, daytime. Other streets visible to the right. Photorealistic, wide angle, driver perspective.'
  }
];
