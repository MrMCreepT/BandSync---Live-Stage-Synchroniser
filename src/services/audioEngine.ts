import { AudioMixConfig, Song, SongSection } from '../types';

export interface BeatTickEvent {
  songId: string;
  sectionIndex: number;
  section: SongSection;
  barIndex: number; // 1-based (e.g. bar 3 of 8)
  totalBarsInSection: number;
  beatIndex: number; // 1-based (e.g. beat 1, 2, 3, 4)
  beatsPerBar: number;
  isDownbeat: boolean;
  isCountIn: boolean;
  countInRemaining: number;
  barsRemainingInSection: number;
  nextSection?: SongSection;
  bpm: number;
}

type BeatCallback = (evt: BeatTickEvent) => void;
type SectionChangeCallback = (currentSection: SongSection, sectionIndex: number, nextSection?: SongSection) => void;
type PlaybackEndedCallback = () => void;

class StageAudioEngine {
  private ctx: AudioContext | null = null;
  private isUnlocked: boolean = false;
  private isRunning: boolean = false;

  // Master Gain & Panner
  private masterGain: GainNode | null = null;
  private clickGain: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;

  // Current Playback State
  private currentSong: Song | null = null;
  private currentSectionIndex: number = 0;
  private currentBar: number = 1;
  private currentBeat: number = 1;
  private beatsPerBar: number = 4;
  private bpm: number = 120;
  private isCountIn: boolean = false;
  private countInRemaining: number = 4;

  // Lookahead Scheduler
  private lookaheadMs: number = 25; // How frequently to call scheduler (ms)
  private scheduleAheadSec: number = 0.15; // How far ahead to schedule audio (sec)
  private nextBeatAudioTime: number = 0;
  private schedulerTimerId: number | null = null;
  private visualTickTimerId: number | null = null;

  // Time conversion for LAN sync
  private targetStartEpochMs: number = 0;
  private scheduledAudioStartTime: number = 0;

  // Speech synthesis queue
  private speechSynth: SpeechSynthesis | null = null;
  private lastSpokenCueKey: string = '';

  // Listeners
  private beatListeners: Set<BeatCallback> = new Set();
  private sectionListeners: Set<SectionChangeCallback> = new Set();
  private endListeners: Set<PlaybackEndedCallback> = new Set();

