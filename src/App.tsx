import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Mic, Play, StopCircle, Info, ChevronRight, Activity, Image as ImageIcon, Zap } from 'lucide-react';
import DrivingScene from './components/DrivingScene';
import useHandTracking from './hooks/useHandTracking';
import { useGeminiLive } from './hooks/useGeminiLive';
import { SCENARIOS } from './shared/types';
import { generateEnvironmentImage } from './services/imageService';

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const { videoRef, handState, error: cameraError } = useHandTracking(isStarted);
  const { status, connect, transcript, sendHandUpdate, sendMessage } = useGeminiLive();
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [scenarioStep, setScenarioStep] = useState<'intro' | 'prep' | 'action' | 'feedback'>('intro');
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [showKnobTooltip, setShowKnobTooltip] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [distance, setDistance] = useState(100);
  const lastCueRef = useRef<string | null>(null);

  const currentScenario = SCENARIOS[currentScenarioIndex];

  // Distance-based Coaching Cues
  useEffect(() => {
    if (currentScenario.id === 'stop' && scenarioStep === 'action') {
      if (distance < 40 && distance > 35 && lastCueRef.current !== 'ease') {
        sendMessage("Start easing off the throttle.");
        lastCueRef.current = 'ease';
      } else if (distance < 20 && distance > 15 && lastCueRef.current !== 'brake') {
        sendMessage("Begin braking now.");
        lastCueRef.current = 'brake';
      }
    } else if (scenarioStep === 'intro') {
      lastCueRef.current = null;
    }
  }, [distance, currentScenario.id, scenarioStep, sendMessage]);

  // Speech Synthesis
  useEffect(() => {
    if (transcript.length > 0) {
      const lastMessage = transcript[transcript.length - 1];
      if (lastMessage.startsWith('AI:')) {
        const textToSpeak = lastMessage.replace('AI:', '').trim();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 0.9; // Calm driving instructor
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [transcript]);

  // Gesture Feedback Logic
  useEffect(() => {
    if (handState.throttle > 30) {
      setGestureFeedback("Accelerating ↑");
    } else if (handState.brake > 30) {
      setGestureFeedback("Braking ↓");
    } else if (handState.steering < -0.3) {
      setGestureFeedback("Steering Left ←");
    } else if (handState.steering > 0.3) {
      setGestureFeedback("Steering Right →");
    } else if (handState.brake > 5 && handState.brake < 20) {
      setGestureFeedback("Smooth braking");
    } else {
      // Clear after a delay if no strong gesture
      const timer = setTimeout(() => setGestureFeedback(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [handState.throttle, handState.brake, handState.steering]);

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

    const runScenario = async () => {
      setScenarioStep('intro');
      
      // Generate background for new scenario
      handleGenerateBackground(currentScenario.prompt);
      
      sendMessage(`Starting scenario: ${currentScenario.title}. ${currentScenario.description}`);
      
      await new Promise(r => setTimeout(r, 5000));
      setScenarioStep('prep');
      sendMessage(`Preparation: ${currentScenario.instruction}`);

      await new Promise(r => setTimeout(r, 5000));
      setScenarioStep('action');
      sendMessage(`Action! Perform the movement now.`);

      await new Promise(r => setTimeout(r, 8000));
      setScenarioStep('feedback');
      sendMessage(`Scenario complete. How did that feel?`);
    };

    runScenario();
  }, [currentScenarioIndex, isStarted, status, handleGenerateBackground]);

  useEffect(() => {
    if (isStarted && handState.isPresent) {
      const timer = setInterval(() => {
        // Send more detailed state to Gemini
        const context = `[SYSTEM DATA] Scenario: ${currentScenario.title}, Step: ${scenarioStep}, Throttle: ${handState.throttle}, Brake: ${handState.brake}, Steering: ${handState.steering}, Gesture: ${gestureFeedback || 'None'}`;
        sendHandUpdate({ ...handState, context });
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [isStarted, handState, sendHandUpdate, currentScenario, scenarioStep, gestureFeedback]);

  const handleStart = () => {
    setIsStarted(true);
    setShowInstructions(true);
    connect();
    setTimeout(() => setShowInstructions(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-800 font-sans p-4 md:p-8">
      {/* Debug Toggle */}
      <button 
        onClick={() => setShowDebug(!showDebug)}
        className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white p-2 rounded-full opacity-50 hover:opacity-100 transition-opacity"
      >
        <Activity size={20} />
      </button>

      {/* Debug Panel */}
      <AnimatePresence>
        {showDebug && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed top-24 right-8 z-50 bg-black/80 backdrop-blur-xl p-6 rounded-3xl border border-white/20 text-white font-mono text-xs space-y-2 shadow-2xl"
          >
            <h4 className="text-[#22B8A5] font-bold mb-2 uppercase tracking-widest">Developer Debug</h4>
            <p>Hand Detected: <span className={handState.isPresent ? 'text-emerald-400' : 'text-rose-400'}>{handState.isPresent ? 'TRUE' : 'FALSE'}</span></p>
            <p>Throttle: {handState.throttle}</p>
            <p>Brake: {handState.brake}</p>
            <p>Steering: {handState.steering}</p>
            <p>Scenario: {currentScenario.id}</p>
            <p>Step: {scenarioStep}</p>
            <p>Gemini: {status}</p>
            <div className="mt-2 pt-2 border-t border-white/20">
              <p className="text-[#22B8A5] font-bold">Environment Prompt:</p>
              <p className="italic opacity-80">"{currentScenario.prompt}"</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="max-w-7xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">AdaptiveDrive <span className="text-[#2F6DF6]">AI</span></h1>
          <p className="text-slate-500 font-medium">Multimodal AI Coach for Adaptive Hand-Control Driving</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPracticeMode(!isPracticeMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${isPracticeMode ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
          >
            {isPracticeMode ? <Zap size={16} /> : <ImageIcon size={16} />}
            {isPracticeMode ? 'Practice Mode (Simple)' : 'Scenario Mode (Generative)'}
          </button>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
            <Activity size={16} />
            {status === 'connected' ? 'Coach Connected' : status === 'connecting' ? 'Connecting...' : 'Coach Offline'}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 3D Scene & Controls */}
        <div className="lg:col-span-8 space-y-6">
          {/* Coaching Panel */}
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Current Scenario</p>
              <p className="text-sm font-bold text-slate-900">{currentScenario.title}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Phase</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#2F6DF6] animate-pulse" />
                <p className="text-sm font-bold text-[#2F6DF6] capitalize">{scenarioStep}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Throttle</p>
              <p className="text-sm font-bold text-[#22B8A5]">{handState.throttle}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Brake</p>
              <p className="text-sm font-bold text-rose-500">{handState.brake}%</p>
            </div>
          </div>

          <div className="relative aspect-video w-full bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-4 border-white">
            <DrivingScene 
              speed={handState.throttle - (handState.brake * 1.5)} // Braking is more powerful
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
                  <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#2F6DF6] border-t-transparent rounded-full animate-spin" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-900">Generating Environment</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Gemini AI is painting your scene...</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Real-time HUD */}
            <div className="absolute top-6 left-6 flex gap-4">
              <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-white">
                <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Throttle</p>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-[#22B8A5]" 
                      animate={{ width: `${handState.throttle}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold w-12">{handState.throttle}% {handState.throttle > 5 ? '↑' : ''}</span>
                </div>
              </div>
              <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-white">
                <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Brake</p>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-rose-500" 
                      animate={{ width: `${handState.brake}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold w-12">{handState.brake}% {handState.brake > 5 ? '↓' : ''}</span>
                </div>
              </div>
            </div>

            {/* Scenario Progress Overlay */}
            {isStarted && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/20 text-white text-center min-w-[300px]">
                <p className="text-[10px] uppercase tracking-widest text-[#22B8A5] font-bold mb-1">{currentScenario.title}</p>
                <h3 className="text-lg font-bold mb-2">
                  {scenarioStep === 'intro' && "Get Ready..."}
                  {scenarioStep === 'prep' && "Prepare Controls"}
                  {scenarioStep === 'action' && "Perform Action!"}
                  {scenarioStep === 'feedback' && "Well Done"}
                </h3>
                <div className="flex gap-1 justify-center">
                  {['intro', 'prep', 'action', 'feedback'].map((step) => (
                    <div 
                      key={step} 
                      className={`h-1 w-8 rounded-full transition-colors ${scenarioStep === step ? 'bg-[#22B8A5]' : 'bg-white/20'}`} 
                    />
                  ))}
                </div>
              </div>
            )}

            {!isStarted && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                <button 
                  onClick={handleStart}
                  className="bg-[#2F6DF6] hover:bg-[#1d56d9] text-white px-8 py-4 rounded-2xl font-bold text-xl flex items-center gap-3 transition-all transform hover:scale-105 shadow-xl"
                >
                  <Play fill="currentColor" />
                  Start Training Session
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SCENARIOS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => {
                  setCurrentScenarioIndex(idx);
                  setScenarioStep('intro');
                }}
                className={`p-6 rounded-2xl border-2 transition-all text-left ${currentScenarioIndex === idx ? 'border-[#2F6DF6] bg-white shadow-lg' : 'border-transparent bg-white/50 hover:bg-white'}`}
              >
                <p className={`text-[10px] uppercase tracking-widest mb-2 ${currentScenarioIndex === idx ? 'text-[#2F6DF6]' : 'text-slate-400'}`}>Scenario 0{idx + 1}</p>
                <h3 className="font-bold text-slate-900 mb-1">{s.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: AI Coach & Camera */}
        <div className="lg:col-span-4 space-y-6">
          {/* Camera Feed with Steering Wheel Overlay */}
          <div className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100">
            <div className="relative aspect-video bg-slate-100 rounded-2xl overflow-hidden mb-4">
              <video ref={videoRef} className="w-full h-full object-cover mirror" autoPlay playsInline muted />
              
              {/* Hand Placement Guides */}
              <div className="absolute inset-0 pointer-events-none flex justify-between px-8 py-12">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/5" />
                  </div>
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Steering Hand</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/5" />
                  </div>
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Push/Pull Control</span>
                </div>
              </div>

              {/* Steering Wheel Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-80">
                <motion.svg 
                  width="220" height="220" viewBox="0 0 100 100" 
                  className="text-slate-950 drop-shadow-2xl"
                  animate={{ rotate: handState.steering * 45 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                >
                  {/* Main Wheel */}
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" />
                  <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
                  
                  {/* Spokes */}
                  <line x1="50" y1="10" x2="50" y2="40" stroke="currentColor" strokeWidth="8" />
                  <line x1="10" y1="50" x2="40" y2="50" stroke="currentColor" strokeWidth="8" />
                  <line x1="60" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="8" />

                  {/* Spinner Knob (2 o'clock) */}
                  <g 
                    transform="rotate(30, 50, 50)" 
                    className="cursor-help"
                    onMouseEnter={() => setShowKnobTooltip(true)}
                    onMouseLeave={() => setShowKnobTooltip(false)}
                  >
                    {/* Realistic Grip Design */}
                    <circle cx="50" cy="10" r="7" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
                    {/* Grip Texture Lines */}
                    <line x1="46" y1="8" x2="54" y2="8" stroke="#444" strokeWidth="0.5" />
                    <line x1="46" y1="10" x2="54" y2="10" stroke="#444" strokeWidth="0.5" />
                    <line x1="46" y1="12" x2="54" y2="12" stroke="#444" strokeWidth="0.5" />
                    
                    <circle cx="50" cy="10" r="2" fill="#333" />
                    
                    {/* Knob Label */}
                    <text x="58" y="12" fill="white" fontSize="4" fontWeight="bold" className="pointer-events-none">Steering Grip</text>
                    <text x="58" y="16" fill="white" fontSize="3" className="pointer-events-none opacity-80">Spinner Knob</text>
                  </g>

                  {/* Control Buttons */}
                  <g transform="translate(75, 25)">
                    <circle cx="0" cy="0" r="3" fill="#ff4444" /> {/* Horn */}
                    <circle cx="6" cy="0" r="2" fill="#44ff44" /> {/* Signal */}
                    <circle cx="3" cy="6" r="2" fill="#4444ff" /> {/* Lights */}
                  </g>
                </motion.svg>
              </div>

              {/* Push-Pull Lever Graphic */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-90">
                <div className="w-2 h-20 bg-slate-700 rounded-full relative shadow-inner">
                  <motion.div 
                    className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-[#2F6DF6] rounded-full shadow-lg border-2 border-white flex items-center justify-center"
                    animate={{ top: handState.throttle > 0 ? '0%' : handState.brake > 0 ? '100%' : '50%' }}
                  >
                    <div className="w-1 h-4 bg-white/30 rounded-full" />
                  </motion.div>
                </div>
                <div className="flex justify-between w-40 mt-3 text-[9px] font-bold uppercase tracking-tighter text-slate-900 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full shadow-sm">
                  <span className="flex items-center gap-1"><ChevronRight size={8} className="-rotate-90" /> Pull (Accel)</span>
                  <span className="flex items-center gap-1">Push (Brake) <ChevronRight size={8} className="rotate-90" /></span>
                </div>
              </div>

              {/* Gesture Feedback Overlay */}
              <AnimatePresence>
                {gestureFeedback && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#2F6DF6] text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg pointer-events-none"
                  >
                    {gestureFeedback}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Initial Control Instructions */}
              <AnimatePresence>
                {showInstructions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
                  >
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md text-center space-y-6">
                      <h2 className="text-2xl font-bold text-slate-900">Adaptive Driving Controls</h2>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-[#2F6DF6]">Left Hand</p>
                          <p className="text-sm text-slate-600">Hold the steering knob to steer</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-[#22B8A5]">Right Hand</p>
                          <p className="text-sm text-slate-600">Pull toward you → Accelerate</p>
                          <p className="text-sm text-slate-600">Push forward → Brake</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest animate-pulse">Starting in 3 seconds...</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Knob Tooltip */}
              <AnimatePresence>
                {showKnobTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-1/4 right-1/4 bg-slate-900 text-white px-3 py-2 rounded-xl text-[10px] font-bold shadow-2xl border border-white/20 z-50"
                  >
                    Place your left hand here to simulate steering.
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hand Detection Status */}
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white">
                <div className={`w-2 h-2 rounded-full ${handState.isPresent ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                Hand detected: {handState.isPresent ? 'YES' : 'NO'}
              </div>

              {cameraError && (
                <div className="absolute inset-0 bg-rose-500/80 flex items-center justify-center p-8 text-center">
                  <p className="text-white font-bold">{cameraError}</p>
                </div>
              )}

              {!handState.isPresent && isStarted && !cameraError && (
                <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center backdrop-blur-[2px]">
                  <div className="text-center">
                    <p className="bg-rose-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-2">Hand Not Detected</p>
                    <p className="text-rose-700 text-[10px] font-bold">Please place your hand in view</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] font-medium">
                <Camera size={12} />
                Live Hand Tracking
              </div>
            </div>
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <Info size={16} className="text-[#2F6DF6]" />
              <p>Position your hand in view to simulate the adaptive lever.</p>
            </div>
          </div>

          {/* AI Coach Chat */}
          <div className="bg-slate-900 rounded-3xl shadow-2xl flex flex-col h-[400px] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22B8A5] animate-pulse" />
                <span className="text-white text-xs font-bold uppercase tracking-widest">AI Coach Transcript</span>
              </div>
              <Mic size={16} className="text-white/40" />
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              <AnimatePresence initial={false}>
                {transcript.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/20 italic text-sm text-center px-8">
                    Start the session to begin receiving coaching guidance.
                  </div>
                ) : (
                  transcript.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-2xl text-sm ${msg.startsWith('AI:') ? 'bg-white/10 text-white self-start' : 'bg-[#2F6DF6] text-white self-end ml-8'}`}
                    >
                      {msg.replace(/^(AI:|You:)\s*/, '')}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            <div className="p-4 bg-white/5">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Ask your coach anything..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#2F6DF6] transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      sendMessage(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-xs">
        <p>© 2026 AdaptiveDrive AI — Built for Gemini Live Agent Challenge</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-slate-600 transition-colors">Documentation</a>
          <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-slate-600 transition-colors">Accessibility Statement</a>
        </div>
      </footer>
    </div>
  );
}
