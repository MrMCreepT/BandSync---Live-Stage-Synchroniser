import { RoleDefinition, Song, Setlist, GigEvent, StageRider, BandProfile, AudioMixConfig, MidiMapping, EmergencyCueType } from './types';
import { HOTT_SHOTS_SONGS, HOTT_SHOTS_AUGUST_SETLIST } from './data/hottShotsSongs';

export { HOTT_SHOTS_SONGS, HOTT_SHOTS_AUGUST_SETLIST };

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  { id: 'drums', label: 'Drums & Percussion', shortLabel: 'DRUMS', iconName: 'Drum', defaultColor: '#f97316' },
  { id: 'bass', label: 'Bass Guitar', shortLabel: 'BASS', iconName: 'Activity', defaultColor: '#06b6d4' },
  { id: 'lead_guitar', label: 'Lead Guitar', shortLabel: 'LEAD GTR', iconName: 'Zap', defaultColor: '#eab308' },
  { id: 'rhythm_guitar', label: 'Rhythm Guitar', shortLabel: 'RHYTHM GTR', iconName: 'Music', defaultColor: '#84cc16' },
  { id: 'keys', label: 'Keys & Synths', shortLabel: 'KEYS', iconName: 'Layers', defaultColor: '#a855f7' },
  { id: 'lead_vocals', label: 'Lead Vocals', shortLabel: 'LEAD VOX', iconName: 'Mic', defaultColor: '#ec4899' },
  { id: 'backing_vocals', label: 'Backing Vocals', shortLabel: 'BACK VOX', iconName: 'Mic2', defaultColor: '#f43f5e' },
  { id: 'sound_tech', label: 'Sound Engineer / Tech', shortLabel: 'FOH TECH', iconName: 'Sliders', defaultColor: '#10b981' },
];

export const SECTION_COLORS: Record<string, string> = {
  intro: '#3b82f6', // blue
  verse: '#10b981', // green
  chorus: '#ef4444', // red/coral
  bridge: '#8b5cf6', // purple
  solo: '#f59e0b', // amber
  breakdown: '#06b6d4', // cyan
  outro: '#64748b', // slate
  vamp: '#ec4899', // pink
  count_in: '#eab308',
};

export const DEFAULT_AUDIO_CONFIG: AudioMixConfig = {
  clickEnabled: true,
  clickVolume: 0.85,
  clickSubdivision: '1/4',
  downbeatFreq: 1600,
  offbeatFreq: 1000,
  clickPan: 0.0, // Center (or Pan left -1.0 for IEM split)
  vocalCuesEnabled: true,
  vocalCuesVolume: 0.9,
  voiceLeadInBars: 2,
  speechPitch: 1.05,
  speechRate: 1.15,
  countInEnabled: true,
  countInBars: 1,
  masterVolume: 0.95,
};

export const DEFAULT_MIDI_MAPPINGS: MidiMapping[] = [
  { id: 'map_1', action: 'PLAY_PAUSE', label: 'Pedal 1 (Start/Pause)', type: 'note', channel: 0, number: 60 },
  { id: 'map_2', action: 'NEXT_SONG', label: 'Pedal 2 (Next Song)', type: 'note', channel: 0, number: 62 },
  { id: 'map_3', action: 'PREV_SONG', label: 'Pedal 3 (Prev Song)', type: 'note', channel: 0, number: 59 },
  { id: 'map_4', action: 'NEXT_SECTION', label: 'Pedal 4 (Next Section)', type: 'note', channel: 0, number: 64 },
  { id: 'map_5', action: 'TRIGGER_EMERGENCY_REPEAT', label: 'Pedal 5 (Repeat Chorus)', type: 'cc', channel: 0, number: 64 },
  { id: 'map_6', action: 'TAP_TEMPO', label: 'Pedal 6 (Tap Tempo)', type: 'note', channel: 0, number: 65 },
];

