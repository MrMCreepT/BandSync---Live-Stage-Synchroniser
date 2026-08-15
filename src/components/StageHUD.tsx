import React, { useState, useEffect, useRef } from 'react';
import { Song, SongSection, InstrumentRole, Setlist, EmergencyCueType } from '../types';
import { ROLE_DEFINITIONS, EMERGENCY_CUES } from '../constants';
import { audioEngine, BeatTickEvent } from '../services/audioEngine';
import { syncService } from '../services/syncService';
import { midiService } from '../services/midiService';
import { stageDb } from '../services/db';
import { computeLiveTiming, formatTimeDisplay, calculateSongDurationSec } from '../services/stageTimeService';
import { BassTabViewer } from './BassTabViewer';
import { VocalLyricsViewer } from './VocalLyricsViewer';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  AlertTriangle,
  Zap,
  Clock,
  Music,
  Eye,
  CheckCircle2,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Send,
  Lock,
  Unlock,
  Smartphone,
  LayoutDashboard,
  FileText,
  Type,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  RotateCw,
  Search,
  ListMusic,
  Hourglass,
  Activity,
} from 'lucide-react';

interface StageHUDProps {
  currentSong: Song | null;
  activeSetlist: Setlist;
  currentSongIndex: number;
  onSelectSongIndex: (index: number) => void;
  currentRole: InstrumentRole;
  onChangeRole: (role: InstrumentRole) => void;
  isMaster: boolean;
  onOpenAudioMix: () => void;
  onOpenMidiModal: () => void;
}

