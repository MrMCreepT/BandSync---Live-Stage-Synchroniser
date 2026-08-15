import React, { useState, useRef, useEffect } from 'react';
import { Song, SongSection, SectionType, InstrumentRole, MidiTrigger } from '../types';
import { ROLE_DEFINITIONS, SECTION_COLORS } from '../constants';
import { stageDb } from '../services/db';
import { syncService } from '../services/syncService';
import { AiSongImporterModal } from './AiSongImporterModal';
import {
  Upload,
  Play,
  Pause,
  Plus,
  Trash2,
  Sliders,
  Zap,
  Music,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Save,
  Volume2,
  Clock,
  Edit3,
} from 'lucide-react';

interface TrackEditorProps {
  song: Song;
  onSaveSong: (updatedSong: Song) => void;
  onBackToStage?: () => void;
}

export const TrackEditor: React.FC<TrackEditorProps> = ({ song, onSaveSong, onBackToStage }) => {
  const [currentSong, setCurrentSong] = useState<Song>(song);
  const [activeSectionId, setActiveSectionId] = useState<string>(song.sections[0]?.id || '');
  const [selectedRoleTab, setSelectedRoleTab] = useState<InstrumentRole>('drums');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [audioPlayheadSec, setAudioPlayheadSec] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [savedNotification, setSavedNotification] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStartTimeRef = useRef<number>(0);

  const activeSection = currentSong.sections.find((s) => s.id === activeSectionId) || currentSong.sections[0];

  useEffect(() => {
    setCurrentSong(song);
    setActiveSectionId(song.sections[0]?.id || '');
  }, [song]);

  // Render Waveform Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    if (audioBuffer) {
      // Draw Real Decoded Audio Waveform Peaks
      const rawData = audioBuffer.getChannelData(0);
      const step = Math.ceil(rawData.length / width);
      const amp = height / 2;

      ctx.fillStyle = '#f97316';
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = rawData[i * step + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
      }
    } else {
      // Render Synthesized Grid Waveform representation based on BPM and Sections
      const totalBars = currentSong.sections.reduce((sum, sec) => sum + sec.bars, 0);
      let curBar = 0;

      currentSong.sections.forEach((sec) => {
        const secStartPercent = curBar / totalBars;
        const secEndPercent = (curBar + sec.bars) / totalBars;
        const startX = secStartPercent * width;
        const blockW = (secEndPercent - secStartPercent) * width;

        // Draw Section Region Block
        ctx.fillStyle = `${sec.color}22`;
        ctx.fillRect(startX, 0, blockW, height);

        // Section Border
        ctx.strokeStyle = sec.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, 0, blockW, height);

        // Section Label
        ctx.fillStyle = sec.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${sec.name} (${sec.bars} bars)`, startX + 6, 20);

        // Draw Beat Grid lines
        const barWidth = blockW / sec.bars;
        for (let b = 0; b < sec.bars; b++) {
          const barX = startX + b * barWidth;
          ctx.strokeStyle = `${sec.color}44`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(barX, 0);
          ctx.lineTo(barX, height);
          ctx.stroke();
        }

        curBar += sec.bars;
      });
    }
  }, [audioBuffer, currentSong]);

  // Audio File Upload & Web Audio Decoding
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDecoding(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (!arrayBuffer) return;

      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtxClass();
        audioCtxRef.current = ctx;

        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decodedBuffer);

        // Auto-Estimate BPM from peaks
        estimateBpmFromBuffer(decodedBuffer);

        setCurrentSong((prev) => ({
          ...prev,
          audioFileName: file.name,
          audioDurationSec: Math.round(decodedBuffer.duration),
        }));
      } catch (err) {
        console.error('Failed to decode audio file:', err);
      } finally {
        setIsDecoding(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Peak Transient Energy BPM Estimator
  const estimateBpmFromBuffer = (buffer: AudioBuffer) => {
    try {
      const data = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      let peaks: number[] = [];
      const threshold = 0.65;

      for (let i = 0; i < Math.min(data.length, sampleRate * 30); i += 1000) {
        if (Math.abs(data[i]) > threshold) {
          peaks.push(i / sampleRate);
        }
      }

      if (peaks.length > 8) {
        let intervals: number[] = [];
        for (let i = 1; i < peaks.length; i++) {
          const diff = peaks[i] - peaks[i - 1];
          if (diff > 0.3 && diff < 1.2) {
            intervals.push(diff);
          }
        }
        if (intervals.length > 4) {
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const estimated = Math.round(60 / avgInterval);
          if (estimated >= 70 && estimated <= 200) {
            setCurrentSong((prev) => ({ ...prev, bpm: estimated }));
          }
        }
      }
    } catch (e) {}
  };

  // Tap Tempo
  const handleTapTempo = () => {
    const now = Date.now();
    const newTaps = [...tapTimes, now].slice(-5);
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < newTaps.length; i++) {
        diffs.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const computedBpm = Math.round(60000 / avgMs);
      if (computedBpm >= 40 && computedBpm <= 240) {
        setCurrentSong((prev) => ({ ...prev, bpm: computedBpm }));
      }
    }
  };

  // Section Manipulation
  const handleAddSection = () => {
    const newSec: SongSection = {
      id: 'sec_' + Date.now(),
      name: 'New Chorus',
      type: 'chorus',
      bars: 8,
      timeSignature: '4/4',
      color: SECTION_COLORS.chorus,
      roleNotes: {},
      chords: 'Em | G | C | D',
    };
    const updatedSections = [...currentSong.sections, newSec];
    setCurrentSong((prev) => ({ ...prev, sections: updatedSections }));
    setActiveSectionId(newSec.id);
  };

  const handleUpdateActiveSection = (updates: Partial<SongSection>) => {
    if (!activeSection) return;
    const updatedSections = currentSong.sections.map((s) =>
      s.id === activeSection.id ? { ...s, ...updates } : s
    );
    setCurrentSong((prev) => ({ ...prev, sections: updatedSections }));
  };

  const handleUpdateRoleNote = (role: InstrumentRole, text: string) => {
    if (!activeSection) return;
    const updatedRoleNotes = { ...(activeSection.roleNotes || {}), [role]: text };
    handleUpdateActiveSection({ roleNotes: updatedRoleNotes });
  };

  const handleDeleteSection = (id: string) => {
    if (currentSong.sections.length <= 1) return;
    const filtered = currentSong.sections.filter((s) => s.id !== id);
    setCurrentSong((prev) => ({ ...prev, sections: filtered }));
    setActiveSectionId(filtered[0]?.id || '');
  };

  const handleSaveTrack = () => {
    stageDb.saveSong(currentSong);
    syncService.broadcastTrackUpdate(currentSong);
    onSaveSong(currentSong);
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  return (
    <div id="track-editor-root" className="min-h-[calc(100vh-60px)] bg-[#050505] text-zinc-100 p-3 sm:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Save Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono text-xs border border-orange-500/30">
                WAVEFORM & STRUCTURE BUILDER
              </span>
              {savedNotification && (
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 animate-pulse">
                  Saved & Synced to Band!
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">{currentSong.title}</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-ai-analyze-track"
              onClick={() => setShowAiModal(true)}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-orange-500/50 text-orange-400 font-bold text-sm flex items-center gap-2 cursor-pointer transition-all shadow-md"
            >
              <Sparkles className="w-4 h-4 text-orange-400" /> AI Link / Song Analyzer
            </button>
            <button
              id="btn-save-track-editor"
              onClick={handleSaveTrack}
              className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-orange-500/20"
            >
              <Save className="w-4 h-4" /> Save & Push to Stage
            </button>
          </div>
        </div>

        {/* Global Track Metronome & Beat-Grid Inspector */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Track Title</label>
            <input
              type="text"
              value={currentSong.title}
              onChange={(e) => setCurrentSong((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-bold focus:border-orange-500 outline-none"
            />
          </div>

          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-400">Master BPM</label>
              <button
                onClick={handleTapTempo}
                className="px-2 py-0.5 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] font-bold border border-orange-500/30 cursor-pointer"
              >
                Tap Tempo
              </button>
            </div>
            <input
              type="number"
              min="40"
              max="260"
              value={currentSong.bpm}
              onChange={(e) => setCurrentSong((prev) => ({ ...prev, bpm: parseInt(e.target.value, 10) || 120 }))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-orange-400 font-mono font-bold focus:border-orange-500 outline-none"
            />
          </div>

          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Time Signature</label>
            <select
              value={currentSong.timeSignature}
              onChange={(e) => setCurrentSong((prev) => ({ ...prev, timeSignature: e.target.value as any }))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:border-orange-500 outline-none"
            >
              <option value="4/4">4/4 (Common Time)</option>
              <option value="3/4">3/4 (Waltz)</option>
              <option value="6/8">6/8 (Compound)</option>
              <option value="7/8">7/8 (Odd Metre)</option>
              <option value="5/4">5/4 (Take Five)</option>
              <option value="12/8">12/8 (Slow Blues)</option>
            </select>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Harmonic Key</label>
            <input
              type="text"
              value={currentSong.key}
              onChange={(e) => setCurrentSong((prev) => ({ ...prev, key: e.target.value }))}
              placeholder="e.g. E Minor / A Major"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-orange-300 font-bold focus:border-orange-500 outline-none"
            />
          </div>
        </div>

        {/* Audio Reference Uploader & Waveform Stage Canvas */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-400" />
              <h2 className="font-bold text-white text-base">Timeline Waveform & Beat-Grid Inspector</h2>
              {isDecoding && <span className="text-xs font-mono text-orange-400 animate-pulse">Decoding Audio...</span>}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                className="hidden"
              />
              <button
                id="btn-upload-guide-audio"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-orange-400" />
                {currentSong.audioFileName ? 'Change Guide Audio' : 'Upload Guide / Rehearsal Audio'}
              </button>
            </div>
          </div>

          {/* Canvas Waveform */}
          <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-[#050505]">
            <canvas
              ref={canvasRef}
              width={1000}
              height={140}
              className="w-full h-36 block cursor-pointer"
            />
          </div>

          {currentSong.audioFileName && (
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span>Attached Reference: <strong>{currentSong.audioFileName}</strong></span>
              <span>Duration: {currentSong.audioDurationSec}s</span>
            </div>
          )}
        </div>

        {/* Structural Sections Manager */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Section List (4 cols) */}
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">Song Sections</h3>
              <button
                id="btn-add-section"
                onClick={handleAddSection}
                className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-orange-400 flex items-center gap-1 border border-zinc-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>

            <div className="space-y-2">
              {currentSong.sections.map((sec, idx) => {
                const isActive = sec.id === activeSectionId;

                return (
                  <div
                    key={sec.id}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'bg-zinc-800 text-white shadow-md'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                    style={{ borderColor: isActive ? sec.color : undefined }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-zinc-500">#{idx + 1}</span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: sec.color }}
                      />
                      <div>
                        <span className="font-bold text-sm block text-white">{sec.name}</span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {sec.bars} bars • {sec.timeSignature}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(sec.id);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                      title="Delete section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Section Inspector & Role Notes Editor (8 cols) */}
          {activeSection && (
            <div className="lg:col-span-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
              {/* Section Header Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Section Name</label>
                  <input
                    type="text"
                    value={activeSection.name}
                    onChange={(e) => handleUpdateActiveSection({ name: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-bold focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Bar Count</label>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={activeSection.bars}
                    onChange={(e) => handleUpdateActiveSection({ bars: parseInt(e.target.value, 10) || 8 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Section Type & Color</label>
                  <select
                    value={activeSection.type}
                    onChange={(e) => {
                      const newType = e.target.value as SectionType;
                      handleUpdateActiveSection({
                        type: newType,
                        color: SECTION_COLORS[newType] || '#f97316',
                      });
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-bold focus:border-orange-500 outline-none"
                  >
                    <option value="intro">Intro (Orange/Blue)</option>
                    <option value="verse">Verse (Green)</option>
                    <option value="chorus">Chorus (Coral/Orange)</option>
                    <option value="bridge">Bridge (Purple)</option>
                    <option value="solo">Solo / Hero (Amber)</option>
                    <option value="breakdown">Breakdown / Pre (Cyan)</option>
                    <option value="outro">Outro (Slate)</option>
                    <option value="vamp">Vamp / Hold (Pink)</option>
                  </select>
                </div>
              </div>

              {/* Chords & Lyrics Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Chords Progression</label>
                  <input
                    type="text"
                    value={activeSection.chords || ''}
                    onChange={(e) => handleUpdateActiveSection({ chords: e.target.value })}
                    placeholder="e.g. Em | C | G | D"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-orange-400 font-mono font-bold focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Vocal Lyrics & Cues</label>
                  <input
                    type="text"
                    value={activeSection.lyrics || ''}
                    onChange={(e) => handleUpdateActiveSection({ lyrics: e.target.value })}
                    placeholder="e.g. Singing the first chorus lines..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-orange-200 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              {/* Per-Section Role Annotations Tabs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Role-Specific Performer Cues
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Notes entered here show on that member's stage HUD during this section
                  </span>
                </div>

                {/* Role Tabs */}
                <div className="flex flex-wrap gap-1.5 border-b border-zinc-800 pb-2">
                  {ROLE_DEFINITIONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRoleTab(r.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedRoleTab === r.id
                          ? 'bg-zinc-800 text-white border'
                          : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                      }`}
                      style={{ borderColor: selectedRoleTab === r.id ? r.defaultColor : 'transparent' }}
                    >
                      {r.shortLabel}
                    </button>
                  ))}
                </div>

                {/* Text Area for Selected Role */}
                <div>
                  <textarea
                    rows={4}
                    value={activeSection.roleNotes?.[selectedRoleTab] || ''}
                    onChange={(e) => handleUpdateRoleNote(selectedRoleTab, e.target.value)}
                    placeholder={`Enter performance cues, patch triggers, tuning, or dynamic instructions for ${
                      ROLE_DEFINITIONS.find((r) => r.id === selectedRoleTab)?.label
                    }...`}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white leading-relaxed focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
              </div>

              {/* Automated MIDI Program Change / CC on Section Trigger */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" />
                    <span className="font-bold text-white text-xs uppercase">
                      Automated MIDI Preset / DMX Trigger on Section Entry
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeSection.midiTrigger?.enabled || false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        handleUpdateActiveSection({
                          midiTrigger: {
                            enabled,
                            channel: activeSection.midiTrigger?.channel || 1,
                            programChange: activeSection.midiTrigger?.programChange || 0,
                            description: activeSection.midiTrigger?.description || '',
                          },
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {activeSection.midiTrigger?.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">MIDI Channel</label>
                      <input
                        type="number"
                        min="1"
                        max="16"
                        value={activeSection.midiTrigger.channel || 1}
                        onChange={(e) =>
                          handleUpdateActiveSection({
                            midiTrigger: {
                              ...activeSection.midiTrigger!,
                              channel: parseInt(e.target.value, 10) || 1,
                            },
                          })
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-orange-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">Program Change (Patch #)</label>
                      <input
                        type="number"
                        min="0"
                        max="127"
                        value={activeSection.midiTrigger.programChange ?? 0}
                        onChange={(e) =>
                          handleUpdateActiveSection({
                            midiTrigger: {
                              ...activeSection.midiTrigger!,
                              programChange: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-orange-400 font-mono font-bold focus:border-orange-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">Preset Description</label>
                      <input
                        type="text"
                        value={activeSection.midiTrigger.description || ''}
                        onChange={(e) =>
                          handleUpdateActiveSection({
                            midiTrigger: {
                              ...activeSection.midiTrigger!,
                              description: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. Lead Boost Kemper Patch"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:border-orange-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Importer Modal */}
      <AiSongImporterModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSongImported={(analyzed) => {
          setCurrentSong(analyzed);
          setActiveSectionId(analyzed.sections[0]?.id || '');
          onSaveSong(analyzed);
        }}
        currentSongToReplace={currentSong}
      />
    </div>
  );
};