export const EMERGENCY_CUES: { type: EmergencyCueType; label: string; voicePrompt: string; color: string; description: string }[] = [
  { type: 'REPEAT_CHORUS', label: 'REPEAT CHORUS', voicePrompt: 'Repeat chorus, repeat chorus!', color: '#ef4444', description: 'Loop current chorus for crowd singalong' },
  { type: 'EXTEND_SOLO', label: 'EXTEND SOLO (x2)', voicePrompt: 'Extend solo, keep rocking!', color: '#f59e0b', description: 'Give soloist another 8 bars' },
  { type: 'END_ON_1', label: 'END ON 1', voicePrompt: 'Watch master! Ending hard on one!', color: '#dc2626', description: 'Hit the downbeat and cut clean' },
  { type: 'CUT_SONG', label: 'CUT SONG NOW', voicePrompt: 'Cut track, cut track now!', color: '#b91c1c', description: 'Immediate clean mute / stop' },
  { type: 'SKIP_OUTRO', label: 'SKIP TO OUTRO', voicePrompt: 'Skip to outro on next bar!', color: '#8b5cf6', description: 'Bypass bridge and go straight to ending' },
  { type: 'VAMP_HOLD', label: 'VAMP / HOLD CHORD', voicePrompt: 'Hold chord, vamp till cue!', color: '#06b6d4', description: 'Hold current progression for stage banter' },
  { type: 'KEY_CHANGE', label: 'MODULATE +1 STEP', voicePrompt: 'Key change up one half step!', color: '#ec4899', description: 'Modulate for high energy final chorus' },
];

export const ALL_DEFAULT_SONGS: Song[] = [...HOTT_SHOTS_SONGS];

export const DEFAULT_SETLISTS: Setlist[] = [
  HOTT_SHOTS_AUGUST_SETLIST,
];

export const SAMPLE_GIGS: GigEvent[] = [
  {
    id: 'gig_1',
    title: 'Electric Summer Stage Festival',
    venueName: 'The Electric Grand Arena',
    address: '142 Kingsland Road, London E2 8DY',
    city: 'London',
    date: '2026-08-20',
    loadInTime: '15:30',
    soundcheckTime: '17:00',
    doorsTime: '19:30',
    stageTime: '21:00',
    curfewTime: '22:15',
    performanceFee: 2800,
    currency: '£',
    setlistId: 'setlist_main',
    status: 'confirmed',
    contactPerson: 'Dave Miller (Stage Manager)',
    contactPhone: '+44 7700 900451',
    bandAvailability: {
      m_1: 'available',
      m_2: 'available',
      m_3: 'available',
      m_4: 'available',
      m_5: 'available',
      m_6: 'available',
    },
    notes: 'In-Ear Monitor splits provided from Stage Box A. Wi-Fi PA SSID: "VENUE_PA_5G" (Pass: soundcheck2026). Parking behind backstage gate 3.',
  },
  {
    id: 'gig_2',
    title: 'Waterfront Summer Beats',
    venueName: 'The Waterfront Pier Stage',
    address: 'Pier 7, Brighton Marina',
    city: 'Brighton',
    date: '2026-09-05',
    loadInTime: '16:00',
    soundcheckTime: '18:00',
    doorsTime: '19:00',
    stageTime: '20:30',
    curfewTime: '23:00',
    performanceFee: 1950,
    currency: '£',
    setlistId: 'setlist_main',
    status: 'confirmed',
    contactPerson: 'Sarah Jenkins (Promoter)',
    contactPhone: '+44 7700 900892',
    bandAvailability: {
      m_1: 'available',
      m_2: 'available',
      m_3: 'tentative',
      m_4: 'available',
      m_5: 'available',
      m_6: 'available',
    },
    notes: 'Outdoor stage under marquee. Sea breeze dampness protection for tube amps.',
  },
  {
    id: 'gig_3',
    title: 'The Rock Foundry Headline Night',
    venueName: 'The Foundry Club',
    address: '88 Canal St, Manchester M1 3WD',
    city: 'Manchester',
    date: '2026-09-18',
    loadInTime: '17:00',
    soundcheckTime: '18:30',
    doorsTime: '20:00',
    stageTime: '21:30',
    curfewTime: '23:30',
    performanceFee: 1500,
    currency: '£',
    setlistId: 'setlist_main',
    status: 'in_discussion',
    contactPerson: 'Alex Vance',
    contactPhone: '+44 7700 900123',
    bandAvailability: {
      m_1: 'available',
      m_2: 'available',
      m_3: 'available',
      m_4: 'available',
      m_5: 'available',
    },
    notes: 'Full 5-piece Hot Shots lineup confirmed.',
  },
];

