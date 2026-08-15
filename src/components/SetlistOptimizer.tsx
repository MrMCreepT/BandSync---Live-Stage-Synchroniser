import React, { useState, useEffect } from 'react';
import { Setlist, Song, SetlistItem } from '../types';
import { stageDb } from '../services/db';
import { syncService } from '../services/syncService';
import { AiSongImporterModal } from './AiSongImporterModal';
import {
  Music,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  AlertTriangle,
  Printer,
  Share2,
  Check,
  Send,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  Coffee,
  Play,
} from 'lucide-react';

interface SetlistOptimizerProps {
  setlist: Setlist;
  allSongs: Song[];
  onUpdateSetlist: (setlist: Setlist) => void;
  onSelectSongForStage: (songId: string, index: number) => void;
}

export const SetlistOptimizer: React.FC<SetlistOptimizerProps> = ({
  setlist,
  allSongs,
  onUpdateSetlist,
  onSelectSongForStage,
}) => {
  const [currentSetlist, setCurrentSetlist] = useState<Setlist>(() => setlist || {
    id: 'default_setlist',
    name: 'Main Set',
    intermissionMinutes: 20,
    interSongBufferSec: 20,
    items: [],
    updatedAt: Date.now(),
  });
  const [showAddSongModal, setShowAddSongModal] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [pushedSync, setPushedSync] = useState<boolean>(false);
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'Set 1' | 'Set 2' | 'Encore'>('ALL');

  useEffect(() => {
    if (setlist) {
      setCurrentSetlist(setlist);
    }
  }, [setlist]);

  const setlistItems = currentSetlist?.items || [];

  const getSongDurationSec = (song: Song): number => {
    return song.sections.reduce((total, sec) => {
      const bpm = sec.bpmOverride || song.bpm;
      const beats = sec.bars * 4;
      return total + (beats / bpm) * 60;
    }, 0);
  };

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.round(totalSec % 60);
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  // Group items by set
  const set1Items = setlistItems.filter((it) => (it.setGroup || 'Set 1') === 'Set 1');
  const set2Items = setlistItems.filter((it) => it.setGroup === 'Set 2');
  const encoreItems = setlistItems.filter((it) => it.setGroup === 'Encore');

  const calcGroupSec = (items: SetlistItem[]) => {
    const songSec = items.reduce((sum, item) => {
      const s = allSongs.find((x) => x.id === item.songId);
      return sum + (s ? getSongDurationSec(s) : 180);
    }, 0);
    const bufferSec = Math.max(0, items.length - 1) * (currentSetlist.interSongBufferSec || 20);
    return songSec + bufferSec;
  };

  const set1DurationSec = calcGroupSec(set1Items);
  const set2DurationSec = calcGroupSec(set2Items);
  const encoreDurationSec = calcGroupSec(encoreItems);
  const intermissionSec = (currentSetlist.intermissionMinutes || 20) * 60;

  // Compute Total Setlist Duration
  const totalStagePerformanceSec = set1DurationSec + set2DurationSec + encoreDurationSec + intermissionSec;

  // Curfew calculations
  let curfewRemainingMinutes: number | null = null;
  let isCurfewOverrun = false;

  if (currentSetlist.targetStartTime && currentSetlist.targetCurfewTime) {
    const [startH, startM] = currentSetlist.targetStartTime.split(':').map(Number);
    const [curfewH, curfewM] = currentSetlist.targetCurfewTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const curfewMins = curfewH * 60 + curfewM;
    const slotDurationMins = curfewMins >= startMins ? curfewMins - startMins : curfewMins + 24 * 60 - startMins;

    const setTotalMins = totalStagePerformanceSec / 60;
    curfewRemainingMinutes = Math.round(slotDurationMins - setTotalMins);
    isCurfewOverrun = setTotalMins > slotDurationMins;
  }

  const handleMoveSong = (index: number, direction: 'up' | 'down') => {
    const items = [...currentSetlist.items];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIdx];
    items[targetIdx] = temp;

    const updated = { ...currentSetlist, items, updatedAt: Date.now() };
    setCurrentSetlist(updated);
    saveAndPush(updated);
  };

  const handleRemoveSong = (index: number) => {
    const items = currentSetlist.items.filter((_, idx) => idx !== index);
    const updated = { ...currentSetlist, items, updatedAt: Date.now() };
    setCurrentSetlist(updated);
    saveAndPush(updated);
  };

  const handleAddSong = (songId: string, setGroup: 'Set 1' | 'Set 2' | 'Encore' = 'Set 1') => {
    const items = [...currentSetlist.items, { songId, setGroup, customNotes: '' }];
    const updated = { ...currentSetlist, items, updatedAt: Date.now() };
    setCurrentSetlist(updated);
    saveAndPush(updated);
    setShowAddSongModal(false);
  };

  const handleUpdateItemNotes = (index: number, notes: string) => {
    const items = [...currentSetlist.items];
    items[index] = { ...items[index], customNotes: notes };
    const updated = { ...currentSetlist, items, updatedAt: Date.now() };
    setCurrentSetlist(updated);
    saveAndPush(updated);
  };

  const handleUpdateItemSetGroup = (index: number, setGroup: 'Set 1' | 'Set 2' | 'Encore') => {
    const items = [...currentSetlist.items];
    items[index] = { ...items[index], setGroup };
    const updated = { ...currentSetlist, items, updatedAt: Date.now() };
    setCurrentSetlist(updated);
    saveAndPush(updated);
  };

  const saveAndPush = (updated: Setlist) => {
    stageDb.saveSetlist(updated);
    syncService.broadcastSetlistUpdate(updated);
    onUpdateSetlist(updated);
    setPushedSync(true);
    setTimeout(() => setPushedSync(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="setlist-optimizer-root" className="min-h-[calc(100vh-60px)] bg-[#050505] text-zinc-100 p-3 sm:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Smart Curfew Calculator Banner */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono text-xs border border-orange-500/30">
                LIVE STAGE SETLIST & CURFEW ENGINE
              </span>
              {pushedSync && (
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 animate-pulse">
                  Setlist Synced to Band!
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">{currentSetlist.name}</h1>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              29 Tracks Arranged in 3 Sets (Set 1: 14 Songs • Set 2: 14 Songs • Encore: 1 Song)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-ai-import-playlist"
              onClick={() => setShowAiModal(true)}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-orange-500/50 text-orange-400 font-bold text-xs uppercase flex items-center gap-2 cursor-pointer transition-colors shadow-md"
            >
              <Sparkles className="w-4 h-4 text-orange-400" /> AI Link / Playlist Importer
            </button>

            <button
              id="btn-add-song-to-setlist"
              onClick={() => setShowAddSongModal(true)}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase flex items-center gap-2 cursor-pointer transition-colors shadow-md shadow-orange-500/20"
            >
              <Plus className="w-4 h-4" /> Add Song
            </button>

            <button
              id="btn-print-setlist"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Stage Sheet
            </button>
          </div>
        </div>

        {/* Set-by-Set Breakdown Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* SET 1 Card */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-blue-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                SET 1 (Opener)
              </span>
              <span className="text-[11px] font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                {set1Items.length} Songs
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              {formatDuration(set1DurationSec)}
            </div>
            <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
              Valerie → Ain't It Fun
            </span>
          </div>

          {/* SET 2 Card */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-orange-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                SET 2 (Headline)
              </span>
              <span className="text-[11px] font-mono bg-orange-500/10 text-orange-300 px-2 py-0.5 rounded border border-orange-500/30">
                {set2Items.length} Songs
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              {formatDuration(set2DurationSec)}
            </div>
            <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
              Raise Your Glass → Livin' on a Prayer
            </span>
          </div>

          {/* ENCORE Card */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-purple-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                ENCORE
              </span>
              <span className="text-[11px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                {encoreItems.length} Song
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              {formatDuration(encoreDurationSec)}
            </div>
            <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
              Just A Girl (Grand Finale)
            </span>
          </div>

          {/* TOTAL GIG RUNTIME & INTERMISSION */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5" />
                TOTAL SHOW TIME
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {currentSetlist.intermissionMinutes}m Break
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              {formatDuration(totalStagePerformanceSec)}
            </div>
            <span className="text-[11px] text-zinc-500 font-mono block mt-0.5">
              29 Tracks + Intermission
            </span>
          </div>
        </div>

        {/* Stage Timing & Curfew Warning Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-zinc-300 block">Stage Time Window & Intermission Break</span>
              <span className="text-[11px] text-zinc-500">Configure show timings & set break duration</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={currentSetlist.targetStartTime || '20:30'}
                onChange={(e) => {
                  const updated = { ...currentSetlist, targetStartTime: e.target.value };
                  setCurrentSetlist(updated);
                  saveAndPush(updated);
                }}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:border-orange-500 outline-none"
                title="Start Time"
              />
              <span className="text-zinc-500 font-bold">to</span>
              <input
                type="time"
                value={currentSetlist.targetCurfewTime || '23:30'}
                onChange={(e) => {
                  const updated = { ...currentSetlist, targetCurfewTime: e.target.value };
                  setCurrentSetlist(updated);
                  saveAndPush(updated);
                }}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:border-orange-500 outline-none"
                title="Curfew Time"
              />
              <select
                value={currentSetlist.intermissionMinutes || 20}
                onChange={(e) => {
                  const updated = { ...currentSetlist, intermissionMinutes: parseInt(e.target.value, 10) || 0 };
                  setCurrentSetlist(updated);
                  saveAndPush(updated);
                }}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-orange-400 font-mono font-bold focus:border-orange-500 outline-none"
                title="Set Break / Intermission"
              >
                <option value={10}>10m Break</option>
                <option value={15}>15m Break</option>
                <option value={20}>20m Break</option>
                <option value={30}>30m Break</option>
              </select>
            </div>
          </div>

          <div
            className={`lg:col-span-6 p-4 rounded-xl border flex items-center justify-between ${
              isCurfewOverrun
                ? 'bg-red-500/15 border-red-500 text-red-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                {isCurfewOverrun ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <Clock className="w-5 h-5 text-emerald-400" />}
                <span className="font-black text-xs sm:text-sm uppercase tracking-wide">
                  {isCurfewOverrun ? 'CRITICAL: VENUE CURFEW OVERRUN!' : 'STAGE SCHEDULE OPTIMISED'}
                </span>
              </div>
              <p className="text-[11px] mt-0.5">
                {isCurfewOverrun
                  ? `Setlist exceeds curfew by ${Math.abs(curfewRemainingMinutes || 0)}m! Reduce banter or cut songs.`
                  : `Safe stage buffer of ~${curfewRemainingMinutes || 15} minutes before venue curfew.`}
              </p>
            </div>

            <div className="font-mono text-xl sm:text-2xl font-black shrink-0">
              {curfewRemainingMinutes !== null ? `${curfewRemainingMinutes}m` : 'OK'}
            </div>
          </div>
        </div>

        {/* Set View Filter Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2 flex-wrap">
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1">
            <button
              onClick={() => setActiveTabFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase cursor-pointer transition-all ${
                activeTabFilter === 'ALL'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Tracks ({setlistItems.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('Set 1')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase cursor-pointer transition-all ${
                activeTabFilter === 'Set 1'
                  ? 'bg-blue-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Set 1 ({set1Items.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('Set 2')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase cursor-pointer transition-all ${
                activeTabFilter === 'Set 2'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Set 2 ({set2Items.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('Encore')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase cursor-pointer transition-all ${
                activeTabFilter === 'Encore'
                  ? 'bg-purple-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Encore ({encoreItems.length})
            </button>
          </div>

          <div className="text-xs text-zinc-400 font-mono">
            {currentSetlist.interSongBufferSec}s banter buffer between tracks
          </div>
        </div>

        {/* Songs List in Setlist */}
        <div className="space-y-4">
          {setlistItems.map((item, index) => {
            const song = allSongs.find((s) => s.id === item.songId);
            if (!song) return null;

            const currentSetGroup = item.setGroup || (index < 14 ? 'Set 1' : index < 28 ? 'Set 2' : 'Encore');

            // Check if filtered out by active tab
            if (activeTabFilter !== 'ALL' && currentSetGroup !== activeTabFilter) {
              return null;
            }

            const isFirstInSet1 = index === 0;
            const isFirstInSet2 = index === 14 || (index > 0 && currentSetGroup === 'Set 2' && setlistItems[index - 1]?.setGroup !== 'Set 2');
            const isFirstInEncore = index === 28 || (index > 0 && currentSetGroup === 'Encore' && setlistItems[index - 1]?.setGroup !== 'Encore');

            const duration = getSongDurationSec(song);

            return (
              <React.Fragment key={`${item.songId}_${index}`}>
                {/* Visual Set 1 Divider */}
                {isFirstInSet1 && activeTabFilter === 'ALL' && (
                  <div className="pt-2 pb-1 flex items-center justify-between gap-3 border-b border-blue-500/40">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 font-black text-xs uppercase border border-blue-500/40 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        SET 1 (OPENER) • 14 SONGS
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">
                        {formatDuration(set1DurationSec)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Visual Set 2 Divider + Intermission Break Announcement */}
                {isFirstInSet2 && activeTabFilter === 'ALL' && (
                  <div className="my-6 p-4 rounded-2xl bg-zinc-900 border-2 border-dashed border-orange-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400">
                        <Coffee className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase text-orange-400 tracking-wider block">
                          SET BREAK / INTERMISSION ({currentSetlist.intermissionMinutes} MINS)
                        </span>
                        <p className="text-xs text-zinc-300">
                          Crowd drink run • Guitar re-tuning • Vocal rest before Headline Set 2
                        </p>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-xl bg-orange-500 text-black font-black text-xs uppercase font-mono shadow-md">
                      SET 2 STARTS AFTER BREAK ({set2Items.length} SONGS • {formatDuration(set2DurationSec)})
                    </span>
                  </div>
                )}

                {/* Visual Encore Divider */}
                {isFirstInEncore && activeTabFilter === 'ALL' && (
                  <div className="my-6 p-4 rounded-2xl bg-zinc-900 border-2 border-dashed border-purple-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase text-purple-400 tracking-wider block">
                          ENCORE (GRAND FINALE)
                        </span>
                        <p className="text-xs text-zinc-300">
                          Band return to stage after crowd chant
                        </p>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-xl bg-purple-500 text-black font-black text-xs uppercase font-mono shadow-md">
                      ENCORE ({formatDuration(encoreDurationSec)})
                    </span>
                  </div>
                )}

                {/* Track Row */}
                <div
                  className={`p-3.5 sm:p-4 rounded-xl bg-zinc-900 border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 ${
                    currentSetGroup === 'Set 1'
                      ? 'border-zinc-800 hover:border-blue-500/40'
                      : currentSetGroup === 'Set 2'
                      ? 'border-zinc-800 hover:border-orange-500/40'
                      : 'border-purple-500/30 bg-purple-950/10'
                  }`}
                >
                  {/* Left Track Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-zinc-950 flex items-center justify-center font-mono font-black text-xs text-orange-400 border border-zinc-800 shrink-0">
                      {index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-white text-base truncate">{song.title}</h3>
                        <span className="text-xs text-zinc-400 hidden sm:inline truncate">
                          {song.artist}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            currentSetGroup === 'Set 1'
                              ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                              : currentSetGroup === 'Set 2'
                              ? 'bg-orange-500/10 text-orange-300 border-orange-500/30'
                              : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                          }`}
                        >
                          {currentSetGroup}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-950 text-[11px] font-mono text-orange-300 border border-zinc-800">
                          {song.key} • {song.bpm} BPM
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {formatDuration(duration)} • {song.sections.length} Sections
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Per-Song Stage Notes Input */}
                  <div className="flex-1 max-w-md w-full">
                    <input
                      type="text"
                      value={item.customNotes || ''}
                      onChange={(e) => handleUpdateItemNotes(index, e.target.value)}
                      placeholder="Stage notes (e.g. 'Singer checks crowd', 'Drop D', 'Acoustic switch')..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Set Selector & Actions */}
                  <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                    <select
                      value={currentSetGroup}
                      onChange={(e) => handleUpdateItemSetGroup(index, e.target.value as any)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300 font-mono font-bold focus:border-orange-500 outline-none cursor-pointer"
                    >
                      <option value="Set 1">Set 1</option>
                      <option value="Set 2">Set 2</option>
                      <option value="Encore">Encore</option>
                    </select>

                    <button
                      onClick={() => handleMoveSong(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 transition-colors border border-zinc-800 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveSong(index, 'down')}
                      disabled={index === currentSetlist.items.length - 1}
                      className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 transition-colors border border-zinc-800 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onSelectSongForStage(song.id, index)}
                      className="px-2.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs font-bold border border-orange-500/40 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      <span>Stage</span>
                    </button>

                    <button
                      onClick={() => handleRemoveSong(index)}
                      className="p-1.5 rounded-lg bg-zinc-950 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors border border-zinc-800 cursor-pointer"
                      title="Remove from Setlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Add Song Modal */}
        {showAddSongModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-white text-base">Select Song to Add to Setlist</h3>
                <button
                  onClick={() => setShowAddSongModal(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {allSongs.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleAddSong(s.id, 'Set 1')}
                    className="w-full p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-white text-sm block">{s.title}</span>
                      <span className="text-xs text-zinc-400 font-mono">
                        {s.artist} • {s.key} • {s.bpm} BPM
                      </span>
                    </div>
                    <Plus className="w-4 h-4 text-orange-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PRINT-ONLY STYLED SHEET (Visible when printing) */}
      <div className="hidden print:block text-black bg-white p-6 font-sans">
        <div className="border-b-2 border-black pb-2 mb-4">
          <h1 className="text-2xl font-black uppercase">{currentSetlist.name}</h1>
          <p className="text-xs font-mono">
            Target Time: {currentSetlist.targetStartTime || '20:30'} - {currentSetlist.targetCurfewTime || '23:30'} • Total: {formatDuration(totalStagePerformanceSec)}
          </p>
        </div>

        {/* Print Set 1 */}
        <div className="mb-4">
          <h2 className="text-sm font-black uppercase bg-gray-200 p-1.5 border border-black mb-2">
            SET 1 (14 TRACKS • {formatDuration(set1DurationSec)})
          </h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">#</th>
                <th className="py-1">Song</th>
                <th className="py-1">Key</th>
                <th className="py-1">BPM</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {set1Items.map((it, idx) => {
                const s = allSongs.find((x) => x.id === it.songId);
                return (
                  <tr key={it.songId} className="border-b border-gray-300">
                    <td className="py-1 font-bold">{idx + 1}</td>
                    <td className="py-1 font-bold">{s?.title}</td>
                    <td className="py-1">{s?.key}</td>
                    <td className="py-1">{s?.bpm}</td>
                    <td className="py-1 italic">{it.customNotes || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Print Intermission */}
        <div className="p-2 border border-black bg-gray-100 font-bold text-xs text-center my-3">
          *** {currentSetlist.intermissionMinutes} MINUTE INTERMISSION / SET BREAK ***
        </div>

        {/* Print Set 2 */}
        <div className="mb-4">
          <h2 className="text-sm font-black uppercase bg-gray-200 p-1.5 border border-black mb-2">
            SET 2 (14 TRACKS • {formatDuration(set2DurationSec)})
          </h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">#</th>
                <th className="py-1">Song</th>
                <th className="py-1">Key</th>
                <th className="py-1">BPM</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {set2Items.map((it, idx) => {
                const s = allSongs.find((x) => x.id === it.songId);
                return (
                  <tr key={it.songId} className="border-b border-gray-300">
                    <td className="py-1 font-bold">{idx + 15}</td>
                    <td className="py-1 font-bold">{s?.title}</td>
                    <td className="py-1">{s?.key}</td>
                    <td className="py-1">{s?.bpm}</td>
                    <td className="py-1 italic">{it.customNotes || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Print Encore */}
        <div className="mb-4">
          <h2 className="text-sm font-black uppercase bg-gray-200 p-1.5 border border-black mb-2">
            ENCORE ({formatDuration(encoreDurationSec)})
          </h2>
          <table className="w-full text-xs text-left border-collapse">
            <tbody>
              {encoreItems.map((it, idx) => {
                const s = allSongs.find((x) => x.id === it.songId);
                return (
                  <tr key={it.songId} className="border-b border-gray-300">
                    <td className="py-1 font-bold">29</td>
                    <td className="py-1 font-bold">{s?.title}</td>
                    <td className="py-1">{s?.key}</td>
                    <td className="py-1">{s?.bpm}</td>
                    <td className="py-1 italic">{it.customNotes || 'Grand Finale!'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* AI Importer Modal */}
      <AiSongImporterModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSongImported={(newSong) => {
          handleAddSong(newSong.id, 'Set 1');
        }}
        onBatchImported={(newSongs) => {
          // reload updated setlist from db
          const updated = stageDb.getActiveSetlist();
          if (updated) {
            setCurrentSetlist(updated);
            onUpdateSetlist(updated);
          }
        }}
      />
    </div>
  );
};
