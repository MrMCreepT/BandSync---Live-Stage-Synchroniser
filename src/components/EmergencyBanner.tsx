import React, { useEffect, useState } from 'react';
import { EmergencyEvent } from '../types';
import { AlertTriangle, X, Volume2, Radio } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { syncService } from '../services/syncService';

interface EmergencyBannerProps {
  currentCue: EmergencyEvent | null;
  onDismiss: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ currentCue, onDismiss }) => {
  const [secondsActive, setSecondsActive] = useState<number>(0);

  useEffect(() => {
    if (!currentCue) {
      setSecondsActive(0);
      return;
    }

    // Play loud attention chime & speech announcement locally
    audioEngine.playBeep(1200, 0.15, 0.9);
    setTimeout(() => audioEngine.playBeep(1800, 0.25, 1.0), 180);

    const spokenText = currentCue.customText || currentCue.label;
    audioEngine.speakCue(`STAGE CUE: ${spokenText}`, true);

    const timer = setInterval(() => {
      setSecondsActive((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentCue]);

  if (!currentCue) return null;

  const handleDismiss = () => {
    syncService.broadcastDismissCue(currentCue.id);
    onDismiss();
  };

  return (
    <div
      id="emergency-stage-banner"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
    >
      <div
        className="w-full max-w-4xl p-6 sm:p-10 rounded-2xl border-4 shadow-2xl flex flex-col items-center text-center relative overflow-hidden animate-pulse"
        style={{
          backgroundColor: '#0f0f13',
          borderColor: currentCue.color || '#ef4444',
          boxShadow: `0 0 80px ${currentCue.color || '#ef4444'}66`,
        }}
      >
        {/* Flashing Top Alert Pill */}
        <div
          className="px-6 py-2 rounded-full font-black tracking-widest text-sm uppercase flex items-center gap-2 mb-6"
          style={{ backgroundColor: currentCue.color || '#ef4444', color: '#000' }}
        >
          <Radio className="w-5 h-5 animate-spin" />
          <span>LIVE STAGE EMERGENCY BROADCAST</span>
          <span className="opacity-80">({secondsActive}s ago)</span>
        </div>

        {/* Huge Bold Stage Cue Headline */}
        <h1 className="text-4xl sm:text-7xl font-black tracking-tight text-white mb-4 leading-none uppercase">
          {currentCue.label}
        </h1>

        {currentCue.customText && (
          <p className="text-2xl sm:text-3xl text-amber-300 font-bold mb-6 bg-black/60 px-6 py-3 rounded-xl border border-amber-500/40">
            "{currentCue.customText}"
          </p>
        )}

        {/* Sender Attribution */}
        <div className="flex items-center gap-3 text-zinc-400 text-sm sm:text-base font-medium mb-8 bg-zinc-900/80 px-4 py-2 rounded-lg border border-zinc-800">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>
            Triggered by <strong className="text-white">{currentCue.senderName}</strong> ({currentCue.senderRole.toUpperCase()})
          </span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1 text-cyan-400">
            <Volume2 className="w-4 h-4" /> Synthesised in In-Ear Monitors
          </span>
        </div>

        {/* Big Acknowledge Button */}
        <button
          id="btn-acknowledge-emergency-cue"
          onClick={handleDismiss}
          className="w-full sm:w-auto px-12 py-5 rounded-xl font-black text-xl uppercase tracking-wider transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 cursor-pointer shadow-lg"
          style={{
            backgroundColor: currentCue.color || '#ef4444',
            color: '#000',
          }}
        >
          <X className="w-6 h-6 stroke-[3]" />
          ACKNOWLEDGE & DISMISS CUE
        </button>
      </div>
    </div>
  );
};
