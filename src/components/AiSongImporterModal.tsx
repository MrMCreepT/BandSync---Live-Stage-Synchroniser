import React, { useState } from 'react';
import { Song, Setlist } from '../types';
import { aiTrackService, PlaylistAnalysisResult } from '../services/aiTrackService';
import { stageDb } from '../services/db';
import { syncService } from '../services/syncService';
import {
  Sparkles,
  X,
  Link2,
  Music,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ListPlus,
  Play,
  FileText,
  Layers,
  ArrowRight,
  RefreshCw,
  Plus,
} from 'lucide-react';

interface AiSongImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongImported?: (newSong: Song) => void;
  onBatchImported?: (newSongs: Song[]) => void;
  currentSongToReplace?: Song;
}

export const AiSongImporterModal: React.FC<AiSongImporterModalProps> = ({
  isOpen,
  onClose,
  onSongImported,
  onBatchImported,
  currentSongToReplace,
}) => {
  const [mode, setMode] = useState<'single' | 'playlist'>('single');
  const [inputQuery, setInputQuery] = useState<string>('');
  const [customKey, setCustomKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Single Song Analysis Result
  const [analyzedSong, setAnalyzedSong] = useState<Song | null>(null);

  // Playlist Analysis Result
  const [analyzedPlaylist, setAnalyzedPlaylist] = useState<PlaylistAnalysisResult | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentTitle: string } | null>(null);

  if (!isOpen) return null;

  const handleAnalyzeSingleTrack = async () => {
    if (!inputQuery.trim()) {
      setError('Please paste a song link or enter a song title & artist.');
      return;
    }

    setError(null);
    setLoading(true);
    setAnalyzedSong(null);

    try {
      setLoadingStep('Connecting to AI Song Engine & analyzing track catalog...');
      const song = await aiTrackService.analyzeTrack(inputQuery.trim(), customKey.trim() || undefined);
      setAnalyzedSong(song);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to analyze track. Please check the link or song title.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleAnalyzePlaylist = async () => {
    if (!inputQuery.trim()) {
      setError('Please paste a YouTube Music / Spotify playlist link or setlist text.');
      return;
    }

    setError(null);
    setLoading(true);
    setAnalyzedPlaylist(null);

    try {
      setLoadingStep('Extracting tracklist from playlist link...');
      const playlist = await aiTrackService.analyzePlaylist(inputQuery.trim());
      setAnalyzedPlaylist(playlist);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to analyze playlist.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleSaveSingleSong = (action: 'add_library' | 'add_setlist' | 'replace') => {
    if (!analyzedSong) return;

    if (action === 'replace' && currentSongToReplace) {
      const updated = {
        ...analyzedSong,
        id: currentSongToReplace.id,
      };
      stageDb.saveSong(updated);
      syncService.broadcastTrackUpdate(updated);
      if (onSongImported) onSongImported(updated);
    } else {
      stageDb.saveSong(analyzedSong);
      syncService.broadcastTrackUpdate(analyzedSong);

      if (action === 'add_setlist') {
        const activeSetlist = stageDb.getActiveSetlist();
        if (activeSetlist) {
          const updatedSetlist: Setlist = {
            ...activeSetlist,
            items: [...activeSetlist.items, { songId: analyzedSong.id, setGroup: 'Set 1' }],
            updatedAt: Date.now(),
          };
          stageDb.saveSetlist(updatedSetlist);
          syncService.broadcastSetlistUpdate(updatedSetlist);
        }
      }

      if (onSongImported) onSongImported(analyzedSong);
    }

    onClose();
  };

  const handleBatchImportAll = async () => {
    if (!analyzedPlaylist || analyzedPlaylist.tracks.length === 0) return;

    setLoading(true);
    setError(null);
    const importedSongs: Song[] = [];

    for (let i = 0; i < analyzedPlaylist.tracks.length; i++) {
      const track = analyzedPlaylist.tracks[i];
      setBatchProgress({
        current: i + 1,
        total: analyzedPlaylist.tracks.length,
        currentTitle: `${track.title} - ${track.artist}`,
      });

      try {
        const query = `${track.title} by ${track.artist}`;
        const song = await aiTrackService.analyzeTrack(query, track.suggestedKey);
        stageDb.saveSong(song);
        importedSongs.push(song);
      } catch (err) {
        console.error(`Failed importing ${track.title}:`, err);
      }
    }

    // Add all to setlist
    if (importedSongs.length > 0) {
      const activeSetlist = stageDb.getActiveSetlist();
      if (activeSetlist) {
        const newItems = importedSongs.map((s, idx) => {
          const matchingTrack = analyzedPlaylist.tracks[idx];
          return {
            songId: s.id,
            setGroup: matchingTrack?.setGroup || (idx < 12 ? 'Set 1' : 'Set 2'),
          };
        });

        const updatedSetlist: Setlist = {
          ...activeSetlist,
          items: [...activeSetlist.items, ...newItems],
          updatedAt: Date.now(),
        };
        stageDb.saveSetlist(updatedSetlist);
        syncService.broadcastSetlistUpdate(updatedSetlist);
      }

      if (onBatchImported) {
        onBatchImported(importedSongs);
      }
    }

    setLoading(false);
    setBatchProgress(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-black shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                AI Song & Playlist Importer
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono">
                  Gemini Flash 3.7
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Paste YouTube Music, Spotify, Apple links, or song titles for full chords, lyrics & cues
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800">
            <button
              onClick={() => {
                setMode('single');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                mode === 'single'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music className="w-4 h-4" />
              Single Song / Track Link
            </button>
            <button
              onClick={() => {
                setMode('playlist');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                mode === 'playlist'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListPlus className="w-4 h-4" />
              Playlist / Full Setlist Link
            </button>
          </div>

          {/* Input Field Area */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              {mode === 'single'
                ? 'YouTube Music Link, YouTube URL, or Song Title & Artist'
                : 'YouTube Music / Spotify Link, or Paste Full Setlist Text'}
            </label>

            {mode === 'single' ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder='e.g. https://music.youtube.com/watch?v=... or "Valerie by Amy Winehouse"'
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !loading) {
                        handleAnalyzeSingleTrack();
                      }
                    }}
                  />
                </div>

                <div className="w-28 shrink-0">
                  <input
                    type="text"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="Key (opt)"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 font-mono text-center"
                    title="Optional: Target musical key (e.g. E min, G major)"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder={`Paste YouTube Music playlist URL or paste your band's setlist:\n1. Valerie - Amy Winehouse\n2. Superstition - Stevie Wonder\n3. Sex on Fire - Kings of Leon\n4. Mr. Brightside - The Killers`}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 font-mono leading-relaxed resize-none"
                />
              </div>
            )}

            {/* Quick Suggestions */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-500">
              <span>Try real examples:</span>
              <button
                onClick={() => setInputQuery('Valerie by Amy Winehouse')}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] cursor-pointer"
              >
                "Valerie"
              </button>
              <button
                onClick={() => setInputQuery('Mr. Brightside by The Killers')}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] cursor-pointer"
              >
                "Mr. Brightside"
              </button>
              <button
                onClick={() => setInputQuery('Sex on Fire by Kings of Leon')}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] cursor-pointer"
              >
                "Sex on Fire"
              </button>
              <button
                onClick={() => setInputQuery('Tennessee Whiskey by Chris Stapleton')}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] cursor-pointer"
              >
                "Tennessee Whiskey"
              </button>
            </div>

            {/* Action Trigger Button */}
            <button
              onClick={mode === 'single' ? handleAnalyzeSingleTrack : handleAnalyzePlaylist}
              disabled={loading || !inputQuery.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {mode === 'single' ? 'Analyze & Extract Full Song' : 'Extract Playlist Songs'}
                </>
              )}
            </button>
          </div>

          {/* Loading Indicator with Step Details */}
          {loading && (
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs space-y-2 animate-pulse">
              <div className="flex items-center gap-2 font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                <span>AI Live Transcriber in Progress</span>
              </div>
              <p className="text-zinc-300 font-mono text-[11px]">{loadingStep || 'Generating full song structure & lyrics...'}</p>
              {batchProgress && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                    <span>Batch Importing: {batchProgress.currentTitle}</span>
                    <span>{batchProgress.current} / {batchProgress.total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SINGLE SONG RESULT PREVIEW */}
          {analyzedSong && (
            <div className="space-y-4 border border-zinc-800 rounded-2xl p-4 bg-zinc-900/50">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    {analyzedSong.title}
                    <span className="text-xs font-normal text-zinc-400">by {analyzedSong.artist}</span>
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 mt-1">
                    <span>Key: <strong className="text-orange-400">{analyzedSong.key}</strong></span>
                    <span>Tempo: <strong className="text-orange-400">{analyzedSong.bpm} BPM</strong></span>
                    <span>Time: <strong className="text-orange-400">{analyzedSong.timeSignature}</strong></span>
                    <span>{analyzedSong.sections.length} Sections</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentSongToReplace && (
                    <button
                      onClick={() => handleSaveSingleSong('replace')}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-bold hover:bg-red-500/30 cursor-pointer"
                    >
                      Replace "{currentSongToReplace.title}"
                    </button>
                  )}
                  <button
                    onClick={() => handleSaveSingleSong('add_setlist')}
                    className="px-3.5 py-1.5 rounded-lg bg-orange-500 text-black font-black text-xs hover:bg-orange-400 shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add to Setlist
                  </button>
                </div>
              </div>

              {/* Sections Breakdown Accordion */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Full Transcribed Sections ({analyzedSong.sections.length})
                </div>

                {analyzedSong.sections.map((sec, sIdx) => (
                  <div key={sec.id || sIdx} className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-black uppercase"
                          style={{ backgroundColor: `${sec.color}22`, color: sec.color }}
                        >
                          {sec.name} ({sec.bars} bars)
                        </span>
                      </div>
                      {sec.chords && (
                        <span className="font-mono text-amber-400 font-bold text-xs">{sec.chords}</span>
                      )}
                    </div>

                    {sec.lyrics && (
                      <p className="text-xs text-zinc-300 italic whitespace-pre-wrap leading-relaxed pl-2 border-l-2 border-zinc-800">
                        {sec.lyrics}
                      </p>
                    )}

                    {sec.bassTab && (
                      <div className="bg-black/80 rounded p-1.5 font-mono text-[10px] text-cyan-300 overflow-x-auto whitespace-pre">
                        {sec.bassTab}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLAYLIST BATCH RESULT PREVIEW */}
          {analyzedPlaylist && (
            <div className="space-y-4 border border-zinc-800 rounded-2xl p-4 bg-zinc-900/50">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-base font-black text-white">
                    {analyzedPlaylist.playlistTitle}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Found {analyzedPlaylist.tracks.length} tracks ready for batch harmonic analysis & import.
                  </p>
                </div>

                <button
                  onClick={handleBatchImportAll}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-orange-500 text-black font-black text-xs hover:bg-orange-400 shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <ListPlus className="w-4 h-4" />
                  Import All {analyzedPlaylist.tracks.length} Songs to Setlist
                </button>
              </div>

              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {analyzedPlaylist.tracks.map((trk, tIdx) => (
                  <div
                    key={tIdx}
                    className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center font-mono text-[10px] font-bold">
                        {tIdx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-white">{trk.title}</div>
                        <div className="text-[11px] text-zinc-400">{trk.artist}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
                      {trk.suggestedKey && (
                        <span className="text-amber-400 font-bold">{trk.suggestedKey}</span>
                      )}
                      {trk.suggestedBpm && <span>{trk.suggestedBpm} BPM</span>}
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px]">
                        {trk.setGroup || 'Set 1'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-zinc-400 font-medium">BandSync AI Auto-Charting Engine</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
