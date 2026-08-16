import { Song, Setlist, GigEvent, StageRider, BandProfile, AudioMixConfig, MidiMapping, InstrumentRole } from '../types';
import {
  ALL_DEFAULT_SONGS,
  DEFAULT_SETLISTS,
  HOTT_SHOTS_AUGUST_SETLIST,
  SAMPLE_GIGS,
  SAMPLE_STAGE_RIDER,
  SAMPLE_BAND_PROFILE,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_MIDI_MAPPINGS,
} from '../constants';

const DB_KEYS = {
  SONGS: 'bandsync_songs_v2',
  SETLISTS: 'bandsync_setlists_v2',
  ACTIVE_SETLIST_ID: 'bandsync_active_setlist_id_v2',
  GIGS: 'bandsync_gigs_v1',
  STAGE_RIDER: 'bandsync_stage_rider_v1',
  BAND_PROFILE: 'bandsync_band_profile_v1',
  AUDIO_CONFIG: 'bandsync_audio_config_v1',
  MIDI_MAPPINGS: 'bandsync_midi_mappings_v1',
  CURRENT_PERFORMER_ID: 'bandsync_current_performer_id',
};

class StageDatabase {
  private isLoaded: boolean = false;

  constructor() {
    this.initDefaults();
  }

  private initDefaults() {
    if (typeof localStorage === 'undefined') return;

    // Migrate or initialize songs (purely authentic songs, removing any mock IDs)
    const storedSongsJson = localStorage.getItem(DB_KEYS.SONGS);
    if (!storedSongsJson) {
      localStorage.setItem(DB_KEYS.SONGS, JSON.stringify(ALL_DEFAULT_SONGS));
    } else {
      try {
        let storedSongs: Song[] = JSON.parse(storedSongsJson);
        // Remove mock song IDs if present from previous templates
        const mockIds = new Set(['song_1', 'song_2', 'song_3', 'song_4']);
        storedSongs = storedSongs.filter((s) => !mockIds.has(s.id));
        let changed = true;
        ALL_DEFAULT_SONGS.forEach((defaultSong) => {
          const existingIdx = storedSongs.findIndex((s) => s.id === defaultSong.id);
          if (existingIdx === -1) {
            storedSongs.push(defaultSong);
            changed = true;
          } else if ((defaultSong.sections?.length || 0) > (storedSongs[existingIdx].sections?.length || 0) || !storedSongs[existingIdx].sections?.[0]?.chords) {
            storedSongs[existingIdx] = defaultSong;
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem(DB_KEYS.SONGS, JSON.stringify(storedSongs));
        }
      } catch {
        localStorage.setItem(DB_KEYS.SONGS, JSON.stringify(ALL_DEFAULT_SONGS));
      }
    }

    // Migrate or initialize setlists
    const storedSetlistsJson = localStorage.getItem(DB_KEYS.SETLISTS);
    if (!storedSetlistsJson) {
      localStorage.setItem(DB_KEYS.SETLISTS, JSON.stringify(DEFAULT_SETLISTS));
    } else {
      try {
        const storedSetlists: Setlist[] = JSON.parse(storedSetlistsJson);
        const existingSetlistIds = new Set(storedSetlists.map((s) => s.id));
        let changed = false;
        
        // Upgrade Hott Shots setlist if present
        const hottIdx = storedSetlists.findIndex((s) => s.id === HOTT_SHOTS_AUGUST_SETLIST.id);
        if (hottIdx >= 0) {
          storedSetlists[hottIdx] = HOTT_SHOTS_AUGUST_SETLIST;
          changed = true;
        } else {
          storedSetlists.unshift(HOTT_SHOTS_AUGUST_SETLIST);
          changed = true;
        }

        DEFAULT_SETLISTS.forEach((defaultSetlist) => {
          if (!existingSetlistIds.has(defaultSetlist.id)) {
            storedSetlists.push(defaultSetlist);
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem(DB_KEYS.SETLISTS, JSON.stringify(storedSetlists));
        }
      } catch {
        localStorage.setItem(DB_KEYS.SETLISTS, JSON.stringify(DEFAULT_SETLISTS));
      }
    }

    const activeId = localStorage.getItem(DB_KEYS.ACTIVE_SETLIST_ID);
    if (!activeId || activeId === 'setlist_main') {
      localStorage.setItem(DB_KEYS.ACTIVE_SETLIST_ID, HOTT_SHOTS_AUGUST_SETLIST.id);
    }
    if (!localStorage.getItem(DB_KEYS.GIGS)) {
      localStorage.setItem(DB_KEYS.GIGS, JSON.stringify(SAMPLE_GIGS));
    }
    if (!localStorage.getItem(DB_KEYS.STAGE_RIDER)) {
      localStorage.setItem(DB_KEYS.STAGE_RIDER, JSON.stringify(SAMPLE_STAGE_RIDER));
    }
    if (!localStorage.getItem(DB_KEYS.BAND_PROFILE)) {
      localStorage.setItem(DB_KEYS.BAND_PROFILE, JSON.stringify(SAMPLE_BAND_PROFILE));
    } else {
      try {
        const storedProfile = JSON.parse(localStorage.getItem(DB_KEYS.BAND_PROFILE) || '{}');
        if (storedProfile.name === 'NEON SKYLINE' || !storedProfile.members?.some((m: any) => m.name.includes('Mart') || m.name.includes('Rosie'))) {
          localStorage.setItem(DB_KEYS.BAND_PROFILE, JSON.stringify(SAMPLE_BAND_PROFILE));
        }
      } catch {
        localStorage.setItem(DB_KEYS.BAND_PROFILE, JSON.stringify(SAMPLE_BAND_PROFILE));
      }
    }
    if (!localStorage.getItem(DB_KEYS.AUDIO_CONFIG)) {
      localStorage.setItem(DB_KEYS.AUDIO_CONFIG, JSON.stringify(DEFAULT_AUDIO_CONFIG));
    }
    if (!localStorage.getItem(DB_KEYS.MIDI_MAPPINGS)) {
      localStorage.setItem(DB_KEYS.MIDI_MAPPINGS, JSON.stringify(DEFAULT_MIDI_MAPPINGS));
    }
    if (!localStorage.getItem(DB_KEYS.CURRENT_PERFORMER_ID)) {
      localStorage.setItem(DB_KEYS.CURRENT_PERFORMER_ID, 'm_1');
    }

    this.isLoaded = true;
  }

  // --- Songs ---
  public getSongs(): Song[] {
    try {
      const data = localStorage.getItem(DB_KEYS.SONGS);
      return data ? JSON.parse(data) : ALL_DEFAULT_SONGS;
    } catch {
      return ALL_DEFAULT_SONGS;
    }
  }

  public getSongById(id: string): Song | undefined {
    return this.getSongs().find((s) => s.id === id);
  }

  public saveSong(song: Song) {
    const songs = this.getSongs();
    const index = songs.findIndex((s) => s.id === song.id);
    if (index >= 0) {
      songs[index] = { ...song, updatedAt: Date.now() };
    } else {
      songs.push({ ...song, updatedAt: Date.now() });
    }
    localStorage.setItem(DB_KEYS.SONGS, JSON.stringify(songs));
  }

  public deleteSong(id: string) {
    const songs = this.getSongs().filter((s) => s.id !== id);
    localStorage.setItem(DB_KEYS.SONGS, JSON.stringify(songs));
  }

  // --- Setlists ---
  public getSetlists(): Setlist[] {
    try {
      const data = localStorage.getItem(DB_KEYS.SETLISTS);
      return data ? JSON.parse(data) : DEFAULT_SETLISTS;
    } catch {
      return DEFAULT_SETLISTS;
    }
  }

  public getActiveSetlist(): Setlist {
    const setlists = this.getSetlists();
    const activeId = localStorage.getItem(DB_KEYS.ACTIVE_SETLIST_ID);
    return setlists.find((s) => s.id === activeId) || setlists[0] || HOTT_SHOTS_AUGUST_SETLIST;
  }

  public setActiveSetlistId(id: string) {
    localStorage.setItem(DB_KEYS.ACTIVE_SETLIST_ID, id);
  }

  public saveSetlist(setlist: Setlist) {
    const setlists = this.getSetlists();
    const index = setlists.findIndex((s) => s.id === setlist.id);
    if (index >= 0) {
      setlists[index] = { ...setlist, updatedAt: Date.now() };
    } else {
      setlists.push({ ...setlist, updatedAt: Date.now() });
    }
    localStorage.setItem(DB_KEYS.SETLISTS, JSON.stringify(setlists));
  }

  public deleteSetlist(id: string) {
    const setlists = this.getSetlists().filter((s) => s.id !== id);
    localStorage.setItem(DB_KEYS.SETLISTS, JSON.stringify(setlists));
  }

  // --- Gigs ---
  public getGigs(): GigEvent[] {
    try {
      const data = localStorage.getItem(DB_KEYS.GIGS);
      return data ? JSON.parse(data) : SAMPLE_GIGS;
    } catch {
      return SAMPLE_GIGS;
    }
  }

  public saveGig(gig: GigEvent) {
    const gigs = this.getGigs();
    const idx = gigs.findIndex((g) => g.id === gig.id);
    if (idx >= 0) {
      gigs[idx] = gig;
    } else {
      gigs.push(gig);
    }
    localStorage.setItem(DB_KEYS.GIGS, JSON.stringify(gigs));
  }

  public deleteGig(id: string) {
    const gigs = this.getGigs().filter((g) => g.id !== id);
    localStorage.setItem(DB_KEYS.GIGS, JSON.stringify(gigs));
  }

  // --- Stage Rider & Tech Plot ---
  public getStageRider(): StageRider {
    try {
      const data = localStorage.getItem(DB_KEYS.STAGE_RIDER);
      return data ? JSON.parse(data) : SAMPLE_STAGE_RIDER;
    } catch {
      return SAMPLE_STAGE_RIDER;
    }
  }

  public saveStageRider(rider: StageRider) {
    localStorage.setItem(DB_KEYS.STAGE_RIDER, JSON.stringify(rider));
  }

  // --- Band Profile & Current User ---
  public getBandProfile(): BandProfile {
    try {
      const data = localStorage.getItem(DB_KEYS.BAND_PROFILE);
      return data ? JSON.parse(data) : SAMPLE_BAND_PROFILE;
    } catch {
      return SAMPLE_BAND_PROFILE;
    }
  }

  public saveBandProfile(profile: BandProfile) {
    localStorage.setItem(DB_KEYS.BAND_PROFILE, JSON.stringify(profile));
  }

  public getCurrentPerformerId(): string {
    return localStorage.getItem(DB_KEYS.CURRENT_PERFORMER_ID) || 'm_1';
  }

  public setCurrentPerformerId(id: string) {
    localStorage.setItem(DB_KEYS.CURRENT_PERFORMER_ID, id);
  }

  public getUserRole(): InstrumentRole {
    try {
      const saved = localStorage.getItem('bandsync_user_role');
      if (saved) return saved as InstrumentRole;
      const profile = this.getBandProfile();
      const currentPerformer = profile.members.find((m) => m.id === this.getCurrentPerformerId()) || profile.members[0];
      return currentPerformer ? currentPerformer.role : 'bass';
    } catch {
      return 'bass';
    }
  }

  public saveUserRole(role: InstrumentRole) {
    localStorage.setItem('bandsync_user_role', role);
  }

  // --- Audio Config ---
  public getAudioConfig(): AudioMixConfig {
    try {
      const data = localStorage.getItem(DB_KEYS.AUDIO_CONFIG);
      return data ? JSON.parse(data) : DEFAULT_AUDIO_CONFIG;
    } catch {
      return DEFAULT_AUDIO_CONFIG;
    }
  }

  public saveAudioConfig(config: AudioMixConfig) {
    localStorage.setItem(DB_KEYS.AUDIO_CONFIG, JSON.stringify(config));
  }

  // --- Export & Import ---
  public exportFullBackup(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      band: this.getBandProfile(),
      songs: this.getSongs(),
      setlists: this.getSetlists(),
      gigs: this.getGigs(),
      stageRider: this.getStageRider(),
      audioConfig: this.getAudioConfig(),
    };
    return JSON.stringify(backup, null, 2);
  }

  public importFullBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.songs) localStorage.setItem(DB_KEYS.SONGS, JSON.stringify(parsed.songs));
      if (parsed.setlists) localStorage.setItem(DB_KEYS.SETLISTS, JSON.stringify(parsed.setlists));
      if (parsed.gigs) localStorage.setItem(DB_KEYS.GIGS, JSON.stringify(parsed.gigs));
      if (parsed.stageRider) localStorage.setItem(DB_KEYS.STAGE_RIDER, JSON.stringify(parsed.stageRider));
      if (parsed.band) localStorage.setItem(DB_KEYS.BAND_PROFILE, JSON.stringify(parsed.band));
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  }

  public resetToFactoryDefaults() {
    localStorage.clear();
    this.initDefaults();
  }
}

export const stageDb = new StageDatabase();