export const StageHUD: React.FC<StageHUDProps> = ({
  currentSong,
  activeSetlist,
  currentSongIndex,
  onSelectSongIndex,
  currentRole,
  onChangeRole,
  isMaster,
  onOpenAudioMix,
  onOpenMidiModal,
}) => {
  // View Modes: standard = full dashboard, mic_stand = glanceable stage HUD, teleprompter = full chords/lyrics
  const [viewMode, setViewMode] = useState<'standard' | 'mic_stand' | 'teleprompter'>('standard');
  const [textSize, setTextSize] = useState<'normal' | 'large' | 'giant'>('large');

  // Mobile Orientation Mode: 'auto' (detect from screen), 'portrait' (vertical force), 'landscape' (horizontal force)
  const [orientationOverride, setOrientationOverride] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [isScreenLandscape, setIsScreenLandscape] = useState<boolean>(false);

  // Live Playback Engine State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCountIn, setIsCountIn] = useState<boolean>(false);
  const [countInBeat, setCountInBeat] = useState<number>(4);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [currentBar, setCurrentBar] = useState<number>(1);
  const [totalBarsInSection, setTotalBarsInSection] = useState<number>(8);
  const [currentBeat, setCurrentBeat] = useState<number>(1);
  const [beatsPerBar, setBeatsPerBar] = useState<number>(4);
  const [currentBpm, setCurrentBpm] = useState<number>(currentSong?.bpm || 120);
  const [barsRemaining, setBarsRemaining] = useState<number>(8);
  const [flashBeat, setFlashBeat] = useState<boolean>(false);
  const [downbeatFlash, setDownbeatFlash] = useState<boolean>(false);
  const [stageLocked, setStageLocked] = useState<boolean>(false);

  // Quick Setlist Drawer & Search
  const [showSetlistDrawer, setShowSetlistDrawer] = useState<boolean>(false);
  const [searchSongQuery, setSearchSongQuery] = useState<string>('');
  const [drawerSetFilter, setDrawerSetFilter] = useState<'ALL' | 'Set 1' | 'Set 2' | 'Encore'>('ALL');

  // Custom Emergency Cue input
  const [customCueText, setCustomCueText] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [showQuickCueDrawer, setShowQuickCueDrawer] = useState<boolean>(false);

  // Quick audio toggle
  const [clickActive, setClickActive] = useState<boolean>(audioEngine.getConfig().clickEnabled);
  const [voiceActive, setVoiceActive] = useState<boolean>(audioEngine.getConfig().vocalCuesEnabled);

  // Touch swipe gesture refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const teleprompterRef = useRef<HTMLDivElement | null>(null);

  const sections = currentSong?.sections || [];
  const activeSection = sections[currentSectionIndex] || sections[0];
  const nextSection = sections[currentSectionIndex + 1];
  const currentRoleDef = ROLE_DEFINITIONS.find((r) => r.id === currentRole) || ROLE_DEFINITIONS[0];

  // Screen size & orientation detection
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const isLand = window.innerWidth > window.innerHeight && window.innerHeight < 650;
        setIsScreenLandscape(isLand);
        if (window.innerWidth < 768 && viewMode === 'standard') {
          setViewMode('mic_stand');
        }
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [viewMode]);

  // Compute effective orientation
  const isLandscape = orientationOverride === 'landscape' ? true : orientationOverride === 'portrait' ? false : isScreenLandscape;

  // Auto-scroll teleprompter to active section
  useEffect(() => {
    if (viewMode === 'teleprompter' && teleprompterRef.current) {
      const activeEl = document.getElementById(`teleprompter-section-${currentSectionIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSectionIndex, viewMode]);

  // Subscribe to Web Audio Engine beat ticks and section changes
  useEffect(() => {
    const unsubBeat = audioEngine.onBeat((tick: BeatTickEvent) => {
      setIsPlaying(true);
      setIsCountIn(tick.isCountIn);
      setCountInBeat(tick.countInRemaining);
      setCurrentSectionIndex(tick.sectionIndex);
      setCurrentBar(tick.barIndex);
      setTotalBarsInSection(tick.totalBarsInSection);
      setCurrentBeat(tick.beatIndex);
      setBeatsPerBar(tick.beatsPerBar);
      setCurrentBpm(tick.bpm);
      setBarsRemaining(tick.barsRemainingInSection);

      // Trigger high-contrast visual beat flash
      setFlashBeat(true);
      if (tick.isDownbeat) {
        setDownbeatFlash(true);
      }
      setTimeout(() => {
        setFlashBeat(false);
        setDownbeatFlash(false);
      }, 140);
    });

    const unsubSection = audioEngine.onSectionChange((sec, idx) => {
      setCurrentSectionIndex(idx);
      setCurrentBar(1);
      setCurrentBeat(1);

      // Trigger automated MIDI patch change if configured
      if (sec.midiTrigger && sec.midiTrigger.enabled) {
        midiService.sendMidiTrigger(sec.midiTrigger);
      }
    });

    const setlistItems = activeSetlist?.items || [];
    const unsubEnd = audioEngine.onPlaybackEnded(() => {
      setIsPlaying(false);
      setIsCountIn(false);
      // Auto-advance to next song in setlist if available
      if (currentSongIndex < setlistItems.length - 1) {
        onSelectSongIndex(currentSongIndex + 1);
      }
    });

    // Web MIDI action receiver
    const unsubMidi = midiService.onAction((action) => {
      switch (action) {
        case 'PLAY_PAUSE':
          handlePlayPause();
          break;
        case 'STOP':
          handleStop();
          break;
        case 'NEXT_SONG':
          handleNextSong();
          break;
        case 'PREV_SONG':
          handlePrevSong();
          break;
        case 'NEXT_SECTION':
          if (currentSectionIndex < sections.length - 1) {
            handleSeekSection(currentSectionIndex + 1);
          }
          break;
        case 'PREV_SECTION':
          if (currentSectionIndex > 0) {
            handleSeekSection(currentSectionIndex - 1);
          }
          break;
        case 'TRIGGER_EMERGENCY_REPEAT':
          handleTriggerCue('REPEAT_CHORUS', 'REPEAT CHORUS', '#ef4444');
          break;
        case 'TRIGGER_EMERGENCY_END':
          handleTriggerCue('END_ON_1', 'END ON 1', '#dc2626');
          break;
        case 'TOGGLE_CLICK':
          toggleClick();
          break;
        default:
          break;
      }
    });

    return () => {
      unsubBeat();
      unsubSection();
      unsubEnd();
      unsubMidi();
    };
  }, [currentSong, currentSongIndex, currentSectionIndex, sections, activeSetlist, isPlaying]);

  // Sync listener from LAN WebSocket bridge
  useEffect(() => {
    const unsubSync = syncService.onSyncEvent((event) => {
      if (event.type === 'SCHEDULED_PLAY') {
        if (currentSong && event.songId === currentSong.id) {
          audioEngine.startSong(
            currentSong,
            event.sectionIndex || 0,
            event.startBar || 1,
            event.targetTimestamp
          );
          setIsPlaying(true);
        }
      } else if (event.type === 'PAUSE_PLAYBACK') {
        audioEngine.pausePlayback();
        setIsPlaying(false);
      } else if (event.type === 'STOP_PLAYBACK') {
        audioEngine.stopPlayback();
        setIsPlaying(false);
        setCurrentBar(1);
        setCurrentBeat(1);
      } else if (event.type === 'SEEK_SECTION') {
        audioEngine.seekSection(event.sectionIndex);
      } else if (event.type === 'CHANGE_SONG') {
        if (event.setlistIndex !== undefined && event.setlistIndex !== currentSongIndex) {
          onSelectSongIndex(event.setlistIndex);
        }
      }
    });

    return () => unsubSync();
  }, [currentSong, currentSongIndex]);

  const handlePlayPause = () => {
    if (!currentSong) return;
    audioEngine.initContext();

    if (isPlaying) {
      if (isMaster) {
        syncService.broadcastPause(currentSong.id);
      }
      audioEngine.pausePlayback();
      setIsPlaying(false);
    } else {
      if (isMaster) {
        syncService.broadcastPlay(currentSong.id, currentSectionIndex, currentBar, currentBpm);
      }
      audioEngine.startSong(currentSong, currentSectionIndex, currentBar);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    if (!currentSong) return;
    if (isMaster) {
      syncService.broadcastStop(currentSong.id);
    }
    audioEngine.stopPlayback();
    setIsPlaying(false);
    setCurrentSectionIndex(0);
    setCurrentBar(1);
    setCurrentBeat(1);
  };

  const handleSeekSection = (index: number) => {
    if (!currentSong) return;
    if (isMaster) {
      syncService.broadcastSeek(currentSong.id, index);
    }
    audioEngine.seekSection(index);
    setCurrentSectionIndex(index);
    setCurrentBar(1);
    setCurrentBeat(1);
  };

  const setlistItems = activeSetlist?.items || [];
  const allDatabaseSongs = stageDb.getSongs();

  const handleNextSong = () => {
    if (currentSongIndex < setlistItems.length - 1) {
      const nextIdx = currentSongIndex + 1;
      onSelectSongIndex(nextIdx);
      if (isMaster && setlistItems[nextIdx]) {
        const nextSongId = setlistItems[nextIdx].songId;
        syncService.broadcastChangeSong(nextSongId, nextIdx);
      }
    }
  };

  const handlePrevSong = () => {
    if (currentSongIndex > 0) {
      const prevIdx = currentSongIndex - 1;
      onSelectSongIndex(prevIdx);
      if (isMaster && setlistItems[prevIdx]) {
        const prevSongId = setlistItems[prevIdx].songId;
        syncService.broadcastChangeSong(prevSongId, prevIdx);
      }
    }
  };

  // Touch gesture swipe handling for mobile screens
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe threshold > 50px with minimal vertical angle
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 60) {
      if (deltaX < 0) {
        // Swiped Left -> Next Section or Next Song
        if (currentSectionIndex < sections.length - 1) {
          handleSeekSection(currentSectionIndex + 1);
        } else {
          handleNextSong();
        }
      } else {
        // Swiped Right -> Prev Section or Prev Song
        if (currentSectionIndex > 0) {
          handleSeekSection(currentSectionIndex - 1);
        } else {
          handlePrevSong();
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleTriggerCue = (type: EmergencyCueType, label: string, color: string, custom?: string) => {
    syncService.broadcastEmergencyCue(type, label, color, custom);
    setShowQuickCueDrawer(false);
  };

  const handleSendCustomCue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCueText.trim()) return;
    handleTriggerCue('CUSTOM', customCueText.toUpperCase(), '#f59e0b', customCueText);
    setCustomCueText('');
    setShowCustomInput(false);
  };

  const toggleClick = () => {
    const nextVal = !clickActive;
    setClickActive(nextVal);
    audioEngine.updateConfig({ clickEnabled: nextVal });
  };

  const toggleVoice = () => {
    const nextVal = !voiceActive;
    setVoiceActive(nextVal);
    audioEngine.updateConfig({ vocalCuesEnabled: nextVal });
  };

  // Section progress calculation
  const sectionProgressPercent = totalBarsInSection > 0 ? ((currentBar - 1 + currentBeat / beatsPerBar) / totalBarsInSection) * 100 : 0;
  const isCountdownWarning = barsRemaining <= (audioEngine.getConfig().voiceLeadInBars || 2) && isPlaying && !isCountIn;

  // Role notes text
  const roleNoteText = activeSection?.roleNotes?.[currentRole] || activeSection?.lyrics || activeSection?.chords || 'No specific notes for this role.';

  // Text size classes
  const textSizeClasses = {
    normal: {
      chords: 'text-base sm:text-xl',
      notes: 'text-xs sm:text-base',
      bars: 'text-3xl sm:text-6xl',
      section: 'text-2xl sm:text-5xl',
    },
    large: {
      chords: 'text-xl sm:text-3xl font-extrabold',
      notes: 'text-sm sm:text-xl font-bold',
      bars: 'text-4xl sm:text-7xl',
      section: 'text-3xl sm:text-6xl',
    },
    giant: {
      chords: 'text-2xl sm:text-5xl font-black',
      notes: 'text-base sm:text-3xl font-extrabold',
      bars: 'text-5xl sm:text-8xl',
      section: 'text-4xl sm:text-7xl',
    },
  }[textSize];

  // Current Set Group calculation
  const currentSetlistItem = setlistItems[currentSongIndex];
  const currentSetGroup = currentSetlistItem?.setGroup || (currentSongIndex < 14 ? 'Set 1' : currentSongIndex < 28 ? 'Set 2' : 'Encore');

  // Live Dynamic Set & Song Timing Metrics calculation
  const timingMetrics = computeLiveTiming(
    activeSetlist,
    allDatabaseSongs,
    currentSongIndex,
    currentSectionIndex,
    currentBar,
    currentBeat,
    currentBpm,
    isPlaying
  );

  // Filtered Setlist Items for Quick Jump Drawer
  const filteredSetlistItems = setlistItems.map((item, idx) => {
    const song = allDatabaseSongs.find((s) => s.id === item.songId);
    const setGroup = item.setGroup || (idx < 14 ? 'Set 1' : idx < 28 ? 'Set 2' : 'Encore');
    return { item, song, index: idx, setGroup };
  }).filter(({ song, setGroup }) => {
    if (drawerSetFilter !== 'ALL' && setGroup !== drawerSetFilter) return false;
    if (!searchSongQuery.trim()) return true;
    if (!song) return false;
    const q = searchSongQuery.toLowerCase();
    return song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q) || song.key.toLowerCase().includes(q);
  });

  return (
    <div
      id="stage-hud-root"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`min-h-[calc(100vh-60px)] bg-[#050505] text-zinc-100 p-2 sm:p-4 lg:p-6 select-none flex flex-col justify-between ${
        isLandscape ? 'stage-landscape-view' : 'stage-portrait-view'
      }`}
    >
      {/* Full-width rhythmic top beat flasher (ultra-visible on phone mounts) */}
      <div
        className={`fixed top-0 left-0 right-0 h-1.5 z-50 transition-colors duration-100 ${
          downbeatFlash
            ? 'bg-white shadow-[0_0_20px_#ffffff]'
            : flashBeat
            ? 'bg-orange-500 shadow-[0_0_15px_#f97316]'
            : 'bg-transparent'
        }`}
      />

      <div className="max-w-7xl mx-auto w-full space-y-2.5">
        {/* TOP BAR: View Mode Switcher, Orientation Toggle & Quick Song Selector */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between gap-2 shadow-lg flex-wrap">
          {/* Left View Mode Toggle Pills */}
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-xl border border-zinc-800">
            <button
              onClick={() => setViewMode('mic_stand')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === 'mic_stand'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Compact Phone & Mic Stand High-Glance Mode"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>STAND</span>
            </button>

            <button
              onClick={() => setViewMode('teleprompter')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === 'teleprompter'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Giant Lyrics & Chords Teleprompter"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>CHORDS</span>
            </button>

            <button
              onClick={() => setViewMode('standard')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === 'standard'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Full Stage Dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>FULL</span>
            </button>
          </div>

          {/* Quick Jump 29-Song Selector Pill */}
          <button
            onClick={() => setShowSetlistDrawer(true)}
            className="px-2.5 py-1 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-xs font-mono text-orange-400 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Open 29-Track Setlist Jump Menu"
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-black uppercase ${
              currentSetGroup === 'Set 1'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : currentSetGroup === 'Set 2'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
            }`}>
              {currentSetGroup}
            </span>
            <span>#{currentSongIndex + 1}/{setlistItems.length}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {/* Center / Right: Orientation Switcher, Text Zoom & Lock */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Mobile Orientation Toggle (Auto / Vertical / Horizontal) */}
            <button
              id="btn-toggle-orientation"
              onClick={() => {
                if (orientationOverride === 'auto') setOrientationOverride('landscape');
                else if (orientationOverride === 'landscape') setOrientationOverride('portrait');
                else setOrientationOverride('auto');
              }}
              className={`px-2 py-1 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                orientationOverride === 'landscape'
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                  : orientationOverride === 'portrait'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title={`Orientation Mode: ${orientationOverride.toUpperCase()} (Tap to switch between Auto, Horizontal Landscape, and Vertical Portrait)`}
            >
              <RotateCw className="w-3 h-3" />
              <span className="uppercase text-[10px]">
                {orientationOverride === 'auto'
                  ? isLandscape ? 'HORIZ (AUTO)' : 'VERT (AUTO)'
                  : orientationOverride === 'landscape'
                  ? 'HORIZ LOCK'
                  : 'VERT LOCK'}
              </span>
            </button>

            {/* Quick Text Zoom Controls */}
            <div className="flex items-center bg-zinc-950 rounded-xl border border-zinc-800 p-0.5">
              <button
                onClick={() => setTextSize('normal')}
                className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  textSize === 'normal' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                }`}
                title="Normal text size"
              >
                A
              </button>
              <button
                onClick={() => setTextSize('large')}
                className={`px-1.5 py-0.5 text-[12px] font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  textSize === 'large' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                }`}
                title="Large text size"
              >
                A+
              </button>
              <button
                onClick={() => setTextSize('giant')}
                className={`px-1.5 py-0.5 text-[13px] font-mono font-black rounded-lg transition-colors cursor-pointer ${
                  textSize === 'giant' ? 'bg-orange-500 text-black' : 'text-zinc-500'
                }`}
                title="Giant text size"
              >
                A++
              </button>
            </div>

            {/* Lock Control */}
            <button
              id="btn-lock-stage-hud"
              onClick={() => setStageLocked(!stageLocked)}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                stageLocked
                  ? 'bg-red-500/20 border-red-500 text-red-400'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title={stageLocked ? 'Stage Locked (Tap to Unlock)' : 'Lock Stage Controls'}
            >
              {stageLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DYNAMIC LIVE SET & SONG TIMING HUD COMMAND BAR */}
        {/* ========================================================================= */}
        <div className="bg-zinc-900/95 border border-zinc-800 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3 shadow-lg flex-wrap backdrop-blur-md">
          {/* Active Set Live Remaining Time */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner ${
              timingMetrics.currentSetGroup === 'Set 1'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : timingMetrics.currentSetGroup === 'Set 2'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
            }`}>
              <Hourglass className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-black uppercase text-orange-400">
                  {timingMetrics.currentSetGroup} REMAINING
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  ({timingMetrics.currentSongIndexInSet}/{timingMetrics.totalSongsInSet} in set)
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm sm:text-base font-mono font-black text-white">
                  -{formatTimeDisplay(timingMetrics.setRemainingSec)}
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  / {formatTimeDisplay(timingMetrics.setTotalSec)}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Live Song Remaining Bar & Countdown */}
          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
              <span className="text-zinc-300 font-bold uppercase truncate">Song Remaining</span>
              <span className="text-orange-400 font-black">-{formatTimeDisplay(timingMetrics.songRemainingSec)}</span>
            </div>
            <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-400 transition-all duration-150"
                style={{ width: `${timingMetrics.songProgressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-0.5">
              <span>{formatTimeDisplay(timingMetrics.songElapsedSec)}</span>
              <span>{formatTimeDisplay(timingMetrics.songTotalSec)}</span>
            </div>
          </div>

          {/* Right: Gig Curfew & Total Countdown */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="text-right">
              <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase">
                GIG REMAINING
              </div>
              <div className="text-xs sm:text-sm font-mono font-black text-zinc-200">
                -{formatTimeDisplay(timingMetrics.gigRemainingSec, true)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW MODE 1: MIC STAND / PHONE MODE (HORIZONTAL LANDSCAPE OR VERTICAL PORTRAIT) */}
        {/* ========================================================================= */}
        {viewMode === 'mic_stand' && (
          <div className="space-y-2.5 animate-in fade-in duration-150">
            {/* Header: Track Number, Song Title, Key & BPM */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 shadow-xl">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setShowSetlistDrawer(true)}
                  className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono font-black text-xs border border-orange-500/30 whitespace-nowrap cursor-pointer hover:bg-orange-500/20"
                >
                  #{currentSongIndex + 1}/{setlistItems.length}
                </button>
                <h1 className="text-base sm:text-xl font-black text-white truncate">
                  {currentSong?.title || 'No Song'}
                </h1>
                <span className="text-xs text-zinc-400 hidden sm:inline truncate">
                  {currentSong?.artist}
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-300 font-bold whitespace-nowrap">
                <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-orange-400 font-black">
                  {currentSong?.key || 'E min'}
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                  {currentBpm} BPM
                </span>
              </div>
            </div>

            {/* IF HORIZONTAL (LANDSCAPE) VIEW: 2-COLUMN SPLIT */}
            {isLandscape ? (
              <div className="grid grid-cols-12 gap-2.5">
                {/* Left Column (Bar, Beats, Section, Next) */}
                <div
                  className={`col-span-6 rounded-2xl border p-3 flex flex-col justify-between relative overflow-hidden transition-all duration-100 ${
                    downbeatFlash
                      ? 'bg-zinc-850 border-white shadow-[0_0_30px_rgba(255,255,255,0.35)]'
                      : flashBeat
                      ? 'bg-zinc-900 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.2)]'
                      : isCountdownWarning
                      ? 'bg-zinc-900 border-amber-500'
                      : 'bg-zinc-900 border-zinc-800'
                  }`}
                  style={{ minHeight: '260px' }}
                >
                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden mb-2 border border-zinc-800">
                    <div
                      className="h-full transition-all duration-100"
                      style={{
                        width: `${sectionProgressPercent}%`,
                        backgroundColor: activeSection?.color || '#f97316',
                      }}
                    />
                  </div>

                  {/* Section Badge & Count-in */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider truncate"
                      style={{
                        backgroundColor: `${activeSection?.color || '#f97316'}22`,
                        color: activeSection?.color || '#f97316',
                        border: `1px solid ${activeSection?.color || '#f97316'}55`,
                      }}
                    >
                      SEC {currentSectionIndex + 1}/{sections.length} • {activeSection?.name}
                    </span>

                    {isCountIn ? (
                      <span className="px-2 py-0.5 rounded bg-orange-500 text-black text-[10px] font-black uppercase animate-bounce">
                        COUNT ({countInBeat})
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-zinc-400">
                        {barsRemaining} BARS LEFT
                      </span>
                    )}
                  </div>

                  {/* Giant Bar Number */}
                  <div className="my-1 text-center">
                    <div className={`font-mono ${textSizeClasses.bars} font-black text-white leading-none`}>
                      BAR {currentBar}
                      <span className="text-zinc-600 text-xl sm:text-3xl">/{totalBarsInSection}</span>
                    </div>
                  </div>

                  {/* 4-Beat Flasher Row */}
                  <div className="grid grid-cols-4 gap-1.5 my-1">
                    {Array.from({ length: beatsPerBar }).map((_, idx) => {
                      const beatNum = idx + 1;
                      const isCurrent = currentBeat === beatNum && isPlaying;
                      const isDown = beatNum === 1;

                      return (
                        <div
                          key={beatNum}
                          className={`h-9 rounded-lg border flex flex-col items-center justify-center font-mono font-black transition-all ${
                            isCurrent && isDown
                              ? 'bg-white text-black border-white shadow-[0_0_20px_#ffffff] scale-105'
                              : isCurrent
                              ? 'bg-orange-500 text-black border-orange-500 shadow-[0_0_15px_#f97316] scale-102'
                              : isDown
                              ? 'bg-zinc-950 border-zinc-700 text-zinc-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                          }`}
                        >
                          <span className="text-base font-black">{beatNum}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Next Section Warning */}
                  <div
                    className={`p-1.5 rounded-lg border flex items-center justify-between text-xs ${
                      isCountdownWarning
                        ? 'bg-orange-500/20 border-orange-500 animate-pulse'
                        : 'bg-zinc-950 border-zinc-800'
                    }`}
                  >
                    <span className="text-[10px] font-mono text-zinc-400 uppercase truncate">
                      NEXT: {nextSection ? nextSection.name : 'END OF SONG'}
                    </span>
                    {nextSection && (
                      <span className="font-mono text-[10px] font-black text-orange-400 shrink-0">
                        IN {barsRemaining}B
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Column (Lyrics Teleprompter / Bass Tab / Role Notes) */}
                <div className="col-span-6 space-y-2 flex flex-col justify-between">
                  {currentRole === 'lead_vocals' ? (
                    <VocalLyricsViewer
                      song={currentSong}
                      sections={sections}
                      currentSectionIndex={currentSectionIndex}
                      currentBar={currentBar}
                      currentBeat={currentBeat}
                      beatsPerBar={beatsPerBar}
                      isPlaying={isPlaying}
                      onSeekSection={handleSeekSection}
                      textSize={textSize}
                      isCompact={true}
                    />
                  ) : currentRole === 'bass' && activeSection ? (
                    <BassTabViewer
                      section={activeSection}
                      songKey={currentSong?.key || 'E min'}
                      songBpm={currentBpm}
                      currentBar={currentBar}
                      currentBeat={currentBeat}
                      beatsPerBar={beatsPerBar}
                      isPlaying={isPlaying}
                      textSize={textSize}
                    />
                  ) : (
                    <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5 flex-1 shadow-lg">
                      {activeSection?.chords && (
                        <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                          <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase block">PROGRESSION:</span>
                          <div className={`${textSizeClasses.chords} font-mono text-orange-400 tracking-wider truncate`}>
                            {activeSection.chords}
                          </div>
                        </div>
                      )}

                      <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                        <span
                          className="text-[10px] font-bold uppercase block mb-0.5"
                          style={{ color: currentRoleDef.defaultColor }}
                        >
                          {currentRoleDef.shortLabel} CUE:
                        </span>
                        <p className="text-zinc-200 font-medium line-clamp-3 leading-snug">
                          {roleNoteText}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Quick Section Seek Pills */}
                  <div className="grid grid-cols-4 gap-1">
                    {sections.slice(0, 8).map((sec, idx) => (
                      <button
                        key={sec.id}
                        onClick={() => handleSeekSection(idx)}
                        className={`py-1 px-1.5 rounded-lg border text-[10px] font-bold uppercase truncate transition-all cursor-pointer ${
                          idx === currentSectionIndex
                            ? 'bg-zinc-800 text-white border-orange-500'
                            : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {sec.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* VERTICAL (PORTRAIT) STACKED CARD */
              <div
                className={`rounded-2xl border p-4 sm:p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-100 ${
                  downbeatFlash
                    ? 'bg-zinc-850 border-white shadow-[0_0_40px_rgba(255,255,255,0.35)]'
                    : flashBeat
                    ? 'bg-zinc-900 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.2)]'
                    : isCountdownWarning
                    ? 'bg-zinc-900 border-amber-500'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
                style={{ minHeight: '340px' }}
              >
                {/* Top Section Progress Bar */}
                <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden mb-3 border border-zinc-800">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${sectionProgressPercent}%`,
                      backgroundColor: activeSection?.color || '#f97316',
                    }}
                  />
                </div>

                {/* Section Tag + Count In */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider"
                    style={{
                      backgroundColor: `${activeSection?.color || '#f97316'}22`,
                      color: activeSection?.color || '#f97316',
                      border: `1px solid ${activeSection?.color || '#f97316'}55`,
                    }}
                  >
                    SEC {currentSectionIndex + 1}/{sections.length} • {activeSection?.type?.toUpperCase()}
                  </span>

                  {isCountIn ? (
                    <span className="px-3 py-1 rounded-lg bg-orange-500 text-black text-xs font-black uppercase animate-bounce">
                      COUNT-IN ({countInBeat})
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-zinc-400">
                      {barsRemaining} BARS REMAINING
                    </span>
                  )}
                </div>

                {/* Huge Glancable Section Name & Bar Display */}
                <div className="my-2">
                  <h2
                    className={`${textSizeClasses.section} font-black tracking-tight uppercase leading-none truncate`}
                    style={{ color: activeSection?.color || '#ffffff' }}
                  >
                    {activeSection?.name || 'Intro'}
                  </h2>

                  <div className="flex items-baseline justify-between mt-2">
                    <div className={`font-mono ${textSizeClasses.bars} font-black text-white leading-none`}>
                      BAR {currentBar}
                      <span className="text-zinc-600 text-2xl sm:text-4xl">/{totalBarsInSection}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase block">SWIPE GESTURES</span>
                      <span className="text-xs font-mono text-orange-400 font-bold">◄ PREV | NEXT ►</span>
                    </div>
                  </div>
                </div>

                {/* 4-Beat Flasher Grid (Compact) */}
                <div className="grid grid-cols-4 gap-2 my-2">
                  {Array.from({ length: beatsPerBar }).map((_, idx) => {
                    const beatNum = idx + 1;
                    const isCurrent = currentBeat === beatNum && isPlaying;
                    const isDown = beatNum === 1;

                    return (
                      <div
                        key={beatNum}
                        className={`h-12 sm:h-16 rounded-xl border flex flex-col items-center justify-center font-mono font-black transition-all ${
                          isCurrent && isDown
                            ? 'bg-white text-black border-white shadow-[0_0_25px_#ffffff] scale-105'
                            : isCurrent
                            ? 'bg-orange-500 text-black border-orange-500 shadow-[0_0_20px_#f97316] scale-102'
                            : isDown
                            ? 'bg-zinc-950 border-zinc-700 text-zinc-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                        }`}
                      >
                        <span className="text-xl sm:text-2xl">{beatNum}</span>
                        <span className="text-[8px] uppercase font-bold tracking-wider opacity-70">
                          {isDown ? 'DOWN' : 'BEAT'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Role Notes & Chords / Mart Bass Tab / Rosie Vocal Lyrics (Optimized Glanceability) */}
                {currentRole === 'lead_vocals' ? (
                  <div className="my-1">
                    <VocalLyricsViewer
                      song={currentSong}
                      sections={sections}
                      currentSectionIndex={currentSectionIndex}
                      currentBar={currentBar}
                      currentBeat={currentBeat}
                      beatsPerBar={beatsPerBar}
                      isPlaying={isPlaying}
                      onSeekSection={handleSeekSection}
                      textSize={textSize}
                      isCompact={true}
                    />
                  </div>
                ) : currentRole === 'bass' && activeSection ? (
                  <div className="my-1">
                    <BassTabViewer
                      section={activeSection}
                      songKey={currentSong?.key || 'E min'}
                      songBpm={currentBpm}
                      currentBar={currentBar}
                      currentBeat={currentBeat}
                      beatsPerBar={beatsPerBar}
                      isPlaying={isPlaying}
                      textSize={textSize}
                    />
                  </div>
                ) : (activeSection?.chords || roleNoteText) ? (
                  <div className="p-3 sm:p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5 my-1">
                    {activeSection?.chords && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">CHORDS:</span>
                        <span className={`${textSizeClasses.chords} font-mono text-orange-400 tracking-wider`}>
                          {activeSection.chords}
                        </span>
                      </div>
                    )}
                    {roleNoteText && (
                      <div className="flex items-start gap-2">
                        <span
                          className="text-[10px] font-bold uppercase shrink-0 mt-0.5"
                          style={{ color: currentRoleDef.defaultColor }}
                        >
                          {currentRoleDef.shortLabel}:
                        </span>
                        <p className={`${textSizeClasses.notes} text-zinc-200 leading-snug line-clamp-2`}>
                          {roleNoteText}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Next Section Warning Banner */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    isCountdownWarning
                      ? 'bg-orange-500/20 border-orange-500 shadow-md animate-pulse'
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase shrink-0">NEXT:</span>
                    {nextSection ? (
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: nextSection.color }}
                        />
                        <span className="font-bold text-sm sm:text-base text-white uppercase truncate">
                          {nextSection.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-zinc-500 uppercase">END OF SONG</span>
                    )}
                  </div>

                  {nextSection && (
                    <div className="font-mono text-xs sm:text-sm font-black text-orange-400 shrink-0 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>IN {barsRemaining} BAR{barsRemaining !== 1 ? 'S' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW MODE 2: TELEPROMPTER & CHORD CHART MODE */}
        {/* ========================================================================= */}
        {viewMode === 'teleprompter' && (
          <div
            ref={teleprompterRef}
            className="space-y-3 max-h-[68vh] overflow-y-auto pr-1 animate-in fade-in"
          >
            {/* Song Chords Header */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-black">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white">
                    {currentSong?.title} • Chords & Lyrics Prompter
                  </h1>
                  <span className="text-xs text-zinc-400 font-mono">
                    Key: <strong className="text-orange-400">{currentSong?.key}</strong> • {currentBpm} BPM • {sections.length} Sections
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSetlistDrawer(true)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono font-bold text-orange-400 hover:bg-zinc-850 cursor-pointer"
                >
                  Track {currentSongIndex + 1}/{setlistItems.length} ▾
                </button>
              </div>
            </div>

            {/* Sections Full Live Prompter */}
            {sections.map((sec, idx) => {
              const isCurrent = idx === currentSectionIndex;
              const secLines = sec.lyrics
                ? sec.lyrics.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
                : [];

              // Calculate active line for this section
              const totalSecBars = sec.bars || 4;
              const secProgress = isCurrent
                ? Math.min(1, Math.max(0, ((currentBar - 1) + (currentBeat - 1) / beatsPerBar) / totalSecBars))
                : 0;
              const activeLineIdx = secLines.length > 0
                ? Math.min(secLines.length - 1, Math.floor(secProgress * secLines.length))
                : 0;
              const lineSpan = secLines.length > 0 ? 1 / secLines.length : 1;
              const lineProg = secLines.length > 0
                ? Math.min(1, Math.max(0, (secProgress - activeLineIdx * lineSpan) / lineSpan))
                : 0;

              return (
                <div
                  key={sec.id || idx}
                  id={`teleprompter-section-${idx}`}
                  onClick={() => handleSeekSection(idx)}
                  className={`p-4 sm:p-6 rounded-2xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-zinc-900 border-orange-500 shadow-2xl shadow-orange-500/20 scale-[1.01] ring-1 ring-orange-500/50'
                      : 'bg-zinc-950/80 border-zinc-850 opacity-65 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-black uppercase"
                        style={{ backgroundColor: `${sec.color}22`, color: sec.color }}
                      >
                        {sec.name} ({sec.bars} BARS)
                      </span>
                      {isCurrent && isPlaying && (
                        <span className="px-2.5 py-1 rounded-lg bg-orange-500 text-black font-mono font-black text-xs animate-pulse">
                          LIVE: BAR {currentBar}/{sec.bars} (BEAT {currentBeat})
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-zinc-400">{sec.timeSignature || '4/4'}</span>
                  </div>

                  {/* Chord Chart */}
                  {sec.chords && (
                    <div className="my-3 p-3 rounded-xl bg-black/70 border border-zinc-800/80 font-mono">
                      <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Chords:</div>
                      <div className={`${textSizeClasses.chords} text-amber-400 font-black tracking-wider leading-relaxed`}>
                        {sec.chords}
                      </div>
                    </div>
                  )}

                  {/* Synchronized Lyrics with Faint Word Highlight */}
                  {secLines.length > 0 && (
                    <div className="space-y-2 my-3">
                      {secLines.map((line, lIdx) => {
                        const isThisLineActive = isCurrent && isPlaying && lIdx === activeLineIdx;

                        return (
                          <div
                            key={lIdx}
                            className={`p-2.5 rounded-xl transition-all relative overflow-hidden ${
                              isThisLineActive
                                ? 'bg-orange-500/15 border border-orange-500/50 shadow-inner'
                                : 'text-zinc-300'
                            }`}
                          >
                            {isThisLineActive ? (
                              <div className="relative">
                                {/* Sweep Bar */}
                                <div
                                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-all duration-100"
                                  style={{ width: `${lineProg * 100}%` }}
                                />

                                <div className={`${textSizeClasses.notes} text-white font-bold leading-relaxed flex flex-wrap gap-x-2 gap-y-1`}>
                                  {line.split(' ').map((word, wIdx, wArr) => {
                                    const wordProg = wIdx / Math.max(1, wArr.length);
                                    const isCurWord = lineProg >= wordProg && lineProg < (wIdx + 1) / wArr.length;
                                    const isPast = lineProg >= (wIdx + 1) / wArr.length;

                                    return (
                                      <span
                                        key={wIdx}
                                        className={`transition-all duration-100 ${
                                          isCurWord
                                            ? 'text-orange-300 font-black scale-105 drop-shadow-[0_0_8px_#f97316]'
                                            : isPast
                                            ? 'text-zinc-100'
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
                              <div className={`${textSizeClasses.notes} leading-relaxed text-zinc-300`}>
                                {line}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {sec.roleNotes?.[currentRole] && (
                    <div className="mt-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs sm:text-sm text-zinc-300">
                      <strong style={{ color: currentRoleDef.defaultColor }}>{currentRoleDef.label} cue: </strong>
                      {sec.roleNotes[currentRole]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW MODE 3: STANDARD FULL DASHBOARD (DESKTOP & TABLET VIEW) */}
        {/* ========================================================================= */}
        {viewMode === 'standard' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Song Header & Navigation */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  id="btn-prev-song"
                  onClick={handlePrevSong}
                  disabled={currentSongIndex === 0 || stageLocked}
                  className="p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-950 border border-zinc-800 text-zinc-200 transition-colors cursor-pointer"
                  title="Previous Song"
                >
                  <SkipBack className="w-6 h-6" />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSetlistDrawer(true)}
                      className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono font-bold text-xs border border-orange-500/30 cursor-pointer hover:bg-orange-500/20"
                    >
                      TRACK {currentSongIndex + 1} OF {setlistItems.length || 1} ▾
                    </button>
                    <span className="text-xs text-zinc-400 font-mono">
                      {currentSong?.key || 'E min'} • {currentBpm} BPM • {activeSection?.timeSignature || currentSong?.timeSignature || '4/4'}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mt-0.5 truncate max-w-[400px]">
                    {currentSong?.title || 'No Song Selected'}
                  </h1>
                </div>

                <button
                  id="btn-next-song"
                  onClick={handleNextSong}
                  disabled={currentSongIndex >= setlistItems.length - 1 || stageLocked}
                  className="p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-950 border border-zinc-800 text-zinc-200 transition-colors cursor-pointer"
                  title="Next Song"
                >
                  <SkipForward className="w-6 h-6" />
                </button>
              </div>

              {/* Stage Audio Toggles */}
              <div className="flex items-center justify-end gap-2">
                <button
                  id="btn-toggle-hud-click"
                  onClick={toggleClick}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    clickActive
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                  }`}
                  title="Click Track In-Ear"
                >
                  {clickActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  <span>CLICK</span>
                </button>

                <button
                  id="btn-toggle-hud-voice"
                  onClick={toggleVoice}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    voiceActive
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                  }`}
                  title="Vocal Section Warnings"
                >
                  <Radio className="w-4 h-4" />
                  <span>VOICE CUES</span>
                </button>
              </div>
            </div>

            {/* 12-col Grid for Countdown Card & Role Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div
                className={`lg:col-span-8 rounded-2xl border p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-150 ${
                  downbeatFlash
                    ? 'bg-zinc-850 border-white shadow-[0_0_50px_rgba(255,255,255,0.4)]'
                    : flashBeat
                    ? 'bg-zinc-900 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.2)]'
                    : isCountdownWarning
                    ? 'bg-zinc-900 border-amber-500'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
                style={{ minHeight: '380px' }}
              >
                <div className="w-full bg-zinc-950 h-3 rounded-full overflow-hidden mb-4 border border-zinc-800">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${sectionProgressPercent}%`,
                      backgroundColor: activeSection?.color || '#f97316',
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider"
                        style={{
                          backgroundColor: `${activeSection?.color || '#f97316'}22`,
                          color: activeSection?.color || '#f97316',
                          border: `1px solid ${activeSection?.color || '#f97316'}55`,
                        }}
                      >
                        SECTION {currentSectionIndex + 1} OF {sections.length} • {activeSection?.type?.toUpperCase()}
                      </span>

                      {isCountIn && (
                        <span className="px-3 py-1 rounded-lg bg-orange-500 text-black text-xs font-black uppercase animate-bounce">
                          COUNT-IN ({countInBeat} BEATS)
                        </span>
                      )}
                    </div>

                    <span className="text-sm font-mono text-zinc-400">
                      {barsRemaining} BAR{barsRemaining !== 1 ? 'S' : ''} REMAINING
                    </span>
                  </div>

                  <h2
                    className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight uppercase leading-none"
                    style={{ color: activeSection?.color || '#ffffff' }}
                  >
                    {activeSection?.name || 'Intro'}
                  </h2>

                  <div className="flex items-baseline gap-4 pt-2">
                    <div className="font-mono text-4xl sm:text-6xl font-black text-white">
                      BAR {currentBar}
                      <span className="text-zinc-600 text-2xl sm:text-4xl"> / {totalBarsInSection}</span>
                    </div>
                  </div>
                </div>

                {/* 4-Beat Flasher */}
                <div className="grid grid-cols-4 gap-2 sm:gap-4 my-6">
                  {Array.from({ length: beatsPerBar }).map((_, idx) => {
                    const beatNum = idx + 1;
                    const isCurrent = currentBeat === beatNum && isPlaying;
                    const isDown = beatNum === 1;

                    return (
                      <div
                        key={beatNum}
                        className={`h-16 sm:h-20 rounded-xl border flex flex-col items-center justify-center font-mono font-black transition-all ${
                          isCurrent && isDown
                            ? 'bg-white text-black border-white shadow-[0_0_30px_#ffffff] scale-105'
                            : isCurrent
                            ? 'bg-orange-500 text-black border-orange-500 shadow-[0_0_20px_#f97316] scale-102'
                            : isDown
                            ? 'bg-zinc-950 border-zinc-700 text-zinc-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                        }`}
                      >
                        <span className="text-2xl sm:text-4xl">{beatNum}</span>
                        <span className="text-[9px] uppercase font-bold tracking-widest opacity-80">
                          {isDown ? 'DOWN' : 'BEAT'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Next Section Warning */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                    isCountdownWarning
                      ? 'bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-500/20 animate-pulse'
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-zinc-400 uppercase">NEXT:</span>
                    {nextSection ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: nextSection.color }}
                        />
                        <span className="font-bold text-base sm:text-xl text-white uppercase tracking-tight">
                          {nextSection.name}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">({nextSection.bars} bars)</span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-zinc-500 uppercase">END OF SONG</span>
                    )}
                  </div>

                  {nextSection && (
                    <div className="font-mono text-sm sm:text-base font-black text-orange-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>IN {barsRemaining} BAR{barsRemaining !== 1 ? 'S' : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Role-Specific Performance Notes Box */}
              <div
                id="hud-role-notes-card"
                className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-2xl"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: currentRoleDef.defaultColor }}
                      />
                      <span
                        className="text-xs font-black uppercase tracking-wider"
                        style={{ color: currentRoleDef.defaultColor }}
                      >
                        {currentRoleDef.shortLabel} CUE SHEET
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Role View</span>
                    </div>
                  </div>

                  {/* Quick Role Switcher Chips */}
                  <div className="grid grid-cols-4 gap-1.5 mb-4">
                    {ROLE_DEFINITIONS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => onChangeRole(r.id)}
                        className={`py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          currentRole === r.id
                            ? 'bg-zinc-800 text-white border'
                            : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                        }`}
                        style={{ borderColor: currentRole === r.id ? r.defaultColor : 'transparent' }}
                      >
                        {r.shortLabel}
                      </button>
                    ))}
                  </div>

                  {currentRole === 'lead_vocals' ? (
                    <VocalLyricsViewer
                      song={currentSong}
                      sections={sections}
                      currentSectionIndex={currentSectionIndex}
                      currentBar={currentBar}
                      currentBeat={currentBeat}
                      beatsPerBar={beatsPerBar}
                      isPlaying={isPlaying}
                      onSeekSection={handleSeekSection}
                      textSize={textSize}
                    />
                  ) : currentRole === 'bass' && activeSection ? (
                    <BassTabViewer
                      section={activeSection}
                      songKey={currentSong?.key || 'E min'}
                      songBpm={currentBpm}
                      currentBar={currentBar}
                      currentBeat={currentBeat}
                      beatsPerBar={beatsPerBar}
                      isPlaying={isPlaying}
                      textSize={textSize}
                    />
                  ) : (
                    <>
                      {activeSection?.chords && (
                        <div className="mb-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Harmonic Progression</span>
                          <span className="text-lg sm:text-xl font-bold text-orange-400 tracking-wide">
                            {activeSection.chords}
                          </span>
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-sm sm:text-base leading-relaxed space-y-2">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                          Instructions for {currentRoleDef.label}
                        </span>
                        <p className="text-zinc-100 font-medium whitespace-pre-wrap">
                          {roleNoteText}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {activeSection?.midiTrigger?.enabled && (
                  <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-between text-xs text-orange-300 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-orange-400" />
                      <span>MIDI Patch</span>
                    </div>
                    <span>PC #{activeSection.midiTrigger.programChange}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section Jump Timeline Scrubber */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span className="font-bold uppercase tracking-wider text-zinc-300">Song Structure Jump Bar</span>
                <span className="font-mono">Tap section to seek</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {sections.map((sec, idx) => {
                  const isCurrent = idx === currentSectionIndex;

                  return (
                    <button
                      key={sec.id}
                      onClick={() => handleSeekSection(idx)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-zinc-800 text-white border shadow-md'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                      style={{ borderColor: isCurrent ? sec.color : undefined }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold text-zinc-500">#{idx + 1}</span>
                        <span className="text-[10px] font-mono text-zinc-400">{sec.bars}b</span>
                      </div>
                      <span className="font-bold text-xs block truncate text-white">{sec.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FIXED BOTTOM STAGE THUMB BAR (ALWAYS VISIBLE & EASY TO TAP ON PHONES) */}
      {/* ========================================================================= */}
      <div className={`sticky bottom-0 z-30 ${isLandscape ? 'pt-1.5' : 'pt-2.5'}`}>
        <div className={`max-w-7xl mx-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl flex items-center justify-between gap-2 ${
          isLandscape ? 'p-1.5 sm:p-2' : 'p-2.5 sm:p-3'
        }`}>
          {/* Quick Prev Track */}
          <button
            onClick={handlePrevSong}
            disabled={currentSongIndex === 0 || stageLocked}
            className={`rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 text-zinc-200 transition-all cursor-pointer ${
              isLandscape ? 'p-2' : 'p-3 sm:p-3.5'
            }`}
            title="Previous Song"
          >
            <SkipBack className={isLandscape ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"} />
          </button>

          {/* Main Giant Play/Pause Button */}
          <button
            id="btn-stage-play-pause-bottom"
            onClick={handlePlayPause}
            disabled={stageLocked}
            className={`flex-1 rounded-xl font-black tracking-wider uppercase transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
              isLandscape ? 'py-2 text-sm sm:text-base' : 'py-3.5 sm:py-4 text-base sm:text-xl'
            } ${
              isPlaying
                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-500/30'
                : 'bg-orange-500 hover:bg-orange-400 text-black shadow-orange-500/30'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className={isLandscape ? "w-4 h-4 fill-current" : "w-6 h-6 fill-current"} />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className={isLandscape ? "w-4 h-4 fill-current" : "w-6 h-6 fill-current"} />
                <span>START TRACK</span>
              </>
            )}
          </button>

          {/* Stop / Reset */}
          <button
            onClick={handleStop}
            disabled={stageLocked}
            className={`rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors cursor-pointer ${
              isLandscape ? 'p-2' : 'p-3 sm:p-3.5'
            }`}
            title="Stop & Reset"
          >
            <Square className={isLandscape ? "w-4 h-4 fill-current" : "w-5 h-5 sm:w-6 sm:h-6 fill-current"} />
          </button>

          {/* Quick Next Track */}
          <button
            onClick={handleNextSong}
            disabled={currentSongIndex >= setlistItems.length - 1 || stageLocked}
            className={`rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 text-zinc-200 transition-all cursor-pointer ${
              isLandscape ? 'p-2' : 'p-3 sm:p-3.5'
            }`}
            title="Next Song"
          >
            <SkipForward className={isLandscape ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"} />
          </button>

          {/* Emergency Stage Cue Broadcast Drawer Trigger */}
          <button
            onClick={() => setShowQuickCueDrawer(!showQuickCueDrawer)}
            className={`rounded-xl bg-red-600/90 hover:bg-red-500 border border-red-500 text-white font-black transition-all cursor-pointer shadow-lg shadow-red-600/30 ${
              isLandscape ? 'p-2' : 'p-3 sm:p-3.5'
            }`}
            title="Open Emergency Stage Cue Drawer"
          >
            <AlertTriangle className={isLandscape ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"} />
          </button>
        </div>

        {/* Quick Cue Broadcast Drawer */}
        {showQuickCueDrawer && (
          <div className="max-w-7xl mx-auto mt-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase">
                <AlertTriangle className="w-4 h-4" />
                <span>Broadcast Emergency Stage Alert</span>
              </div>
              <button
                onClick={() => setShowQuickCueDrawer(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {EMERGENCY_CUES.map((cue) => (
                <button
                  key={cue.type}
                  onClick={() => handleTriggerCue(cue.type, cue.label, cue.color)}
                  className="p-2.5 sm:p-3 rounded-xl border text-center font-black text-[11px] sm:text-xs uppercase cursor-pointer transition-all transform active:scale-95"
                  style={{
                    backgroundColor: `${cue.color}22`,
                    borderColor: cue.color,
                    color: cue.color,
                  }}
                >
                  {cue.label}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="mt-2.5">
              {showCustomInput ? (
                <form onSubmit={handleSendCustomCue} className="flex gap-2">
                  <input
                    type="text"
                    value={customCueText}
                    onChange={(e) => setCustomCueText(e.target.value)}
                    placeholder="Custom stage cue (e.g. 'Key change to G')..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-orange-500 text-black font-bold text-xs uppercase cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="text-xs text-zinc-400 hover:text-orange-400 cursor-pointer"
                >
                  + Custom Message Prompt
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 29-TRACK SETLIST QUICK JUMP DRAWER / MODAL */}
      {/* ========================================================================= */}
      {showSetlistDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
              <div className="flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="font-black text-base text-white">
                    {activeSetlist.name}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {setlistItems.length} Tracks • Select any song to jump immediately
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowSetlistDrawer(false)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search Input & Set Filter Tabs */}
            <div className="p-3 border-b border-zinc-800 bg-zinc-900 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  value={searchSongQuery}
                  onChange={(e) => setSearchSongQuery(e.target.value)}
                  placeholder="Search by song title, artist, key, tempo..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Set Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  onClick={() => setDrawerSetFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase whitespace-nowrap cursor-pointer transition-all ${
                    drawerSetFilter === 'ALL'
                      ? 'bg-orange-500 text-black shadow-sm'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  All ({setlistItems.length})
                </button>
                <button
                  onClick={() => setDrawerSetFilter('Set 1')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase whitespace-nowrap cursor-pointer transition-all ${
                    drawerSetFilter === 'Set 1'
                      ? 'bg-blue-500 text-black shadow-sm'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  Set 1 (14)
                </button>
                <button
                  onClick={() => setDrawerSetFilter('Set 2')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase whitespace-nowrap cursor-pointer transition-all ${
                    drawerSetFilter === 'Set 2'
                      ? 'bg-orange-500 text-black shadow-sm'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  Set 2 (14)
                </button>
                <button
                  onClick={() => setDrawerSetFilter('Encore')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase whitespace-nowrap cursor-pointer transition-all ${
                    drawerSetFilter === 'Encore'
                      ? 'bg-purple-500 text-black shadow-sm'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  Encore (1)
                </button>
              </div>
            </div>

            {/* Song List Scroll */}
            <div className="overflow-y-auto p-2 space-y-1 divide-y divide-zinc-850">
              {filteredSetlistItems.map(({ item, song, index, setGroup }) => {
                const isCurrent = index === currentSongIndex;

                return (
                  <button
                    key={`${item.songId}-${index}`}
                    onClick={() => {
                      onSelectSongIndex(index);
                      if (isMaster) {
                        syncService.broadcastChangeSong(item.songId, index);
                      }
                      setShowSetlistDrawer(false);
                    }}
                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-orange-500 text-black font-black shadow-md'
                        : 'hover:bg-zinc-800/70 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`font-mono text-xs font-black w-6 text-center ${isCurrent ? 'text-black' : 'text-zinc-500'}`}>
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm truncate ${isCurrent ? 'text-black' : 'text-white'}`}>
                            {song?.title || 'Unknown Song'}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase ${
                              isCurrent
                                ? 'bg-black/20 text-black'
                                : setGroup === 'Set 1'
                                ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                                : setGroup === 'Set 2'
                                ? 'bg-orange-500/10 text-orange-300 border border-orange-500/30'
                                : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {setGroup}
                          </span>
                        </div>
                        <div className={`text-xs truncate ${isCurrent ? 'text-black/80' : 'text-zinc-400'}`}>
                          {song?.artist || 'Artist'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className={`px-2 py-0.5 rounded ${isCurrent ? 'bg-black/20 text-black' : 'bg-zinc-950 border border-zinc-800 text-orange-400'}`}>
                        {song?.key || 'E min'}
                      </span>
                      <span className={`px-2 py-0.5 rounded ${isCurrent ? 'bg-black/20 text-black' : 'bg-zinc-950 border border-zinc-800 text-zinc-400'}`}>
                        {song?.bpm || 120} BPM
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
