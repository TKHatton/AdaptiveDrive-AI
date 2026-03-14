export interface HandState {
  throttle: number; // 0 to 1 (push)
  brake: number;    // 0 to 1 (pull)
  steering: number; // -1 to 1
  isPresent: boolean;
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
    description: 'Learn to release the brake and apply gentle throttle to move forward.',
    instruction: 'Push the hand control forward slightly to accelerate.',
    prompt: 'realistic residential street from driver perspective, daytime, clear sky, asphalt road'
  },
  {
    id: 'stop',
    title: 'Approaching a Stop Sign',
    description: 'Practice gradual braking as you approach a stop sign.',
    instruction: 'Pull the hand control back steadily to come to a complete stop.',
    prompt: 'urban intersection with stop sign from driver viewpoint, realistic city street, daytime'
  },
  {
    id: 'turn',
    title: 'Turning at an Intersection',
    description: 'Coordinate steering with speed control during a turn.',
    instruction: 'Slow down, then rotate your hand to steer into the turn.',
    prompt: 'city street turning intersection from driver perspective, realistic urban environment, daytime'
  }
];