  // Mix configuration
  private config: AudioMixConfig = {
    clickEnabled: true,
    clickVolume: 0.85,
    clickSubdivision: '1/4',
    downbeatFreq: 1600,
    offbeatFreq: 1000,
    clickPan: 0.0,
    vocalCuesEnabled: true,
    vocalCuesVolume: 0.9,
    voiceLeadInBars: 2,
    speechPitch: 1.05,
    speechRate: 1.15,
    countInEnabled: true,
    countInBars: 1,
    masterVolume: 0.95,
  };

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speechSynth = window.speechSynthesis;
    }
  }

  public initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass({ latencyHint: 'interactive' });
      this.setupNodes();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
      });
    } else {
      this.isUnlocked = true;
    }

    return this.ctx;
  }

  private setupNodes() {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.config.masterVolume, this.ctx.currentTime);

    this.clickGain = this.ctx.createGain();
    this.clickGain.gain.setValueAtTime(this.config.clickEnabled ? this.config.clickVolume : 0, this.ctx.currentTime);

    if (this.ctx.createStereoPanner) {
      this.pannerNode = this.ctx.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(this.config.clickPan, this.ctx.currentTime);
      this.clickGain.connect(this.pannerNode);
      this.pannerNode.connect(this.masterGain);
    } else {
      this.clickGain.connect(this.masterGain);
    }

    this.masterGain.connect(this.ctx.destination);
  }

  public updateConfig(newConfig: Partial<AudioMixConfig>) {
    this.config = { ...this.config, ...newConfig };

    if (this.clickGain && this.ctx) {
      const vol = this.config.clickEnabled ? this.config.clickVolume : 0;
      this.clickGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.config.masterVolume, this.ctx.currentTime);
    }

    if (this.pannerNode && this.ctx) {
      this.pannerNode.pan.setValueAtTime(this.config.clickPan, this.ctx.currentTime);
    }
  }

  public getConfig(): AudioMixConfig {
    return { ...this.config };
  }

  public isAudioReady(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  public async unlockAudio(): Promise<boolean> {
    try {
      this.initContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.playBeep(2000, 0.05, 0.2); // short test confirmation beep
      this.isUnlocked = true;
      return true;
    } catch (err) {
      console.error('Failed to unlock audio context:', err);
      return false;
    }
  }

  /**
   * Schedule or start playback of a song
   * targetEpochMs: absolute epoch timestamp in milliseconds (for sub-ms multi-device sync)
   */
  public startSong(
    song: Song,
    startSectionIndex: number = 0,
    startBar: number = 1,
    targetEpochMs?: number
  ) {
    this.initContext();
    this.stopPlayback();

    this.currentSong = song;
    this.currentSectionIndex = Math.min(startSectionIndex, song.sections.length - 1);
    this.currentBar = startBar;
    this.currentBeat = 1;
    this.lastSpokenCueKey = '';

    const currentSection = song.sections[this.currentSectionIndex];
    this.bpm = currentSection?.bpmOverride || song.bpm;
    this.beatsPerBar = this.parseTimeSignature(currentSection?.timeSignature || song.timeSignature);

    // Calculate count-in if at beginning
    if (this.config.countInEnabled && startSectionIndex === 0 && startBar === 1) {
      this.isCountIn = true;
      this.countInRemaining = this.beatsPerBar * (this.config.countInBars || 1);
    } else {
      this.isCountIn = false;
      this.countInRemaining = 0;
    }

    const ctxTime = this.ctx!.currentTime;
    const nowEpoch = Date.now();

    if (targetEpochMs && targetEpochMs > nowEpoch) {
      const delaySec = (targetEpochMs - nowEpoch) / 1000;
      this.scheduledAudioStartTime = ctxTime + delaySec;
      this.targetStartEpochMs = targetEpochMs;
    } else {
      this.scheduledAudioStartTime = ctxTime + 0.05;
      this.targetStartEpochMs = nowEpoch + 50;
    }

    this.nextBeatAudioTime = this.scheduledAudioStartTime;
    this.isRunning = true;

    // Start lookahead scheduling loop
    this.schedulerTimerId = window.setInterval(() => this.schedulerLoop(), this.lookaheadMs);

    // Fire initial section notification
    this.notifySectionChange();
  }

  private schedulerLoop() {
    if (!this.ctx || !this.isRunning || !this.currentSong) return;

    const currentTime = this.ctx.currentTime;

    while (this.nextBeatAudioTime < currentTime + this.scheduleAheadSec) {
      this.scheduleBeat(this.nextBeatAudioTime);
      this.advanceBeatPointer();
    }
  }

  private scheduleBeat(audioTime: number) {
    if (!this.ctx || !this.currentSong) return;

    const isCountIn = this.isCountIn;
    const countInRem = this.countInRemaining;
    const currentSection = this.currentSong.sections[this.currentSectionIndex];
    if (!currentSection) return;

    const isDownbeat = this.currentBeat === 1;
    const isOffbeat = !isDownbeat;

    // 1. Synthesise Click Sound via Web Audio Oscillators
    if (this.config.clickEnabled) {
      if (isCountIn) {
        // Distinct high count-in tone
        this.synthesizeClick(audioTime, 2200, 0.04, 0.9, 'triangle');
      } else if (isDownbeat) {
        // High downbeat click
        this.synthesizeClick(audioTime, this.config.downbeatFreq, 0.05, 1.0, 'sine');
      } else {
        // Mid offbeat click
        this.synthesizeClick(audioTime, this.config.offbeatFreq, 0.035, 0.7, 'triangle');
      }

      // Schedule subdivisions if configured (e.g. 1/8th notes)
      if (!isCountIn && this.config.clickSubdivision === '1/8') {
        const beatDuration = 60 / this.bpm;
        const subAudioTime = audioTime + beatDuration / 2;
        this.synthesizeClick(subAudioTime, 750, 0.02, 0.35, 'triangle');
      }
    }

    // 2. Dispatch Visual and State Tick event synchronized to audio time
    const tickData: BeatTickEvent = {
      songId: this.currentSong.id,
      sectionIndex: this.currentSectionIndex,
      section: currentSection,
      barIndex: this.currentBar,
      totalBarsInSection: currentSection.bars,
      beatIndex: this.currentBeat,
      beatsPerBar: this.beatsPerBar,
      isDownbeat,
      isCountIn,
      countInRemaining: countInRem,
      barsRemainingInSection: currentSection.bars - this.currentBar + 1,
      nextSection: this.currentSong.sections[this.currentSectionIndex + 1],
      bpm: this.bpm,
    };

    const delayMs = Math.max(0, (audioTime - this.ctx.currentTime) * 1000);
    window.setTimeout(() => {
      if (!this.isRunning) return;
      this.beatListeners.forEach((fn) => fn(tickData));
    }, delayMs);

    // 3. Voice Cue synthesis via Web Speech API
    if (this.config.vocalCuesEnabled && !isCountIn) {
      this.evaluateVocalCue(tickData, audioTime);
    }
  }

  private synthesizeClick(
    time: number,
    freq: number,
    duration: number,
    volumeScale: number = 1.0,
    type: OscillatorType = 'sine'
  ) {
    if (!this.ctx || !this.clickGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      // Fast exponential pitch drop for a punchy snare/click snap
      osc.frequency.exponentialRampToValueAtTime(freq * 0.3, time + duration);

      const peakGain = 0.8 * volumeScale;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peakGain, time + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.clickGain);

      osc.start(time);
      osc.stop(time + duration + 0.01);
    } catch (e) {
      // Audio context closing or overflow guard
    }
  }

  private evaluateVocalCue(tick: BeatTickEvent, audioTime: number) {
    if (!this.speechSynth) return;

    const nextSec = tick.nextSection;
    if (!nextSec) return;

    const leadInBars = this.config.voiceLeadInBars || 2;
    const barsRemaining = tick.barsRemainingInSection;

    // Trigger voice cue on beat 1 of the designated lead-in bar
    if (barsRemaining === leadInBars && tick.beatIndex === 1 && tick.isDownbeat) {
      const cueKey = `sec_${tick.sectionIndex}_to_${tick.sectionIndex + 1}_bar_${tick.barIndex}`;
      if (this.lastSpokenCueKey !== cueKey) {
        this.lastSpokenCueKey = cueKey;
        const sectionCleanName = nextSec.name.replace(/\(.*?\)/g, '').trim();
        const speechText = `${sectionCleanName} in ${leadInBars}`;

        const delayMs = Math.max(0, (audioTime - this.ctx!.currentTime) * 1000);
        window.setTimeout(() => {
          this.speakCue(speechText);
        }, delayMs);
      }
    } else if (barsRemaining === 1 && tick.beatIndex === this.beatsPerBar && this.beatsPerBar >= 3) {
      // Last beat countdown warning
      // Optional subtle voice cue
    }
  }

  public speakCue(text: string, interrupt: boolean = false) {
    if (!this.speechSynth || !this.config.vocalCuesEnabled) return;

    try {
      if (interrupt) {
        this.speechSynth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.config.speechRate;
      utterance.pitch = this.config.speechPitch;
      utterance.volume = this.config.vocalCuesVolume;

      // Select an English voice if available
      const voices = this.speechSynth.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      this.speechSynth.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  }

  private advanceBeatPointer() {
    if (!this.currentSong) return;

    const secondsPerBeat = 60 / this.bpm;
    this.nextBeatAudioTime += secondsPerBeat;

    if (this.isCountIn) {
      this.countInRemaining -= 1;
      if (this.countInRemaining <= 0) {
        this.isCountIn = false;
        this.currentBar = 1;
        this.currentBeat = 1;
      } else {
        this.currentBeat = (this.currentBeat % this.beatsPerBar) + 1;
      }
      return;
    }

    // Normal Playback Progression
    this.currentBeat += 1;
    if (this.currentBeat > this.beatsPerBar) {
      this.currentBeat = 1;
      this.currentBar += 1;

      const currentSection = this.currentSong.sections[this.currentSectionIndex];
      if (this.currentBar > currentSection.bars) {
        // Move to next section
        this.currentBar = 1;
        this.currentSectionIndex += 1;

        if (this.currentSectionIndex >= this.currentSong.sections.length) {
          // Song Completed
          this.stopPlayback();
          this.endListeners.forEach((fn) => fn());
          return;
        }

        // Apply new section tempo / time signature if changed
        const newSection = this.currentSong.sections[this.currentSectionIndex];
        this.bpm = newSection.bpmOverride || this.currentSong.bpm;
        this.beatsPerBar = this.parseTimeSignature(newSection.timeSignature || this.currentSong.timeSignature);
        this.notifySectionChange();
      }
    }
  }

  private notifySectionChange() {
    if (!this.currentSong) return;
    const cur = this.currentSong.sections[this.currentSectionIndex];
    const next = this.currentSong.sections[this.currentSectionIndex + 1];
    if (cur) {
      this.sectionListeners.forEach((fn) => fn(cur, this.currentSectionIndex, next));
    }
  }

  public seekSection(sectionIndex: number) {
    if (!this.currentSong) return;
    this.currentSectionIndex = Math.max(0, Math.min(sectionIndex, this.currentSong.sections.length - 1));
    this.currentBar = 1;
    this.currentBeat = 1;
    this.isCountIn = false;

    const currentSection = this.currentSong.sections[this.currentSectionIndex];
    this.bpm = currentSection.bpmOverride || this.currentSong.bpm;
    this.beatsPerBar = this.parseTimeSignature(currentSection.timeSignature || this.currentSong.timeSignature);

    this.notifySectionChange();
  }

  public pausePlayback() {
    this.isRunning = false;
    if (this.schedulerTimerId) {
      clearInterval(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
    if (this.visualTickTimerId) {
      clearTimeout(this.visualTickTimerId);
      this.visualTickTimerId = null;
    }
  }

  public resumePlayback() {
    if (!this.currentSong) return;
    this.initContext();
    this.isRunning = true;
    this.nextBeatAudioTime = this.ctx!.currentTime + 0.05;
    this.schedulerTimerId = window.setInterval(() => this.schedulerLoop(), this.lookaheadMs);
  }

  public stopPlayback() {
    this.pausePlayback();
    this.currentSectionIndex = 0;
    this.currentBar = 1;
    this.currentBeat = 1;
    this.isCountIn = false;
    if (this.speechSynth) {
      this.speechSynth.cancel();
    }
  }

  public playBeep(freq: number = 880, duration: number = 0.1, vol: number = 0.5) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  private parseTimeSignature(sig: string): number {
    const parts = sig.split('/');
    return parseInt(parts[0], 10) || 4;
  }

  // Event Listeners
  public onBeat(callback: BeatCallback): () => void {
    this.beatListeners.add(callback);
    return () => this.beatListeners.delete(callback);
  }

  public onSectionChange(callback: SectionChangeCallback): () => void {
    this.sectionListeners.add(callback);
    return () => this.sectionListeners.delete(callback);
  }

  public onPlaybackEnded(callback: PlaybackEndedCallback): () => void {
    this.endListeners.add(callback);
    return () => this.endListeners.delete(callback);
  }

  public getCurrentState() {
    return {
      isRunning: this.isRunning,
      isCountIn: this.isCountIn,
      bpm: this.bpm,
      currentSong: this.currentSong,
      sectionIndex: this.currentSectionIndex,
      bar: this.currentBar,
      beat: this.currentBeat,
    };
  }
}

export const audioEngine = new StageAudioEngine();
