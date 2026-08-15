import React, { useState, useEffect } from 'react';
import { MidiAction, MidiMapping } from '../types';
import { midiService } from '../services/midiService';
import { Zap, X, Radio, Activity, Check, Plus, Trash2, Sliders, Volume2 } from 'lucide-react';

interface MidiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_LABELS: Record<MidiAction, string> = {
  PLAY_PAUSE: 'Play / Pause Current Track',
  STOP: 'Stop Playback & Reset',
  NEXT_SONG: 'Next Song in Setlist',
  PREV_SONG: 'Previous Song in Setlist',
  NEXT_SECTION: 'Jump to Next Section',
  PREV_SECTION: 'Jump to Previous Section',
  TAP_TEMPO: 'Tap Tempo Sync',
  TRIGGER_EMERGENCY_REPEAT: 'Broadcast "REPEAT CHORUS"',
  TRIGGER_EMERGENCY_END: 'Broadcast "END ON 1"',
  TOGGLE_CLICK: 'Toggle In-Ear Click Mute',
};

export const MidiModal: React.FC<MidiModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState(midiService.getStatus());
  const [mappings, setMappings] = useState<MidiMapping[]>(midiService.getMappings());
  const [learningId, setLearningId] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<string>('No activity');
  const [testSent, setTestSent] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    midiService.init().then(() => {
      setStatus(midiService.getStatus());
    });

    const timer = setInterval(() => {
      const currentStatus = midiService.getStatus();
      setStatus(currentStatus);
      if (currentStatus.lastActivityDescription) {
        setLastActivity(currentStatus.lastActivityDescription);
      }
    }, 400);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartLearn = (mappingId: string) => {
    setLearningId(mappingId);
    midiService.startLearn((learned) => {
      midiService.updateMapping(mappingId, {
        type: learned.type,
        channel: learned.channel,
        number: learned.number,
      });
      setMappings(midiService.getMappings());
      setLearningId(null);
    });
  };

  const handleCancelLearn = () => {
    midiService.cancelLearn();
    setLearningId(null);
  };

  const handleAddMapping = () => {
    const newMapping: MidiMapping = {
      id: 'map_' + Date.now(),
      action: 'PLAY_PAUSE',
      label: 'New Foot Pedal Switch',
      type: 'note',
      channel: 0,
      number: 60,
    };
    midiService.addMapping(newMapping);
    setMappings(midiService.getMappings());
  };

  const handleRemoveMapping = (id: string) => {
    midiService.removeMapping(id);
    setMappings(midiService.getMappings());
  };

  const handleActionChange = (id: string, action: MidiAction) => {
    midiService.updateMapping(id, { action });
    setMappings(midiService.getMappings());
  };

  const handleSendTestPatch = () => {
    midiService.sendMidiTrigger({
      enabled: true,
      channel: 1,
      programChange: 14,
      description: 'Test Preset 14',
    });
    setTestSent('Sent Program Change #14 on Ch:1');
    setTimeout(() => setTestSent(null), 2500);
  };

  return (
    <div
      id="midi-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="midi-modal-content"
        className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Web MIDI & Foot Pedal Integration</h2>
              <p className="text-xs text-zinc-400">
                Map Bluetooth page-turners & send automated patch changes on section cues
              </p>
            </div>
          </div>
          <button
            id="btn-close-midi-modal"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Device & Activity Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Detected MIDI Hardware</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  status.isConnected && status.inputCount > 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-950 border border-zinc-800 text-zinc-400'
                }`}
              >
                {status.inputCount} Input(s) / {status.outputCount} Output(s)
              </span>
            </div>
            <div className="text-sm font-medium text-white">
              {status.inputs.length > 0 ? (
                status.inputs.map((inp, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-emerald-300">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{inp}</span>
                  </div>
                ))
              ) : (
                <span className="text-zinc-500 italic text-xs">No USB/Bluetooth MIDI pedal detected (Simulated mode active)</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Real-Time Input Activity</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"></span>
                <span className="text-[11px] font-mono text-zinc-400">Listening</span>
              </div>
            </div>
            <div className="text-xs font-mono text-orange-300 truncate bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800">
              {lastActivity}
            </div>
          </div>
        </div>

        {/* MIDI Pedal Mappings Table */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-400" />
              Pedal & Foot-Switch Actions
            </h3>
            <button
              id="btn-add-midi-mapping"
              onClick={handleAddMapping}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-white flex items-center gap-1.5 border border-zinc-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-orange-400" /> Add Mapping
            </button>
          </div>

          <div className="space-y-2.5">
            {mappings.map((m) => {
              const isLearningThis = learningId === m.id;

              return (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isLearningThis
                      ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/10'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {/* Action Selector */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Target Action</label>
                    <select
                      value={m.action}
                      onChange={(e) => handleActionChange(m.id, e.target.value as MidiAction)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs font-medium text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
                    >
                      {Object.entries(ACTION_LABELS).map(([act, label]) => (
                        <option key={act} value={act}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Trigger Binding info */}
                  <div className="flex items-center gap-2">
                    <div className="bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg text-center min-w-[140px]">
                      <span className="block text-[10px] text-zinc-500 uppercase font-mono">Bound Trigger</span>
                      <span className="font-mono text-xs font-bold text-orange-400">
                        {m.type.toUpperCase()} #{m.number} {m.channel === 0 ? '(Any Ch)' : `(Ch:${m.channel})`}
                      </span>
                    </div>

                    {/* Learn Button */}
                    {isLearningThis ? (
                      <button
                        onClick={handleCancelLearn}
                        className="px-4 py-2 rounded-lg bg-orange-500 text-black font-bold text-xs animate-pulse flex items-center gap-1.5 cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5 animate-spin" /> Press Pedal Now...
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartLearn(m.id)}
                        className="px-3.5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
                      >
                        Learn
                      </button>
                    )}

                    <button
                      onClick={() => handleRemoveMapping(m.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Automated Outbound Triggers Info & Test */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="font-bold text-white text-sm block">Automated Guitar / Synth Patch Triggers</span>
            <span className="text-xs text-zinc-400">
              BandSync sends Program Change & CC values to Kemper, Helix, Nord & DMX when sections change
            </span>
            {testSent && <span className="block text-xs font-mono text-emerald-400 mt-1">{testSent}</span>}
          </div>
          <button
            id="btn-send-test-midi-patch"
            onClick={handleSendTestPatch}
            className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-xs font-bold text-orange-400 border border-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" /> Test Outbound MIDI Trigger
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
          <button
            id="btn-save-midi-modal"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-md shadow-orange-500/20"
          >
            <Check className="w-4 h-4 stroke-[3]" /> Close & Save
          </button>
        </div>
      </div>
    </div>
  );
};
