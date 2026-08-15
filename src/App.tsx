import React, { useState, useEffect, useCallback } from 'react';
import {
  Song,
  Setlist,
  GigEvent,
  StageRider,
  BandProfile,
  InstrumentRole,
  EmergencyCueEvent,
  AudioMixConfig,
} from './types';
import { stageDb } from './services/db';
import { syncService } from './services/syncService';
import { audioEngine } from './services/audioEngine';
import { midiService } from './services/midiService';

import { BandSyncHeader } from './components/BandSyncHeader';
import { StageHUD } from './components/StageHUD';
import { TrackEditor } from './components/TrackEditor';
import { SetlistOptimizer } from './components/SetlistOptimizer';
import { GigHub } from './components/GigHub';
import { BandSettings } from './components/BandSettings';

import { EmergencyBanner } from './components/EmergencyBanner';
import { AudioMixModal } from './components/AudioMixModal';
import { MidiModal } from './components/MidiModal';
import { SyncModal } from './components/SyncModal';
import { AiSongImporterModal } from './components/AiSongImporterModal';

export default function App() {
  // Navigation
  const [currentTab, setCurrentTab] = useState<'stage' | 'setlist' | 'editor' | 'gigs' | 'settings'>('stage');

  // Core Data State
  const [songs, setSongs] = useState<Song[]>(() => stageDb.getSongs());
  const [setlists, setSetlists] = useState<Setlist[]>(() => stageDb.getSetlists());
  const [activeSetlistId, setActiveSetlistId] = useState<string>(() => stageDb.getSetlists()[0]?.id || '');
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);
  const [gigs, setGigs] = useState<GigEvent[]>(() => stageDb.getGigs());
  const [stageRider, setStageRider] = useState<StageRider>(() => stageDb.getStageRider());
  const [bandProfile, setBandProfile] = useState<BandProfile>(() => stageDb.getBandProfile());

  // Performer Role & Device Designation
  const [currentRole, setCurrentRole] = useState<InstrumentRole>(() => stageDb.getUserRole());
  const [currentPerformerId, setCurrentPerformerId] = useState<string>(() => stageDb.getBandProfile().members[0]?.id || 'm_1');
  const [isMaster, setIsMaster] = useState<boolean>(true);

  // Hardware & Network State
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);
  const [syncConnected, setSyncConnected] = useState<boolean>(false);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [roundTripLatencyMs, setRoundTripLatencyMs] = useState<number>(0);
  const [connectedClientsCount, setConnectedClientsCount] = useState<number>(1);
  const [midiConnected, setMidiConnected] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Emergency Visual Alert Overlay State
  const [activeEmergencyCue, setActiveEmergencyCue] = useState<EmergencyCueEvent | null>(null);

  // Modals & Audio Config
  const [audioConfig, setAudioConfig] = useState<AudioMixConfig>(stageDb.getAudioConfig());
  const [showAudioMixModal, setShowAudioMixModal] = useState<boolean>(false);
  const [showMidiModal, setShowMidiModal] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [showAiImporterModal, setShowAiImporterModal] = useState<boolean>(false);

  // Load initial database data
  useEffect(() => {
    const loadedSongs = stageDb.getSongs();
    const loadedSetlists = stageDb.getSetlists();
    const loadedGigs = stageDb.getGigs();
    const loadedRider = stageDb.getStageRider();
    const loadedProfile = stageDb.getBandProfile();
    const userRole = stageDb.getUserRole();

    setSongs(loadedSongs);
    setSetlists(loadedSetlists);
    setActiveSetlistId(loadedSetlists[0]?.id || '');
    setGigs(loadedGigs);
    setStageRider(loadedRider);
    setBandProfile(loadedProfile);
    setCurrentRole(userRole);

    // Check if current device is configured as master
    const masterMember = loadedProfile.members.find((m) => m.isMaster);
    if (masterMember) {
      setCurrentPerformerId(masterMember.id);
      setIsMaster(true);
    }
  }, []);

  // Initialize Sync Service (Local WebSocket LAN Bridge)
  useEffect(() => {
    syncService.connect();

    const unsubStatus = syncService.onStatusChange((status) => {
      setSyncConnected(status.connected);
      setClockOffsetMs(status.offsetMs);
      setRoundTripLatencyMs(status.roundTripLatencyMs);
      setConnectedClientsCount(status.clientCount);
    });

    const unsubSync = syncService.onSyncEvent((event) => {
      if (event.type === 'EMERGENCY_CUE') {
        setActiveEmergencyCue(event);
      } else if (event.type === 'UPDATE_SETLIST') {
        if (event.setlist) {
          setSetlists((prev) =>
            prev.map((s) => (s.id === event.setlist!.id ? event.setlist! : s))
          );
        }
      } else if (event.type === 'UPDATE_TRACK') {
        if (event.track) {
          setSongs((prev) =>
            prev.map((s) => (s.id === event.track!.id ? event.track! : s))
          );
        }
      }
    });

    return () => {
      unsubStatus();
      unsubSync();
      syncService.disconnect();
    };
  }, []);

  // Initialize Web MIDI API
  useEffect(() => {
    midiService.init().then((success) => {
      setMidiConnected(success && midiService.getInputs().length > 0);
    });
  }, []);

  // Unlock Web Audio Context on first click
  const handleUnlockAudio = useCallback(() => {
    audioEngine.initContext();
    setIsAudioUnlocked(true);
  }, []);

  // Global Keybindings for stage control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys if typing in input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleUnlockAudio();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        setActiveEmergencyCue(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUnlockAudio]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const fallbackSetlist: Setlist = {
    id: 'default_setlist',
    name: 'Main Set',
    interSongBufferSec: 20,
    items: songs.map((s) => ({ songId: s.id })),
    updatedAt: Date.now(),
  };
  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || setlists[0] || fallbackSetlist;
  const currentSongId = activeSetlist?.items?.[currentSongIndex]?.songId || songs[0]?.id;
  const currentSong = songs.find((s) => s.id === currentSongId) || songs[0] || null;

  const handleChangeRole = (newRole: InstrumentRole) => {
    setCurrentRole(newRole);
    stageDb.saveUserRole(newRole);
  };

  const handleSelectSongForStage = (songId: string, index: number) => {
    setCurrentSongIndex(index);
    setCurrentTab('stage');
    if (isMaster) {
      syncService.broadcastChangeSong(songId, index);
    }
  };

  const handleUpdateSong = (updated: Song) => {
    const updatedSongs = songs.map((s) => (s.id === updated.id ? updated : s));
    setSongs(updatedSongs);
  };

  const handleUpdateSetlist = (updated: Setlist) => {
    const updatedSetlists = setlists.map((s) => (s.id === updated.id ? updated : s));
    setSetlists(updatedSetlists);
  };

  return (
    <div
      id="bandsync-app"
      className="min-h-screen bg-[#050505] text-zinc-100 font-sans flex flex-col selection:bg-orange-500/30 selection:text-white"
    >
      {/* Top Stage Header */}
      <BandSyncHeader
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        bandProfile={bandProfile}
        currentRole={currentRole}
        onChangeRole={handleChangeRole}
        isMaster={isMaster}
        onOpenSyncModal={() => setShowSyncModal(true)}
        onOpenMidiModal={() => setShowMidiModal(true)}
        onOpenAudioMixModal={() => setShowAudioMixModal(true)}
        onOpenAiModal={() => setShowAiImporterModal(true)}
        onQuickEmergencyCue={() => {
          syncService.broadcastEmergencyCue('REPEAT_CHORUS', 'REPEAT CHORUS', '#ef4444');
        }}
        isAudioUnlocked={isAudioUnlocked}
        onUnlockAudio={handleUnlockAudio}
        syncConnected={syncConnected}
        clockOffsetMs={clockOffsetMs}
        midiConnected={midiConnected}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Main Active Tab View */}
      <main className="flex-1 flex flex-col">
        {currentTab === 'stage' && (
          <StageHUD
            currentSong={currentSong}
            activeSetlist={activeSetlist}
            currentSongIndex={currentSongIndex}
            onSelectSongIndex={setCurrentSongIndex}
            currentRole={currentRole}
            onChangeRole={handleChangeRole}
            isMaster={isMaster}
            onOpenAudioMix={() => setShowAudioMixModal(true)}
            onOpenMidiModal={() => setShowMidiModal(true)}
          />
        )}

        {currentTab === 'setlist' && (
          <SetlistOptimizer
            setlist={activeSetlist}
            allSongs={songs}
            onUpdateSetlist={handleUpdateSetlist}
            onSelectSongForStage={handleSelectSongForStage}
          />
        )}

        {currentTab === 'editor' && (
          <TrackEditor
            song={currentSong || songs[0]}
            onSaveSong={handleUpdateSong}
            onBackToStage={() => setCurrentTab('stage')}
          />
        )}

        {currentTab === 'gigs' && (
          <GigHub
            gigs={gigs}
            stageRider={stageRider}
            bandProfile={bandProfile}
            onUpdateGigs={setGigs}
            onUpdateRider={setStageRider}
          />
        )}

        {currentTab === 'settings' && (
          <BandSettings
            bandProfile={bandProfile}
            onUpdateProfile={setBandProfile}
            onSelectPerformer={(id) => {
              setCurrentPerformerId(id);
              const m = bandProfile.members.find((x) => x.id === id);
              if (m) {
                setCurrentRole(m.role);
                setIsMaster(m.isMaster);
              }
            }}
            currentPerformerId={currentPerformerId}
          />
        )}
      </main>

      {/* Fullscreen Emergency Stage Visual Flash Overlay */}
      <EmergencyBanner
        currentCue={activeEmergencyCue}
        onDismiss={() => setActiveEmergencyCue(null)}
      />

      {/* In-Ear Audio Mix & Synthesizer Settings Modal */}
      <AudioMixModal
        isOpen={showAudioMixModal}
        onClose={() => setShowAudioMixModal(false)}
        config={audioConfig}
        onConfigChange={setAudioConfig}
      />

      {/* Web MIDI Controller & Foot Pedal Mapping Modal */}
      <MidiModal
        isOpen={showMidiModal}
        onClose={() => setShowMidiModal(false)}
      />

      {/* LAN Wi-Fi Synchronization & Master Device Modal */}
      <SyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        isMaster={isMaster}
        onToggleMaster={setIsMaster}
        currentRole={currentRole}
        currentName={bandProfile.members.find((m) => m.id === currentPerformerId)?.name || 'Performer'}
      />

      {/* AI Track & Playlist Importer Modal */}
      <AiSongImporterModal
        isOpen={showAiImporterModal}
        onClose={() => setShowAiImporterModal(false)}
        onSongImported={(newSong) => {
          const updatedSongs = stageDb.getSongs();
          setSongs(updatedSongs);
          const activeS = stageDb.getActiveSetlist();
          if (activeS) {
            setSetlists(stageDb.getSetlists());
          }
        }}
        onBatchImported={(newSongs) => {
          const updatedSongs = stageDb.getSongs();
          setSongs(updatedSongs);
          setSetlists(stageDb.getSetlists());
        }}
      />
    </div>
  );
}