export const SAMPLE_STAGE_RIDER: StageRider = {
  id: 'rider_1',
  title: 'Hot Shots - 5-Piece Stage Rider & Tech Input List',
  bandName: 'HOT SHOTS',
  contactName: 'Mart (Band Leader & Bass)',
  contactPhone: '+44 7700 900111',
  contactEmail: 'tech@hotshots.live',
  stagePlotItems: [
    { id: 'sp_1', type: 'drums', label: 'Drums (Sporty)', x: 50, y: 20, rotation: 0, powerRequired: true },
    { id: 'sp_2', type: 'bass_amp', label: 'Bass Rig (Mart - SVT + XLR DI)', x: 22, y: 28, rotation: 0, channelNumber: 8, powerRequired: true },
    { id: 'sp_3', type: 'guitar_amp', label: 'Lead Guitar (Dan - Kemper Profiler)', x: 78, y: 28, rotation: 0, channelNumber: 10, powerRequired: true },
    { id: 'sp_4', type: 'keyboard', label: 'Keys Station (Tom - Nord + Roland)', x: 16, y: 60, rotation: 15, channelNumber: 12, powerRequired: true },
    { id: 'sp_5', type: 'vocal_mic', label: 'Lead Vox (Rosie - Wireless Shure)', x: 50, y: 80, rotation: 0, channelNumber: 1 },
    { id: 'sp_6', type: 'vocal_mic', label: 'Backing Vox (Dan - Guitar)', x: 80, y: 72, rotation: -15, channelNumber: 2 },
    { id: 'sp_7', type: 'vocal_mic', label: 'Backing Vox (Tom - Keys)', x: 20, y: 72, rotation: 15, channelNumber: 3 },
    { id: 'sp_8', type: 'monitor_wedge', label: 'Wedge Monitor 1 (Rosie)', x: 50, y: 92, rotation: 180 },
    { id: 'sp_9', type: 'monitor_wedge', label: 'Wedge Monitor 2 (Dan)', x: 80, y: 88, rotation: 180 },
    { id: 'sp_10', type: 'monitor_wedge', label: 'Wedge Monitor 3 (Mart / Tom)', x: 20, y: 88, rotation: 180 },
    { id: 'sp_11', type: 'power_drop', label: '4-Way 230V AC Power (Drums - Sporty)', x: 42, y: 15, rotation: 0 },
    { id: 'sp_12', type: 'power_drop', label: '4-Way 230V AC Power (Keys - Tom)', x: 12, y: 55, rotation: 0 },
    { id: 'sp_13', type: 'power_drop', label: '4-Way 230V AC Power (Stage Front / Mart / Rosie / Dan)', x: 50, y: 72, rotation: 0 },
  ],
  inputChannels: [
    { channelNumber: 1, instrument: 'Lead Vocals', performer: 'Rosie', micOrDI: 'Wireless Shure QLX-D (Band Provided)', standType: 'Straight', phantom48v: false, notes: 'Main vocal, reverb & tape delay on FX send' },
    { channelNumber: 2, instrument: 'Backing Vox (Guitar)', performer: 'Dan', micOrDI: 'Shure SM58 / Beta 58A', standType: 'Tall Boom', phantom48v: false, notes: 'High harmonies' },
    { channelNumber: 3, instrument: 'Backing Vox (Keys)', performer: 'Tom', micOrDI: 'Shure SM58', standType: 'Tall Boom', phantom48v: false, notes: 'Mid harmonies' },
    { channelNumber: 4, instrument: 'Kick Drum (In)', performer: 'Sporty', micOrDI: 'Shure Beta 91A', standType: 'None', phantom48v: true, notes: 'Boundary mic inside kick' },
    { channelNumber: 5, instrument: 'Kick Drum (Out)', performer: 'Sporty', micOrDI: 'Audix D6 / AKG D112', standType: 'Short Boom', phantom48v: false, notes: 'Port hole punch' },
    { channelNumber: 6, instrument: 'Snare Top', performer: 'Sporty', micOrDI: 'Shure SM57', standType: 'Clip-on', phantom48v: false, notes: 'Snare crack' },
    { channelNumber: 7, instrument: 'Hi-Hat', performer: 'Sporty', micOrDI: 'AKG C451 / Rode NT5', standType: 'Tall Boom', phantom48v: true, notes: 'Tight top end' },
    { channelNumber: 8, instrument: 'Bass DI (Clean/Pre)', performer: 'Mart', micOrDI: 'Radial J48 Active DI', standType: 'None', phantom48v: true, notes: 'Clean sub fundamental' },
    { channelNumber: 9, instrument: 'Bass Mic / Amp', performer: 'Mart', micOrDI: 'Sennheiser e906 / MD421', standType: 'Short Boom', phantom48v: false, notes: 'Overdrive tone' },
    { channelNumber: 10, instrument: 'Lead Guitar (L)', performer: 'Dan', micOrDI: 'XLR Out from Kemper', standType: 'None', phantom48v: false, notes: 'Stereo profile Left' },
    { channelNumber: 11, instrument: 'Lead Guitar (R)', performer: 'Dan', micOrDI: 'XLR Out from Kemper', standType: 'None', phantom48v: false, notes: 'Stereo profile Right' },
    { channelNumber: 12, instrument: 'Keyboards (L)', performer: 'Tom', micOrDI: 'Radial ProD2 (Stereo)', standType: 'None', phantom48v: false, notes: 'Synths & Piano Left' },
    { channelNumber: 13, instrument: 'Keyboards (R)', performer: 'Tom', micOrDI: 'Radial ProD2 (Stereo)', standType: 'None', phantom48v: false, notes: 'Synths & Piano Right' },
    { channelNumber: 14, instrument: 'BandSync Click & Cue (IEM only)', performer: 'Mart (Stage Master)', micOrDI: 'Radial StageBug DI', standType: 'None', phantom48v: false, notes: 'CRITICAL: DO NOT ROUTE TO FOH! IEMs ONLY!' },
  ],
  monitorMixes: [
    { mixNumber: 1, assignedTo: 'Lead Vocals (Rosie)', notes: 'In-Ear Monitor Stereo (Mix 1-2): 50% Lead Vox, 25% Keys, 15% Click/Cues, 10% Guitar' },
    { mixNumber: 2, assignedTo: 'Drums (Sporty)', notes: 'In-Ear Monitor Stereo (Mix 3-4): 40% Click Track, 30% Bass DI (Mart), 20% Vox, 10% Guitars' },
    { mixNumber: 3, assignedTo: 'Bass (Mart - Stage Master)', notes: 'Wedge / IEM Mix 5: Bass, Kick, Snare, Rosie Vox, Click/Cues' },
    { mixNumber: 4, assignedTo: 'Lead Guitar (Dan)', notes: 'In-Ear Monitor Stereo (Mix 6-7): Lead Guitar, Click/Cues, Rosie Vox' },
    { mixNumber: 5, assignedTo: 'Keys & Synths (Tom)', notes: 'Wedge / IEM Mix 8: Keys, Backing Vox, Click/Cues, Rosie Vox' },
  ],
  generalRequirements: 'Hot Shots provides wireless transmitters, IEM receivers, and BandSync Stage Master system. Venue to provide 14 mic cables, 6 DI boxes, AC power drops on stage as marked in plot, and competent FOH sound engineer.',
};

