import React, { useState } from 'react';
import { AudioMixConfig } from '../types';
import { audioEngine } from '../services/audioEngine';
import { stageDb } from '../services/db';
import { X, Volume2, Headphones, Mic, Music, Play, Check } from 'lucide-react';

interface AudioMixModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AudioMixConfig;
  onConfigChange: (newConfig: AudioMixConfig) => void;
}

export const AudioMixModal: React.FC<AudioMixModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
}) => {
  const [localConfig, setLocalConfig] = useState<AudioMixConfig>(config);
  const [testPlaying, setTestPlaying] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleChange = (updates: Partial<AudioMixConfig>) => {
    const updated = { ...localConfig, ...updates };
    setLocalConfig(updated);
    audioEngine.updateConfig(updates);
    stageDb.saveAudioConfig(updated);
    onConfigChange(updated);
  };

  const handleTestClick = () => {
    audioEngine.initContext();
    audioEngine.playBeep(localConfig.downbeatFreq, 0.05, localConfig.clickVolume);
    setTimeout(() => {
      audioEngine.playBeep(localConfig.offbeatFreq, 0.04, localConfig.clickVolume * 0.7);
    }, 250);
  };

  const handleTestVoice = () => {
    setTestPlaying(true);
    audioEngine.speakCue('Chorus in two bars. One, two, three, four!', true);
    setTimeout(() => setTestPlaying(false), 2200);
  };

  return (
    <div
      id="audio-mix-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="audio-mix-modal-content"
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Performer In-Ear Audio Mix</h2>
              <p className="text-xs text-zinc-400">Customise synthesised click frequencies & vocal cue lead-ins</p>
            </div>
          </div>
          <button
            id="btn-close-audio-mix"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Metronome Click Engine */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-white">Synthesised Metronome Click</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  id="btn-test-click"
                  onClick={handleTestClick}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-amber-300 flex items-center gap-1.5 border border-amber-500/30 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" /> Test Click
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.clickEnabled}
                    onChange={(e) => handleChange({ clickEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
            </div>

            {localConfig.clickEnabled && (
              <div className="space-y-4 pt-2">
                {/* Volume Slider */}
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                    <span>Click Volume</span>
                    <span className="font-mono text-amber-400">{Math.round(localConfig.clickVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={localConfig.clickVolume}
                    onChange={(e) => handleChange({ clickVolume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>

                {/* Subdivisions */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Click Subdivisions</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: '1/4', label: 'Quarter (1/4)' },
                      { id: '1/8', label: 'Eighth (1/8)' },
                      { id: '1/16', label: 'Sixteenth (1/16)' },
                      { id: 'triplet', label: 'Triplets (1/8T)' },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handleChange({ clickSubdivision: sub.id as any })}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          localConfig.clickSubdivision === sub.id
                            ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pitch Frequencies */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                      <span>Downbeat (Beat 1) Pitch</span>
                      <span className="font-mono text-amber-400">{localConfig.downbeatFreq} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="800"
                      max="2400"
                      step="50"
                      value={localConfig.downbeatFreq}
                      onChange={(e) => handleChange({ downbeatFreq: parseInt(e.target.value, 10) })}
                      className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                      <span>Offbeat (Beats 2,3,4) Pitch</span>
                      <span className="font-mono text-amber-400">{localConfig.offbeatFreq} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="1600"
                      step="50"
                      value={localConfig.offbeatFreq}
                      onChange={(e) => handleChange({ offbeatFreq: parseInt(e.target.value, 10) })}
                      className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                </div>

                {/* Stereo IEM Pan */}
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                    <span>Stereo Earphone Pan (Left = IEM / Right = Guide)</span>
                    <span className="font-mono text-orange-400">
                      {localConfig.clickPan === 0 ? 'Center' : localConfig.clickPan < 0 ? `L ${Math.abs(Math.round(localConfig.clickPan * 100))}%` : `R ${Math.round(localConfig.clickPan * 100)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={localConfig.clickPan}
                    onChange={(e) => handleChange({ clickPan: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                    <span>Left Ear (IEM Split)</span>
                    <span>Center (Stereo)</span>
                    <span>Right Ear</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Voice Guide Cues (Web Speech API) */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-orange-400" />
                <span className="font-bold text-white">Synthesised Vocal Section Cues</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  id="btn-test-voice"
                  onClick={handleTestVoice}
                  disabled={testPlaying}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-orange-300 flex items-center gap-1.5 border border-orange-500/30 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" /> Test Voice Cue
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.vocalCuesEnabled}
                    onChange={(e) => handleChange({ vocalCuesEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
            </div>

            {localConfig.vocalCuesEnabled && (
              <div className="space-y-4 pt-2">
                {/* Voice Volume */}
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                    <span>Voice Volume</span>
                    <span className="font-mono text-orange-400">{Math.round(localConfig.vocalCuesVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={localConfig.vocalCuesVolume}
                    onChange={(e) => handleChange({ vocalCuesVolume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>

                {/* Lead-in Warning Bars */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Announcement Lead-In Time</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { bars: 1, label: '1 Bar Ahead' },
                      { bars: 2, label: '2 Bars Ahead (Standard)' },
                      { bars: 4, label: '4 Bars Ahead (Extended)' },
                    ].map((opt) => (
                      <button
                        key={opt.bars}
                        onClick={() => handleChange({ voiceLeadInBars: opt.bars as any })}
                        className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          localConfig.voiceLeadInBars === opt.bars
                            ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Count-In Options */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Pre-Song Count-In Tone</span>
              <span className="text-xs text-zinc-400">Play distinctive double-chirp count-in before track start</span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={localConfig.countInBars}
                onChange={(e) => handleChange({ countInBars: parseInt(e.target.value, 10) as any })}
                className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg px-2.5 py-1.5 focus:border-orange-500 outline-none"
              >
                <option value={1}>1 Bar (4 beats)</option>
                <option value={2}>2 Bars (8 beats)</option>
              </select>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConfig.countInEnabled}
                  onChange={(e) => handleChange({ countInEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
          <button
            id="btn-save-audio-mix"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-md shadow-orange-500/20"
          >
            <Check className="w-4 h-4 stroke-[3]" /> Done
          </button>
        </div>
      </div>
    </div>
  );
};
