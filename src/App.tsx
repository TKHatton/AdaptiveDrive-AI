import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Mic, Play, StopCircle, Info, ChevronRight, Activity, Image as ImageIcon, Zap, RotateCcw, Volume2 } from 'lucide-react';
import DrivingScene from './components/DrivingScene';
import useHandTracking from './hooks/useHandTracking';
import { useGeminiLive } from './hooks/useGeminiLive';
import { SCENARIOS } from './shared/types';
import { generateEnvironmentImage } from './services/imageService';

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const { videoRef, handState, error: cameraError } = useHandTracking(isStarted);
  const { status, connect, disconnect, transcript, sendHandUpdate, sendMessage, startMic, stopMic, isMicActive } = useGeminiLive();
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [scenarioStep, setScenarioStep] = useState<'intro' | 'prep' | 'action' | 'feedback'>('intro');
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [distance, setDistance] = useState(100);
  const [sessionTime, setSessionTime] = useState(0);
  const lastCueRef = useRef<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const scenarioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentScenario = SCENARIOS[currentScenarioIndex];

  // Session timer
  useEffect(() => {
    if (!isStarted) return;
    const timer = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [isStarted]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Distance-based Coaching Cues
  useEffect(() => {
    if (currentScenario.id === 'stop' && scenarioStep === 'action') {
      if (distance < 40 && distance > 35 && lastCueRef.current !== 'ease') {
        sendMessage("[SYSTEM] User approaching stop sign at 40m. Coach them to ease off throttle.");
        lastCueRef.current = 'ease';
      } else if (distance < 20 && distance > 15 && lastCueRef.current !== 'brake') {
        sendMessage("[SYSTEM] User at 20m from stop sign. Coach them to begin braking.");
        lastCueRef.current = 'brake';
      } else if (distance < 5 && lastCueRef.current !== 'stop') {
        if (handState.brake > 30) {
          sendMessage("[SYSTEM] User stopped near the line. Good stop.");
        } else {
          sendMessage("[SYSTEM] User passed the stop line without stopping.");
        }
        lastCueRef.current = 'stop';
      }
    } else if (scenarioStep === 'intro') {
      lastCueRef.current = null;
    }
  }, [distance, currentScenario.id, scenarioStep, sendMessage, handState.brake]);

  // Gesture Feedback Logic
  useEffect(() => {
    if (!handState.isPresent) {
      setGestureFeedback(null);
      return;
    }

    if (handState.throttle > 50) {
      setGestureFeedback("Heavy Acceleration");
    } else if (handState.throttle > 20) {
      setGestureFeedback("Accelerating");
    } else if (handState.brake > 50) {
      setGestureFeedback("Hard Braking");
    } else if (handState.brake > 20) {
      setGestureFeedback("Braking");
    } else if (handState.steering < -0.4) {
      setGestureFeedback("Steering Left");
    } else if (handState.steering > 0.4) {
      setGestureFeedback("Steering Right");
    } else if (handState.throttle > 5 || handState.brake > 5) {
      setGestureFeedback("Coasting");
    } else {
      const timer = setTimeout(() => setGestureFeedback(null), 800);
      return () => clearTimeout(timer);
    }
  }, [handState.throttle, handState.brake, handState.steering, handState.isPresent]);

  const handleGenerateBackground = useCallback(async (prompt: string) => {
    if (isPracticeMode) {
      setBackgroundUrl(null);
      return;
    }

    setIsGenerating(true);
    const url = await generateEnvironmentImage(prompt);
    setBackgroundUrl(url);
    setIsGenerating(false);
  }, [isPracticeMode]);

  // Scenario Engine Logic
  useEffect(() => {
    if (!isStarted || status !== 'connected') return;

    if (scenarioTimerRef.current) {
      clearTimeout(scenarioTimerRef.current);
    }

    const runScenario = async () => {
      setScenarioStep('intro');
      handleGenerateBackground(currentScenario.prompt);
      sendMessage(`[SYSTEM] Starting scenario: ${currentScenario.title}. ${currentScenario.description}. Introduce the scenario to the user and explain what they need to do. Tell them to raise their hand in front of the camera to begin.`);

      scenarioTimerRef.current = setTimeout(() => {
        setScenarioStep('prep');
        sendMessage(`[SYSTEM] Preparation phase. Instruction for user: ${currentScenario.instruction}. Guide them step by step. If their hand is not visible, tell them to raise it. If they are not accelerating, tell them to raise their hand higher.`);

        scenarioTimerRef.current = setTimeout(() => {
          setScenarioStep('action');
          sendMessage(`[SYSTEM] Action phase started. The user should now be driving. Give real-time coaching. If Throttle is 0, tell them to raise their hand to start moving. Be proactive. Coach them through the entire exercise.`);

          scenarioTimerRef.current = setTimeout(() => {
            setScenarioStep('feedback');
            sendMessage(`[SYSTEM] Scenario complete. Summarize performance. One specific positive, one specific improvement. Then tell them they can click Next Scenario or keep practicing.`);
          }, 30000); // 30 seconds for action phase
        }, 8000); // 8 seconds for prep
      }, 6000); // 6 seconds for intro
    };

    runScenario();

    return () => {
      if (scenarioTimerRef.current) {
        clearTimeout(scenarioTimerRef.current);
      }
    };
  }, [currentScenarioIndex, isStarted, status]);

  // Send hand state updates to Gemini (every 2s for more responsive coaching)
  useEffect(() => {
    if (isStarted && status === 'connected') {
      const timer = setInterval(() => {
        const handInfo = handState.handedness ? `, Hand: ${handState.handedness}` : '';
        const abruptBraking = handState.brake > 60 ? ', Gesture: Abrupt braking detected' : '';
        const heavyThrottle = handState.throttle > 70 ? ', Gesture: Heavy acceleration' : '';
        const notMoving = (!handState.isPresent || (handState.throttle < 5 && handState.brake < 5)) ? ', Status: Not moving' : '';
        const handPresent = handState.isPresent ? ', HandVisible: YES' : ', HandVisible: NO';
        const context = `[SYSTEM DATA] Scenario: ${currentScenario.title}, Step: ${scenarioStep}, Throttle: ${handState.throttle}, Brake: ${handState.brake}, Steering: ${handState.steering.toFixed(2)}${handInfo}${handPresent}${notMoving}${abruptBraking}${heavyThrottle}`;
        sendHandUpdate({ ...handState, context });
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [isStarted, handState, sendHandUpdate, currentScenario, scenarioStep, status]);

  const handleStart = () => {
    setIsStarted(true);
    setShowInstructions(true);
    setSessionTime(0);
    connect();
    // Auto-start mic after a short delay to let Gemini connect
    setTimeout(() => startMic(), 2000);
    setTimeout(() => setShowInstructions(false), 7000);
  };

  const handleStop = () => {
    setIsStarted(false);
    stopMic();
    disconnect();
    setScenarioStep('intro');
    setSessionTime(0);
  };

  const handleNextScenario = () => {
    const next = (currentScenarioIndex + 1) % SCENARIOS.length;
    setCurrentScenarioIndex(next);
    setScenarioStep('intro');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-800 font-sans p-4 md:p-6">
      {/* Debug Toggle */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white p-2 rounded-full opacity-30 hover:opacity-100 transition-opacity"
      >
        <Activity size={18} />
      </button>

      {/* Debug Panel */}
      <AnimatePresence>
        {showDebug && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed top-24 right-4 z-50 bg-black/85 backdrop-blur-xl p-5 rounded-2xl border border-white/20 text-white font-mono text-xs space-y-1.5 shadow-2xl max-w-[280px]"
          >
            <h4 className="text-[#22B8A5] font-bold mb-2 uppercase tracking-widest text-[10px]">Developer Debug</h4>
            <p>Hand: <span className={handState.isPresent ? 'text-emerald-400' : 'text-rose-400'}>{handState.isPresent ? 'DETECTED' : 'NONE'}</span></p>
            <p>Throttle: <span className="text-[#22B8A5]">{handState.throttle}%</span></p>
            <p>Brake: <span className="text-rose-400">{handState.brake}%</span></p>
            <p>Steering: <span className="text-blue-400">{handState.steering.toFixed(2)}</span></p>
            <p>Scenario: {currentScenario.id} / {scenarioStep}</p>
            <p>Gemini: <span className={status === 'connected' ? 'text-emerald-400' : 'text-rose-400'}>{status}</span></p>
            <p>Distance: {distance.toFixed(0)}m</p>
            <p>Session: {formatTime(sessionTime)}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="max-w-7xl mx-auto flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            AdaptiveDrive <span className="text-[#2F6DF6]">AI</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium">Multimodal AI Coach for Adaptive Hand-Control Driving</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPracticeMode(!isPracticeMode)}
            className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${isPracticeMode ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
          >
            {isPracticeMode ? <Zap size={14} /> : <ImageIcon size={14} />}
            {isPracticeMode ? 'Practice Mode' : 'Scenario Mode'}
          </button>
          {isStarted && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold bg-slate-900 text-white">
              {formatTime(sessionTime)}
            </div>
          )}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold ${status === 'connected' ? 'bg-emerald-100 text-emerald-700' : status === 'connecting' ? 'bg-amber-100 text-amber-700' : status === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>
            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : status === 'connecting' ? 'bg-amber-500 animate-pulse' : status === 'error' ? 'bg-rose-500' : 'bg-slate-400'}`} />
            {status === 'connected' ? 'Coach Live' : status === 'connecting' ? 'Connecting...' : status === 'error' ? 'Error' : 'Offline'}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 3D Scene & Controls */}
        <div className="lg:col-span-8 space-y-5">
          {/* Dashboard Panel */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Scenario</p>
                <p className="text-sm font-bold text-slate-900">{currentScenario.title}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Phase</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${scenarioStep === 'action' ? 'bg-emerald-500 animate-pulse' : 'bg-[#2F6DF6] animate-pulse'}`} />
                  <p className="text-sm font-bold text-[#2F6DF6] capitalize">{scenarioStep}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Throttle</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-[#22B8A5] rounded-full" animate={{ width: `${handState.throttle}%` }} transition={{ duration: 0.15 }} />
                  </div>
                  <span className="text-xs font-bold text-[#22B8A5] w-8 text-right">{handState.throttle}%</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Brake</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-rose-500 rounded-full" animate={{ width: `${handState.brake}%` }} transition={{ duration: 0.15 }} />
                  </div>
                  <span className="text-xs font-bold text-rose-500 w-8 text-right">{handState.brake}%</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Steering</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative">
                    <motion.div
                      className="absolute h-full w-3 bg-[#2F6DF6] rounded-full"
                      animate={{ left: `${50 + handState.steering * 45}%` }}
                      transition={{ duration: 0.15 }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[#2F6DF6] w-8 text-right">
                    {handState.steering < -0.2 ? 'L' : handState.steering > 0.2 ? 'R' : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Driving Scene */}
          <div className="relative aspect-video w-full bg-slate-900 rounded-2xl shadow-xl overflow-hidden border-2 border-white">
            <DrivingScene
              speed={handState.throttle - (handState.brake * 1.5)}
              steering={handState.steering}
              scenarioId={currentScenario.id}
              backgroundUrl={backgroundUrl}
              onDistanceUpdate={setDistance}
            />

            {/* Generation Loader */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-10"
                >
                  <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[#2F6DF6] border-t-transparent rounded-full animate-spin" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-900">Generating Environment</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Gemini AI is painting your scene...</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scenario Progress Overlay */}
            {isStarted && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/20 text-white text-center min-w-[280px]">
                <p className="text-[10px] uppercase tracking-widest text-[#22B8A5] font-bold mb-1">{currentScenario.title}</p>
                <h3 className="text-base font-bold mb-2">
                  {scenarioStep === 'intro' && "Get Ready..."}
                  {scenarioStep === 'prep' && "Position Your Hands"}
                  {scenarioStep === 'action' && "Perform the Maneuver"}
                  {scenarioStep === 'feedback' && "Exercise Complete"}
                </h3>
                <div className="flex gap-1 justify-center">
                  {(['intro', 'prep', 'action', 'feedback'] as const).map((step, i) => (
                    <div
                      key={step}
                      className={`h-1 w-8 rounded-full transition-all duration-500 ${
                        scenarioStep === step ? 'bg-[#22B8A5]' :
                        ['intro', 'prep', 'action', 'feedback'].indexOf(scenarioStep) > i ? 'bg-[#22B8A5]/40' :
                        'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
                {scenarioStep === 'feedback' && (
                  <button
                    onClick={handleNextScenario}
                    className="mt-3 bg-[#2F6DF6] hover:bg-[#1d56d9] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 mx-auto"
                  >
                    Next Scenario <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Gesture Feedback Pill */}
            <AnimatePresence>
              {gestureFeedback && isStarted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#2F6DF6] text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg pointer-events-none"
                >
                  {gestureFeedback}
                </motion.div>
              )}
            </AnimatePresence>

            {!isStarted && (
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-slate-900/30 flex flex-col items-center justify-center gap-6">
                <div className="text-center">
                  <h2 className="text-3xl font-extrabold text-white mb-2">Adaptive Driving Simulator</h2>
                  <p className="text-sm text-white/70 max-w-md">Practice adaptive hand-control driving with a live AI coach. Hold your hand up in front of your webcam. Raise it to go, lower it to stop, move it side to side to steer.</p>
                </div>
                <button
                  onClick={handleStart}
                  className="bg-[#2F6DF6] hover:bg-[#1d56d9] text-white px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all transform hover:scale-105 shadow-xl"
                >
                  <Play fill="currentColor" size={20} />
                  Start Training Session
                </button>
              </div>
            )}

            {isStarted && (
              <button
                onClick={handleStop}
                className="absolute top-4 right-4 bg-black/50 hover:bg-rose-600 backdrop-blur-md text-white p-2 rounded-xl transition-colors"
              >
                <StopCircle size={18} />
              </button>
            )}
          </div>

          {/* Scenario Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SCENARIOS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => {
                  setCurrentScenarioIndex(idx);
                  setScenarioStep('intro');
                }}
                className={`p-5 rounded-2xl border-2 transition-all text-left ${
                  currentScenarioIndex === idx
                    ? 'border-[#2F6DF6] bg-white shadow-md'
                    : 'border-transparent bg-white/60 hover:bg-white hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${currentScenarioIndex === idx ? 'text-[#2F6DF6]' : 'text-slate-400'}`}>
                    Scenario {idx + 1}
                  </span>
                  {currentScenarioIndex === idx && (
                    <span className="text-[8px] bg-[#2F6DF6] text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Active</span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 mb-1 text-sm">{s.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Camera & AI Coach */}
        <div className="lg:col-span-4 space-y-5">
          {/* Camera Feed */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden mb-3">
              <video ref={videoRef} className="w-full h-full object-cover mirror" autoPlay playsInline muted />

              {/* Steering Wheel with Integrated Lever */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <motion.svg
                  width="260" height="280" viewBox="0 0 130 145"
                  className="drop-shadow-lg"
                  style={{ filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.6))' }}
                >
                  {/* Steering wheel (rotates with hand, full 360 range) */}
                  <g transform="translate(65, 52)">
                    <motion.g
                      animate={{ rotate: handState.steering * 180 }}
                      transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                    >
                      {/* Wheel rim */}
                      <circle cx="0" cy="0" r="40" fill="none" stroke="white" strokeWidth="6" opacity="0.55" />
                      {/* Hub */}
                      <circle cx="0" cy="0" r="8" fill="none" stroke="white" strokeWidth="2.5" opacity="0.4" />
                      {/* Spokes */}
                      <line x1="0" y1="-37" x2="0" y2="-11" stroke="white" strokeWidth="4" opacity="0.4" />
                      <line x1="-37" y1="4" x2="-11" y2="4" stroke="white" strokeWidth="4" opacity="0.4" />
                      <line x1="11" y1="4" x2="37" y2="4" stroke="white" strokeWidth="4" opacity="0.4" />
                      {/* Spinner knob (blue dot at 2 o'clock) */}
                      <g transform="rotate(30)">
                        <circle cx="0" cy="-38" r="5" fill="#2F6DF6" stroke="white" strokeWidth="1.5" />
                      </g>
                    </motion.g>
                  </g>

                  {/* Push-Pull Lever (below steering column, fixed) */}
                  <g transform="translate(65, 97)">
                    {/* Track background */}
                    <rect x="-2.5" y="-4" width="5" height="42" rx="2.5" fill="white" opacity="0.15" />

                    {/* UP arrow + label */}
                    <text x="0" y="-8" fill="#22B8A5" fontSize="6" fontWeight="bold" textAnchor="middle" opacity="0.95">HAND UP</text>
                    <text x="0" y="-14" fill="#22B8A5" fontSize="5" textAnchor="middle" opacity="0.7">= GO</text>

                    {/* DOWN arrow + label */}
                    <text x="0" y="48" fill="#ef4444" fontSize="6" fontWeight="bold" textAnchor="middle" opacity="0.95">HAND DOWN</text>
                    <text x="0" y="54" fill="#ef4444" fontSize="5" textAnchor="middle" opacity="0.7">= STOP</text>

                    {/* Neutral line */}
                    <line x1="-8" y1="18" x2="8" y2="18" stroke="white" strokeWidth="0.5" opacity="0.3" />
                    <text x="12" y="20" fill="white" fontSize="3.5" textAnchor="start" opacity="0.4">neutral</text>

                    {/* Lever handle */}
                    <motion.g
                      animate={{
                        y: handState.throttle > 5 ? -(handState.throttle / 100) * 16 :
                           handState.brake > 5 ? (handState.brake / 100) * 16 :
                           0
                      }}
                      transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                    >
                      {/* Shaft */}
                      <rect x="-2" y="10" width="4" height="16" rx="2" fill="white" opacity="0.5" />
                      {/* Grip */}
                      <rect x="-7" y="13" width="14" height="10" rx="4" fill={
                        handState.throttle > 20 ? '#22B8A5' :
                        handState.brake > 20 ? '#ef4444' :
                        '#2F6DF6'
                      } stroke="white" strokeWidth="1.2" />
                      {/* Grip lines */}
                      <line x1="-3.5" y1="16" x2="3.5" y2="16" stroke="white" strokeWidth="0.6" opacity="0.4" />
                      <line x1="-3.5" y1="18" x2="3.5" y2="18" stroke="white" strokeWidth="0.6" opacity="0.4" />
                      <line x1="-3.5" y1="20" x2="3.5" y2="20" stroke="white" strokeWidth="0.6" opacity="0.4" />
                    </motion.g>
                  </g>

                  {/* Hint when hand not detected */}
                  {isStarted && !handState.isPresent && (
                    <text x="65" y="142" fill="white" fontSize="5" fontWeight="bold" textAnchor="middle" opacity="0.8">
                      Raise / lower your hand to control
                    </text>
                  )}
                </motion.svg>
              </div>

              {/* Hand Detection Status */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-1 rounded-full text-[9px] font-bold text-white">
                <div className={`w-1.5 h-1.5 rounded-full ${handState.isPresent ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
                {handState.isPresent ? 'Hand OK' : 'No Hand'}
              </div>

              {cameraError && (
                <div className="absolute inset-0 bg-rose-500/80 flex items-center justify-center p-6 text-center">
                  <div>
                    <Camera size={24} className="text-white mx-auto mb-2" />
                    <p className="text-white font-bold text-sm">{cameraError}</p>
                    <p className="text-white/80 text-xs mt-1">Please allow camera access to use hand tracking.</p>
                  </div>
                </div>
              )}

              {!handState.isPresent && isStarted && !cameraError && (
                <div className="absolute inset-0 bg-rose-500/15 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="text-center">
                    <p className="bg-rose-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest mb-1">Hand Not Detected</p>
                    <p className="text-rose-800 text-[10px] font-semibold">Place your hand in front of the camera</p>
                  </div>
                </div>
              )}

              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-1 rounded-full text-white text-[9px] font-medium">
                <Camera size={10} />
                Live Tracking
              </div>
            </div>
            <div className="flex items-start gap-2 text-slate-500 text-xs">
              <Info size={14} className="text-[#2F6DF6] mt-0.5 shrink-0" />
              <p>Hold your hand in front of the camera. <strong className="text-[#22B8A5]">Raise your hand up</strong> to accelerate, <strong className="text-rose-500">lower it down</strong> to brake, and move <strong className="text-[#2F6DF6]">left/right</strong> to steer.</p>
            </div>
          </div>

          {/* Initial Control Instructions Modal */}
          <AnimatePresence>
            {showInstructions && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl w-full text-center space-y-6"
                >
                  <h2 className="text-3xl font-extrabold text-slate-900">How to Drive</h2>
                  <p className="text-base text-slate-500">Hold one hand up in front of your webcam. Your hand position controls the vehicle, just like an adaptive driving lever.</p>

                  <div className="bg-slate-50 rounded-2xl p-8 space-y-6">
                    {/* Big visual diagram */}
                    <svg width="100%" height="200" viewBox="0 0 500 200" className="shrink-0">
                      {/* Camera at top center */}
                      <rect x="220" y="5" width="60" height="30" rx="6" fill="#334155" />
                      <circle cx="250" cy="20" r="9" fill="#64748b" />
                      <circle cx="250" cy="20" r="4" fill="#475569" />
                      <text x="250" y="52" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">YOUR WEBCAM</text>

                      {/* Center: hand at neutral */}
                      <text x="250" y="120" fontSize="48" textAnchor="middle">&#9995;</text>
                      <text x="250" y="142" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">NEUTRAL POSITION</text>

                      {/* Left: hand up = accelerate */}
                      <g>
                        <line x1="80" y1="140" x2="80" y2="75" stroke="#22B8A5" strokeWidth="3" />
                        <polygon points="72,78 88,78 80,62" fill="#22B8A5" />
                        <text x="80" y="60" textAnchor="middle" fontSize="40">&#9995;</text>
                        <rect x="25" y="150" width="110" height="40" rx="10" fill="#22B8A5" opacity="0.15" />
                        <text x="80" y="168" textAnchor="middle" fill="#22B8A5" fontSize="14" fontWeight="bold">HAND UP</text>
                        <text x="80" y="184" textAnchor="middle" fill="#22B8A5" fontSize="12">= Accelerate</text>
                      </g>

                      {/* Right: hand down = brake */}
                      <g>
                        <line x1="420" y1="80" x2="420" y2="145" stroke="#ef4444" strokeWidth="3" />
                        <polygon points="412,142 428,142 420,158" fill="#ef4444" />
                        <text x="420" y="175" textAnchor="middle" fontSize="40">&#9995;</text>
                        <rect x="365" y="150" width="110" height="40" rx="10" fill="#ef4444" opacity="0.15" />
                        <text x="420" y="168" textAnchor="middle" fill="#ef4444" fontSize="14" fontWeight="bold">HAND DOWN</text>
                        <text x="420" y="184" textAnchor="middle" fill="#ef4444" fontSize="12">= Brake</text>
                      </g>

                      {/* Steering arrows at bottom */}
                      <line x1="195" y1="120" x2="155" y2="120" stroke="#2F6DF6" strokeWidth="2.5" />
                      <polygon points="158,114 158,126 145,120" fill="#2F6DF6" />
                      <text x="140" y="137" textAnchor="middle" fill="#2F6DF6" fontSize="11" fontWeight="bold">STEER LEFT</text>

                      <line x1="305" y1="120" x2="345" y2="120" stroke="#2F6DF6" strokeWidth="2.5" />
                      <polygon points="342,114 342,126 355,120" fill="#2F6DF6" />
                      <text x="360" y="137" textAnchor="middle" fill="#2F6DF6" fontSize="11" fontWeight="bold">STEER RIGHT</text>
                    </svg>

                    {/* Three clear boxes */}
                    <div className="grid grid-cols-3 gap-4 text-left">
                      <div className="bg-white rounded-xl p-4 border-2 border-[#22B8A5]/30">
                        <p className="text-sm font-extrabold text-[#22B8A5] mb-1">Accelerate</p>
                        <p className="text-sm text-slate-700">Raise your hand higher in front of the camera</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border-2 border-rose-300/50">
                        <p className="text-sm font-extrabold text-rose-500 mb-1">Brake</p>
                        <p className="text-sm text-slate-700">Lower your hand down in front of the camera</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border-2 border-[#2F6DF6]/30">
                        <p className="text-sm font-extrabold text-[#2F6DF6] mb-1">Steer</p>
                        <p className="text-sm text-slate-700">Move your hand left or right</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-400">This simulates a real adaptive push-pull driving lever. The camera tracks your hand height and position.</p>
                  <p className="text-xs text-slate-400 uppercase tracking-widest animate-pulse">Calibrating your hand position...</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Coach Chat */}
          <div className="bg-slate-900 rounded-2xl shadow-xl flex flex-col h-[380px] overflow-hidden">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-[#22B8A5] animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-white text-[10px] font-bold uppercase tracking-widest">AI Coach</span>
                {isMicActive && (
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                    <Mic size={8} /> Voice On
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => isMicActive ? stopMic() : startMic()}
                  className={`p-1.5 rounded-lg transition-colors ${isMicActive ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/10 text-white/40 hover:text-white/70'}`}
                  title={isMicActive ? 'Mute microphone' : 'Unmute microphone (talk to coach)'}
                >
                  <Mic size={14} />
                </button>
                <Volume2 size={14} className="text-white/40" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {transcript.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/20 text-sm text-center px-6">
                  <div>
                    <Mic size={24} className="mx-auto mb-3 opacity-50" />
                    <p>Start the session to begin receiving coaching guidance from your AI instructor. Your microphone will auto-activate so you can talk to the coach hands-free.</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {transcript.map((msg, i) => {
                    const isAI = msg.startsWith('AI:');
                    const isSystem = msg.includes('[SYSTEM');
                    if (isSystem && !showDebug) return null;

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`p-3 rounded-xl text-sm leading-relaxed ${
                          isSystem ? 'bg-amber-500/10 text-amber-300 text-xs font-mono' :
                          isAI ? 'bg-white/10 text-white' :
                          'bg-[#2F6DF6] text-white ml-6'
                        }`}
                      >
                        {isAI && <span className="text-[9px] uppercase tracking-widest text-[#22B8A5] font-bold block mb-1">Coach</span>}
                        {msg.replace(/^(AI:|You:)\s*/, '')}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
              <div ref={transcriptEndRef} />
            </div>

            <div className="p-3 bg-white/5">
              <div className="relative">
                <input
                  type="text"
                  placeholder={isMicActive ? "Voice active. Just speak, or type here..." : "Ask your coach anything..."}
                  className="w-full bg-white/10 border border-white/15 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-[#2F6DF6] transition-all placeholder:text-white/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      sendMessage(e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-10 pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-3 text-slate-400 text-xs">
        <p>AdaptiveDrive AI. Built for Gemini Live Agent Challenge.</p>
        <div className="flex gap-4">
          <a href="./docs/architecture.md" className="hover:text-slate-600 transition-colors">Architecture</a>
          <a href="#" className="hover:text-slate-600 transition-colors">Accessibility</a>
        </div>
      </footer>
    </div>
  );
}