export const SAMPLE_BAND_PROFILE: BandProfile = {
  id: 'band_1',
  name: 'HOT SHOTS',
  genre: 'High-Energy Festival, Pop & Rock Party Band',
  accentColor: '#f97316',
  stageTheme: 'stage_dark',
  members: [
    { id: 'm_1', name: 'Mart (You)', role: 'bass', avatar: '⚡', color: '#06b6d4', isMaster: true, phone: '+44 7700 900111', latencyMs: 1.2 },
    { id: 'm_2', name: 'Rosie', role: 'lead_vocals', avatar: '🎤', color: '#ec4899', isMaster: false, phone: '+44 7700 900222', latencyMs: 2.1 },
    { id: 'm_3', name: 'Dan', role: 'lead_guitar', avatar: '🎸', color: '#eab308', isMaster: false, phone: '+44 7700 900333', latencyMs: 3.4 },
    { id: 'm_4', name: 'Tom', role: 'keys', avatar: '🎹', color: '#a855f7', isMaster: false, phone: '+44 7700 900555', latencyMs: 2.7 },
    { id: 'm_5', name: 'Sporty', role: 'drums', avatar: '🥁', color: '#f97316', isMaster: false, phone: '+44 7700 900444', latencyMs: 1.8 },
  ],
};
