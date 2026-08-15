import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Song, SongSection } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, ListMusic, Eye, Zap, Sparkles, Music, ChevronRight, Volume2, Type } from 'lucide-react';

interface VocalLyricsViewerProps {
  song: Song | null;
  sections: SongSection[];
  currentSectionIndex: number;
  currentBar: number;
  currentBeat: number;
  beatsPerBar: number;
  isPlaying: boolean;
  onSeekSection?: (sectionIndex: number) => void;
  textSize?: 'normal' | 'large' | 'giant';
  isCompact?: boolean;
}

export const VocalLyricsViewer: React.FC<VocalLyricsViewerProps> = ({
  song,
  sections = [],
  currentSectionIndex = 0,
  currentBar = 1,
  currentBeat = 1,
  beatsPerBar = 4,
  isPlaying = false,
  onSeekSection,
  textSize = 'large',
  isCompact = false,
}) => {
  const [viewMode, setViewMode] = useState<'section_focus' | 'full_song'>(isCompact ? 'section_focus' : 'full_song');
  const [showChords, setShowChords] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const safeSections = sections || [];
  const activeSection = safeSections[currentSectionIndex] || safeSections[0] || null;
  const totalBars = activeSection?.bars || 4;

  // Calculate normalized progress within the active section (0.0 to 1.0)
  const sectionProgress = useMemo(() => {
    if (!totalBars || totalBars <= 0) return 0;
    const completedBars = Math.max(0, currentBar - 1);
    const completedBeats = Math.max(0, currentBeat - 1) / Math.max(1, beatsPerBar);
    const rawProgress = (completedBars + completedBeats) / totalBars;
    return Math.min(1, Math.max(0, rawProgress));
  }, [currentBar, currentBeat, totalBars, beatsPerBar]);

  // Split section lyrics into lines
  const activeLines = useMemo(() => {
    if (!activeSection?.lyrics) return [];
    return activeSection.lyrics
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [activeSection?.lyrics]);

  // Determine active line index within the section
  const activeLineIndex = useMemo(() => {
    if (activeLines.length === 0) return 0;
    const idx = Math.floor(sectionProgress * activeLines.length);
    return Math.min(activeLines.length - 1, Math.max(0, idx));
  }, [sectionProgress, activeLines.length]);

  // Progress within the active line (0.0 to 1.0)
  const lineProgress = useMemo(() => {
    if (activeLines.length === 0) return 0;
    const lineSpan = 1 / activeLines.length;
    const progressInSpan = (sectionProgress - activeLineIndex * lineSpan) / lineSpan;
    return Math.min(1, Math.max(0, progressInSpan));
  }, [sectionProgress, activeLineIndex, activeLines.length]);

  // Auto-scroll to active section/line when section changes or when playing
  useEffect(() => {
    if (autoScroll && activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentSectionIndex, activeLineIndex, autoScroll]);

  // Font sizing styles
  const fontSizes = {
    normal: {
      lyrics: isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base',
      activeLyrics: isCompact ? 'text-sm sm:text-base font-bold' : 'text-base sm:text-lg font-bold',
      chords: 'text-xs',
    },
    large: {
      lyrics: isCompact ? 'text-sm sm:text-base' : 'text-base sm:text-lg',
      activeLyrics: isCompact ? 'text-base sm:text-lg font-black' : 'text-lg sm:text-xl font-black',
      chords: 'text-sm',
    },
    giant: {
      lyrics: isCompact ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl',
      activeLyrics: isCompact ? 'text-lg sm:text-xl font-black' : 'text-xl sm:text-3xl font-black',
      chords: 'text-base',
    },
  }[textSize];

  return (
    <div className={`bg-zinc-950/90 border border-pink-950/60 rounded-2xl shadow-xl space-y-2 relative overflow-hidden backdrop-blur-md flex flex-col ${
      isCompact ? 'p-2.5 sm:p-3 max-h-[320px]' : 'p-3.5 sm:p-4 min-h-[280px]'
    }`}>
      {/* Radiant Stage Glow for Rosie & Vocals */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 shadow-[0_0_15px_#ec4899]" />

      {/* Control Header: Teleprompter Switcher & Mode Toggles */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap pb-1.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shadow-inner shrink-0">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-pink-400 truncate">
                Rosie's Teleprompter
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 truncate">
              {song?.title || 'Song'} • Key: <span className="font-bold text-white">{song?.key || 'E min'}</span>
            </div>
          </div>
        </div>

        {/* View Mode & Utility Toggles */}
        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-0.5 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setViewMode('section_focus')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                viewMode === 'section_focus'
                  ? 'bg-pink-500 text-black font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setViewMode('full_song')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                viewMode === 'full_song'
                  ? 'bg-pink-500 text-black font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Full Song
            </button>
          </div>

          <button
            onClick={() => setShowChords(!showChords)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition-all cursor-pointer ${
              showChords
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
            title="Toggle Chords"
          >
            Chords
          </button>
        </div>
      </div>

      {/* Harmonic Chords Banner */}
      {showChords && activeSection?.chords && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-2.5 py-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase shrink-0">Chords:</span>
          <span className="font-mono font-bold text-amber-300 truncate text-xs sm:text-sm">
            {activeSection.chords}
          </span>
          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
            Bar {currentBar}/{totalBars}
          </span>
        </div>
      )}

      {/* Main Lyrics Display Area with Highlight Animation */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto pr-1 space-y-3 select-text scroll-smooth ${
          isCompact ? 'max-h-[220px]' : 'max-h-[380px]'
        }`}
      >
        {viewMode === 'full_song' ? (
          /* ================================================================= */
          /* FULL SONG VIEW WITH ALL SECTIONS & ACTIVE LINE ANIMATED SWEEP    */
          /* ================================================================= */
          <div className="space-y-2.5 py-1">
            {safeSections.map((sec, secIdx) => {
              const isCurrentSec = secIdx === currentSectionIndex;
              const lines = sec.lyrics
                ? sec.lyrics.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
                : [];

              return (
                <div
                  key={sec.id || secIdx}
                  onClick={() => onSeekSection && onSeekSection(secIdx)}
                  className={`rounded-xl p-2.5 transition-all duration-150 cursor-pointer border ${
                    isCurrentSec
                      ? 'bg-pink-950/30 border-pink-500/60 shadow-[0_0_15px_rgba(236,72,153,0.15)] ring-1 ring-pink-500/30'
                      : 'bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-900 opacity-60 hover:opacity-100'
                  }`}
                >
                  {/* Section Label */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: sec.color || '#ec4899' }}
                      />
                      <span
                        className="text-[11px] font-black uppercase tracking-wider"
                        style={{ color: isCurrentSec ? '#f472b6' : sec.color || '#ffffff' }}
                      >
                        {sec.name} ({sec.bars} bars)
                      </span>
                    </div>

                    {showChords && sec.chords && (
                      <span className="font-mono text-[11px] text-amber-300 font-bold">
                        {sec.chords}
                      </span>
                    )}
                  </div>

                  {/* Section Lines */}
                  {lines.length > 0 ? (
                    <div className="space-y-1.5">
                      {lines.map((line, lIdx) => {
                        const isThisLineActive = isCurrentSec && lIdx === activeLineIndex;

                        return (
                          <div
                            key={lIdx}
                            ref={isThisLineActive ? activeLineRef : null}
                            className={`p-1.5 rounded-lg transition-all duration-150 relative overflow-hidden ${
                              isThisLineActive
                                ? 'bg-pink-500/15 border border-pink-500/40 shadow-inner'
                                : 'text-zinc-300 hover:text-white'
                            }`}
                          >
                            {/* Animated Word & Line Highlight Pacing for Active Line */}
                            {isThisLineActive ? (
                              <div className="relative">
                                {/* Subtle glowing underline sweep */}
                                <div
                                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-500 via-rose-400 to-amber-300 transition-all duration-100"
                                  style={{ width: `${lineProgress * 100}%` }}
                                />

                                {/* Word-by-word faint highlighting */}
                                <div className={`${fontSizes.activeLyrics} text-white leading-relaxed flex flex-wrap gap-x-1.5 gap-y-0.5`}>
                                  {line.split(' ').map((word, wIdx, wordsArr) => {
                                    const wordProgress = wIdx / Math.max(1, wordsArr.length);
                                    const isCurrentWord = lineProgress >= wordProgress && lineProgress < (wIdx + 1) / wordsArr.length;
                                    const isPastWord = lineProgress >= (wIdx + 1) / wordsArr.length;

                                    return (
                                      <span
                                        key={wIdx}
                                        className={`transition-all duration-100 ${
                                          isCurrentWord
                                            ? 'text-pink-300 scale-105 font-black drop-shadow-[0_0_8px_#ec4899]'
                                            : isPastWord
                                            ? 'text-zinc-200'
                                            : 'text-zinc-400/80'
                                        }`}
                                      >
                                        {word}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className={`${fontSizes.lyrics} leading-relaxed`}>
                                {line}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-500 italic py-0.5">
                      (Instrumental / Solo)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ================================================================= */
          /* SECTION FOCUS VIEW (BIG TELEPROMPTER)                             */
          /* ================================================================= */
          <div className="space-y-2 py-1 flex flex-col justify-center min-h-[140px]">
            {activeLines.length > 0 ? (
              activeLines.map((line, lIdx) => {
                const isThisLineActive = lIdx === activeLineIndex;

                return (
                  <div
                    key={lIdx}
                    ref={isThisLineActive ? activeLineRef : null}
                    className={`p-2.5 rounded-xl transition-all relative overflow-hidden border ${
                      isThisLineActive
                        ? 'bg-pink-950/40 border-pink-500/60 shadow-[0_0_20px_rgba(236,72,153,0.2)]'
                        : 'bg-zinc-900/30 border-transparent text-zinc-400 opacity-70'
                    }`}
                  >
                    {/* Animated horizontal sweep indicator */}
                    {isThisLineActive && (
                      <div
                        className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 transition-all duration-100"
                        style={{ width: `${lineProgress * 100}%` }}
                      />
                    )}

                    <div className={`${isThisLineActive ? fontSizes.activeLyrics : fontSizes.lyrics} leading-relaxed flex flex-wrap gap-x-1.5 gap-y-0.5`}>
                      {isThisLineActive ? (
                        line.split(' ').map((word, wIdx, wordsArr) => {
                          const wordProgress = wIdx / Math.max(1, wordsArr.length);
                          const isCurrentWord = lineProgress >= wordProgress && lineProgress < (wIdx + 1) / wordsArr.length;
                          const isPastWord = lineProgress >= (wIdx + 1) / wordsArr.length;

                          return (
                            <span
                              key={wIdx}
                              className={`transition-all duration-100 ${
                                isCurrentWord
                                  ? 'text-pink-300 font-black scale-105 drop-shadow-[0_0_8px_#ec4899]'
                                  : isPastWord
                                  ? 'text-white'
                                  : 'text-zinc-400/80'
                              }`}
                            >
                              {word}
                            </span>
                          );
                        })
                      ) : (
                        <span>{line}</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-zinc-400 space-y-1 border border-zinc-800 rounded-xl bg-zinc-900/30">
                <Music className="w-6 h-6 text-pink-400 mx-auto animate-pulse" />
                <div className="font-bold text-white text-xs sm:text-sm">Instrumental Section</div>
                <p className="text-[11px] text-zinc-400">
                  {activeSection?.roleNotes?.lead_vocals || 'No lyrics. Rosie interacts with audience.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Live Vocal Status Bar */}
      <div className="pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 flex-wrap gap-1">
        <div className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-pink-400" />
          <span className="font-bold text-zinc-300">{activeSection?.name || 'Section'}</span>
        </div>

        <div className="font-mono text-[10px] text-pink-400 font-bold">
          {Math.round(sectionProgress * 100)}% Complete
        </div>
      </div>
    </div>
  );
};

