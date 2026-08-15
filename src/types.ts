export type InstrumentRole =
  | 'drums'
  | 'bass'
  | 'lead_guitar'
  | 'rhythm_guitar'
  | 'keys'
  | 'lead_vocals'
  | 'backing_vocals'
  | 'sound_tech';

export interface RoleDefinition {
  id: InstrumentRole;
  label: string;
  shortLabel: string;
  iconName: string;
  defaultColor: string;
}

export type SectionType =
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'solo'
  | 'breakdown'
  | 'outro'
  | 'vamp'
  | 'count_in';

export interface MidiTrigger {
  enabled: boolean;
  channel: number; // 1-16
  programChange?: number; // 0-127 (Patch / Preset)
  controlChange?: {
    cc: number; // 0-127
    value: number; // 0-127
  };
  description?: string;
}

export interface SongSection {
  id: string;
  name: string;
  type: SectionType;
  bars: number;
  timeSignature: '4/4' | '3/4' | '6/8' | '7/8' | '5/4' | '12/8' | '2/4';
  bpmOverride?: number;
  color: string;
  roleNotes: Partial<Record<InstrumentRole, string>>;
  chords?: string;
  lyrics?: string;
  bassTab?: string;
  midiTrigger?: MidiTrigger;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  timeSignature: '4/4' | '3/4' | '6/8' | '7/8' | '5/4' | '12/8' | '2/4';
  key: string;
  leadInBars: number;
  bufferSecondsAfter: number;
  sections: SongSection[];
  notes?: string;
  audioFileName?: string;
  audioDurationSec?: number;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SetlistItem {
  songId: string;
  setGroup?: 'Set 1' | 'Set 2' | 'Encore' | string;
  customNotes?: string;
  tuningOverride?: string;
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  venueName?: string;
  targetStartTime?: string; // e.g. "21:00"
  targetCurfewTime?: string; // e.g. "22:30"
  intermissionMinutes?: number; // e.g. 20 mins between Set 1 and Set 2
  interSongBufferSec: number; // e.g. 20s
  items: SetlistItem[];
  notes?: string;
  updatedAt: number;
}

export type EmergencyCueType =
  | 'REPEAT_CHORUS'
  | 'EXTEND_SOLO'
  | 'END_ON_1'
  | 'CUT_SONG'
  | 'SKIP_OUTRO'
  | 'VAMP_HOLD'
  | 'KEY_CHANGE'
  | 'CUSTOM';

export interface EmergencyEvent {
  id: string;
  cueType: EmergencyCueType;
  label: string;
  customText?: string;
  senderName: string;
  senderRole: InstrumentRole;
  timestamp: number;
  color: string;
}

export type EmergencyCueEvent = EmergencyEvent;

export interface AudioMixConfig {
  clickEnabled: boolean;
  clickVolume: number; // 0.0 to 1.0
  clickSubdivision: '1/4' | '1/8' | '1/16' | 'triplet';
  downbeatFreq: number; // e.g. 1600 Hz
  offbeatFreq: number; // e.g. 1000 Hz
  clickPan: number; // -1.0 (Left/IEM) to +1.0 (Right)
  vocalCuesEnabled: boolean;
  vocalCuesVolume: number;
  voiceLeadInBars: 1 | 2 | 4;
  speechPitch: number;
  speechRate: number;
  countInEnabled: boolean;
  countInBars: 1 | 2;
  masterVolume: number;
}

export type MidiAction =
  | 'PLAY_PAUSE'
  | 'STOP'
  | 'NEXT_SONG'
  | 'PREV_SONG'
  | 'NEXT_SECTION'
  | 'PREV_SECTION'
  | 'TAP_TEMPO'
  | 'TRIGGER_EMERGENCY_REPEAT'
  | 'TRIGGER_EMERGENCY_END'
  | 'TOGGLE_CLICK';

export interface MidiMapping {
  id: string;
  action: MidiAction;
  label: string;
  type: 'note' | 'cc';
  channel: number; // 0 for any, 1-16
  number: number; // Note number or CC number
}

export interface StagePlotItem {
  id: string;
  type: 'drums' | 'bass_amp' | 'guitar_amp' | 'keyboard' | 'vocal_mic' | 'monitor_wedge' | 'di_box' | 'power_drop' | 'custom';
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  rotation: number;
  channelNumber?: number;
  powerRequired?: boolean;
}

export interface InputChannel {
  channelNumber: number;
  instrument: string;
  performer: string;
  micOrDI: string;
  standType: 'Tall Boom' | 'Short Boom' | 'Straight' | 'Clip-on' | 'None';
  phantom48v: boolean;
  insertFX?: string;
  notes?: string;
}

export interface StageRider {
  id: string;
  title: string;
  bandName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  stagePlotItems: StagePlotItem[];
  inputChannels: InputChannel[];
  monitorMixes: { mixNumber: number; assignedTo: string; notes: string }[];
  generalRequirements: string;
}

export type AvailabilityStatus = 'available' | 'unavailable' | 'tentative';

export interface GigEvent {
  id: string;
  title: string;
  venueName: string;
  address: string;
  city: string;
  date: string; // YYYY-MM-DD
  loadInTime: string; // HH:mm
  soundcheckTime: string; // HH:mm
  doorsTime: string; // HH:mm
  stageTime: string; // HH:mm
  curfewTime: string; // HH:mm
  performanceFee: number;
  currency: string;
  setlistId?: string;
  status: 'confirmed' | 'in_discussion' | 'cancelled';
  contactPerson: string;
  contactPhone: string;
  bandAvailability: Record<string, AvailabilityStatus>; // memberId -> status
  notes: string;
}

export interface BandMember {
  id: string;
  name: string;
  role: InstrumentRole;
  avatar: string;
  color: string;
  isMaster: boolean;
  phone?: string;
  email?: string;
  latencyMs?: number;
  lastSeen?: number;
}

export interface BandProfile {
  id: string;
  name: string;
  genre: string;
  logoUrl?: string;
  accentColor: string;
  stageTheme: 'stage_dark' | 'stage_neon' | 'stage_amber' | 'stage_cyan' | 'stage_high_contrast';
  members: BandMember[];
}

export interface PlaybackState {
  isPlaying: boolean;
  isCountIn: boolean;
  countInBeat: number;
  currentSongId: string | null;
  currentSectionIndex: number;
  currentBar: number;
  totalBarsInSection: number;
  currentBeat: number; // 1 to 4 (or time signature numerator)
  beatsPerBar: number;
  bpm: number;
  elapsedSec: number;
  totalDurationSec: number;
  targetStartTimestamp?: number;
  countdownToNextSection: number; // in bars or beats
  nextSectionName?: string;
}
