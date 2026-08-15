import React from 'react';
import { InstrumentRole, BandProfile } from '../types';
import { ROLE_DEFINITIONS } from '../constants';
import {
  Radio,
  Wifi,
  Zap,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Play,
  Layers,
  Calendar,
  Settings,
  Music,
  Sparkles,
} from 'lucide-react';

interface BandSyncHeaderProps {
  currentTab: 'stage' | 'setlist' | 'editor' | 'gigs' | 'settings';
  onSelectTab: (tab: 'stage' | 'setlist' | 'editor' | 'gigs' | 'settings') => void;
  bandProfile: BandProfile;
  currentRole: InstrumentRole;
  onChangeRole: (role: InstrumentRole) => void;
  isMaster: boolean;
  onOpenSyncModal: () => void;
  onOpenMidiModal: () => void;
  onOpenAudioMixModal: () => void;
  onOpenAiModal: () => void;
  onQuickEmergencyCue: () => void;
  isAudioUnlocked: boolean;
  onUnlockAudio: () => void;
  syncConnected: boolean;
  clockOffsetMs: number;
  midiConnected: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const BandSyncHeader: React.FC<BandSyncHeaderProps> = ({
  currentTab,
  onSelectTab,
  bandProfile,
  currentRole,
  onChangeRole,
  isMaster,
  onOpenSyncModal,
  onOpenMidiModal,
  onOpenAudioMixModal,
  onOpenAiModal,
  onQuickEmergencyCue,
  isAudioUnlocked,
  onUnlockAudio,
  syncConnected,
  clockOffsetMs,
  midiConnected,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const currentRoleDef = ROLE_DEFINITIONS.find((r) => r.id === currentRole) || ROLE_DEFINITIONS[0];

  return (
    <header className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-md border-b border-zinc-800 text-zinc-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left Branding & Role Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-black text-sm text-black italic shadow-md shadow-orange-500/20">
              B
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black tracking-tight text-white text-base font-mono">BANDSYNC</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-orange-400 font-mono">
                  LIVE
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 font-medium truncate block max-w-[140px]">
                {bandProfile.name}
              </span>
            </div>
          </div>

          {/* Quick Performer Role Dropdown */}
          <div className="relative">
            <select
              id="select-performer-role-header"
              value={currentRole}
              onChange={(e) => onChangeRole(e.target.value as InstrumentRole)}
              className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 pr-6 cursor-pointer focus:outline-none focus:border-orange-500 transition-colors"
              style={{ color: currentRoleDef.defaultColor }}
            >
              {ROLE_DEFINITIONS.map((r) => {
                const assignedMusician = bandProfile.members.find((m) => m.role === r.id);
                return (
                  <option key={r.id} value={r.id} className="bg-zinc-900 text-white">
                    {assignedMusician ? `${assignedMusician.name} • ` : ''}{r.shortLabel} ({r.label})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Center Main Nav Tabs */}
        <nav className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
          <button
            id="tab-btn-stage-hud"
            onClick={() => onSelectTab('stage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'stage'
                ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>STAGE HUD</span>
          </button>

          <button
            id="tab-btn-setlist"
            onClick={() => onSelectTab('setlist')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'setlist'
                ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SETLIST</span>
          </button>

          <button
            id="tab-btn-editor"
            onClick={() => onSelectTab('editor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'editor'
                ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TRACK BUILDER</span>
          </button>

          <button
            id="tab-btn-gigs"
            onClick={() => onSelectTab('gigs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'gigs'
                ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden md:inline">GIG & RIDER</span>
          </button>

          <button
            id="tab-btn-settings"
            onClick={() => onSelectTab('settings')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </nav>

        {/* Right Status & Control Badges */}
        <div className="flex items-center gap-2">
          {/* Audio Engine Unlock Pill */}
          {!isAudioUnlocked ? (
            <button
              id="btn-unlock-audio-header"
              onClick={onUnlockAudio}
              className="px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-black text-xs animate-bounce flex items-center gap-1 cursor-pointer shadow-lg shadow-orange-500/30"
            >
              <Volume2 className="w-3.5 h-3.5" /> TAP TO ENABLE AUDIO
            </button>
          ) : (
            <button
              id="btn-open-audio-mix"
              onClick={onOpenAudioMixModal}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
              title="Performer In-Ear Audio Mix"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          {/* Wi-Fi NTP Sync Status Pill */}
          <button
            id="btn-open-sync-status"
            onClick={onOpenSyncModal}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              syncConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
            title="Wi-Fi Clock Sync Status"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block mr-0.5" />
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {syncConnected ? `SYNC (${clockOffsetMs >= 0 ? `+${clockOffsetMs}` : clockOffsetMs}ms)` : 'OFFLINE'}
            </span>
          </button>

          {/* MIDI Pedal Pill */}
          <button
            id="btn-open-midi-modal"
            onClick={onOpenMidiModal}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              midiConnected
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Web MIDI & Foot Pedal Controller"
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* AI Track & Playlist Importer */}
          <button
            id="btn-open-ai-importer-header"
            onClick={onOpenAiModal}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-500/40 text-orange-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
            title="Import Full Song or Playlist with AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">AI IMPORT</span>
          </button>

          {/* Master Badge */}
          <button
            onClick={onOpenSyncModal}
            className={`px-2 py-1 rounded text-[10px] font-black uppercase cursor-pointer border ${
              isMaster
                ? 'bg-orange-500 text-black border-orange-500 font-black'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
          >
            {isMaster ? 'MASTER' : 'CLIENT'}
          </button>

          {/* Emergency Stage Cue Broadcast Quick Trigger */}
          <button
            id="btn-quick-emergency-cue"
            onClick={onQuickEmergencyCue}
            className="px-2.5 py-1 rounded-lg bg-red-700/80 hover:bg-red-600 border border-red-500/60 text-white font-black text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-red-600/30"
            title="Broadcast Emergency Stage Cue"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">STAGE CUE</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            id="btn-toggle-fullscreen"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Toggle Stage Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
