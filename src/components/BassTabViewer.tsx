import React, { useState } from 'react';
import { SongSection } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Zap, Eye, ChevronRight, Hash, Volume2 } from 'lucide-react';

interface BassTabViewerProps {
  section: SongSection;
  songKey: string;
  songBpm: number;
  currentBar: number;
  currentBeat: number;
  beatsPerBar: number;
  isPlaying: boolean;
  textSize?: 'normal' | 'large' | 'giant';
}

export const BassTabViewer: React.FC<BassTabViewerProps> = ({
  section,
  songKey,
  songBpm,
  currentBar,
  currentBeat,
  beatsPerBar,
  isPlaying,
  textSize = 'large',
}) => {
  const [activeTabTab, setActiveTabTab] = useState<'tab' | 'notes' | 'both'>('both');
  const [fretboardMode, setFretboardMode] = useState<boolean>(false);

  // Extract Tab lines or fallback generated tab
  const rawTab = section.bassTab || '';
  const bassRoleNote = section.roleNotes?.bass || 'Standard root-fifth groove';

  // Parse lines of rawTab
  const lines = rawTab ? rawTab.split('\n').filter((l) => l.trim().length > 0) : [];

  return (
    <div className="bg-zinc-950/80 border border-cyan-950/60 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3 relative overflow-hidden backdrop-blur-md">
      {/* Decorative Neon Cyan Glow Bar for Bass */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-600 via-cyan-400 to-blue-600 shadow-[0_0_12px_#06b6d4]" />

      {/* Header with Role Badge, View Mode Switcher, and Song Key */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black text-xs shadow-inner">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
                Mart's Bass Rig
              </span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-[10px] font-mono text-cyan-300 border border-cyan-500/20">
                4-String EADG
              </span>
            </div>
            <div className="text-[11px] text-zinc-400">
              Key: <span className="font-bold text-white">{songKey}</span> • Chords: <span className="font-mono text-amber-300 font-bold">{section.chords || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Tactile Toggle Pills */}
        <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTabTab('both')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase transition-all active:scale-95 cursor-pointer ${
              activeTabTab === 'both'
                ? 'bg-cyan-500 text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Tab + Notes
          </button>
          <button
            onClick={() => setActiveTabTab('tab')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase transition-all active:scale-95 cursor-pointer ${
              activeTabTab === 'tab'
                ? 'bg-cyan-500 text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            TAB ONLY
          </button>
          <button
            onClick={() => setActiveTabTab('notes')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase transition-all active:scale-95 cursor-pointer ${
              activeTabTab === 'notes'
                ? 'bg-cyan-500 text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Notes Only
          </button>
        </div>
      </div>

      {/* Main Tablature Content Area */}
      <AnimatePresence mode="wait">
        {(activeTabTab === 'tab' || activeTabTab === 'both') && (
          <motion.div
            key="tab-content"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-2"
          >
            {rawTab ? (
              <div className="bg-black/90 border border-cyan-900/40 rounded-xl p-3 font-mono text-xs sm:text-sm overflow-x-auto shadow-inner select-text">
                <pre className="text-cyan-300 font-bold leading-relaxed whitespace-pre tracking-wide">
                  {rawTab}
                </pre>
              </div>
            ) : (
              <div className="bg-black/80 border border-zinc-800 rounded-xl p-3 font-mono text-xs space-y-1 text-zinc-400">
                <div className="text-cyan-400 font-bold mb-1">Standard 4-String Root Pattern:</div>
                <div className="text-cyan-200/90 leading-tight">
                  G|--------------------------------|--------------------------------|<br />
                  D|--------------------------------|--------------------------------|<br />
                  A|--[Root]------[5th]-----[8ve]---|--[Root]------[5th]-----[8ve]---|<br />
                  E|--------------------------------|--------------------------------|
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Performance Guidance & Chords */}
      {(activeTabTab === 'notes' || activeTabTab === 'both') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-zinc-900/80 border border-zinc-800/90 rounded-xl p-3 space-y-1.5 text-zinc-200"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              Mart's Execution Notes
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              Bar {currentBar} / {section.bars} • Beat {currentBeat}/{beatsPerBar}
            </span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-zinc-100 leading-snug">
            {bassRoleNote}
          </p>

          {section.lyrics && (
            <div className="mt-2 pt-2 border-t border-zinc-800/60 text-xs text-zinc-400 italic">
              <span className="text-zinc-300 not-italic font-bold">Vocal Cue: </span>
              "{section.lyrics.slice(0, 80)}{section.lyrics.length > 80 ? '...' : ''}"
            </div>
          )}
        </motion.div>
      )}

      {/* Live Rhythmic Beat Indicator Line for Mart */}
      {isPlaying && (
        <div className="flex items-center justify-between gap-1 pt-1">
          <div className="text-[10px] uppercase font-mono text-zinc-400">POCKET METER:</div>
          <div className="flex items-center gap-1.5 flex-1 max-w-xs">
            {Array.from({ length: beatsPerBar }).map((_, bIdx) => {
              const isCurrentBeat = currentBeat === bIdx + 1;
              return (
                <div
                  key={bIdx}
                  className={`h-2 flex-1 rounded-full transition-all duration-75 ${
                    isCurrentBeat
                      ? bIdx === 0
                        ? 'bg-white shadow-[0_0_10px_#ffffff] scale-y-125'
                        : 'bg-cyan-400 shadow-[0_0_8px_#06b6d4] scale-y-110'
                      : 'bg-zinc-800'
                  }`}
                />
              );
            })}
          </div>
          <div className="text-[10px] font-mono font-bold text-cyan-400">
            {songBpm} BPM
          </div>
        </div>
      )}
    </div>
  );
};
