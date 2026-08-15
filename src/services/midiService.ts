import { MidiAction, MidiMapping, MidiTrigger } from '../types';
import { DEFAULT_MIDI_MAPPINGS } from '../constants';

type MidiActionListener = (action: MidiAction, detail?: { number: number; value: number }) => void;
type MidiLearnCallback = (mapping: { type: 'note' | 'cc'; channel: number; number: number }) => void;

class StageMidiService {
  private midiAccess: any = null;
  private isSupported: boolean = false;
  private isConnected: boolean = false;
  private inputDevices: any[] = [];
  private outputDevices: any[] = [];
  private mappings: MidiMapping[] = [...DEFAULT_MIDI_MAPPINGS];
  private actionListeners: Set<MidiActionListener> = new Set();
  private learnCallback: MidiLearnCallback | null = null;
  private lastActivityTime: number = 0;
  private lastActivityDescription: string = 'No MIDI input detected';

  constructor() {
    this.loadMappings();
  }

  public getInputs(): any[] {
    return this.inputDevices;
  }

  public getOutputs(): any[] {
    return this.outputDevices;
  }

  public async init(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !(navigator as any).requestMIDIAccess) {
      this.isSupported = false;
      return false;
    }

    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess({ sysex: false });
      this.isSupported = true;
      this.isConnected = true;
      this.scanDevices();

      this.midiAccess.onstatechange = () => {
        this.scanDevices();
      };

      return true;
    } catch (err) {
      console.warn('Web MIDI not available or permission denied:', err);
      this.isSupported = false;
      this.isConnected = false;
      return false;
    }
  }

  private scanDevices() {
    if (!this.midiAccess) return;

    this.inputDevices = Array.from(this.midiAccess.inputs.values());
    this.outputDevices = Array.from(this.midiAccess.outputs.values());

    this.inputDevices.forEach((input: any) => {
      input.onmidimessage = (event: any) => this.handleMidiMessage(event, input.name || 'MIDI Device');
    });
  }

  private handleMidiMessage(event: any, deviceName: string) {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0];
    const channel = (status & 0x0f) + 1;
    const command = status >> 4;
    const noteOrCC = data[1];
    const velocityOrVal = data.length > 2 ? data[2] : 0;

    this.lastActivityTime = Date.now();

    // 0x09: Note On (velocity > 0), 0x0B: Control Change
    const isNoteOn = command === 0x9 && velocityOrVal > 0;
    const isCC = command === 0xb;

    const typeStr = isNoteOn ? 'Note On' : isCC ? 'CC' : `Cmd ${command}`;
    this.lastActivityDescription = `${deviceName} | ${typeStr} #${noteOrCC} (Val: ${velocityOrVal}) Ch:${channel}`;

    // If in Learn Mode, pass to callback
    if (this.learnCallback && (isNoteOn || (isCC && velocityOrVal > 60))) {
      this.learnCallback({
        type: isNoteOn ? 'note' : 'cc',
        channel,
        number: noteOrCC,
      });
      this.learnCallback = null;
      return;
    }

    // Check Mappings
    if (isNoteOn) {
      const match = this.mappings.find(
        (m) => m.type === 'note' && (m.channel === 0 || m.channel === channel) && m.number === noteOrCC
      );
      if (match) {
        this.triggerAction(match.action, { number: noteOrCC, value: velocityOrVal });
      }
    } else if (isCC && velocityOrVal > 0) {
      const match = this.mappings.find(
        (m) => m.type === 'cc' && (m.channel === 0 || m.channel === channel) && m.number === noteOrCC
      );
      if (match) {
        this.triggerAction(match.action, { number: noteOrCC, value: velocityOrVal });
      }
    }
  }

  private triggerAction(action: MidiAction, detail?: { number: number; value: number }) {
    this.actionListeners.forEach((fn) => fn(action, detail));
  }

  public onAction(listener: MidiActionListener): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  public startLearn(callback: MidiLearnCallback) {
    this.learnCallback = callback;
  }

  public cancelLearn() {
    this.learnCallback = null;
  }

  /**
   * Send Automated Program Change / CC on Section changes to external gear (Kemper/Nord/Helix)
   */
  public sendMidiTrigger(trigger: MidiTrigger) {
    if (!trigger.enabled || this.outputDevices.length === 0) return;

    const channelIndex = Math.max(0, Math.min(15, (trigger.channel || 1) - 1));

    this.outputDevices.forEach((output) => {
      try {
        // Send Program Change
        if (trigger.programChange !== undefined && trigger.programChange >= 0) {
          const pcStatus = 0xc0 | channelIndex;
          output.send([pcStatus, trigger.programChange]);
        }

        // Send Control Change
        if (trigger.controlChange) {
          const ccStatus = 0xb0 | channelIndex;
          output.send([ccStatus, trigger.controlChange.cc, trigger.controlChange.value]);
        }
      } catch (err) {
        console.warn('Failed to send MIDI output to', output.name, err);
      }
    });
  }

  public getMappings(): MidiMapping[] {
    return [...this.mappings];
  }

  public updateMapping(id: string, updates: Partial<MidiMapping>) {
    this.mappings = this.mappings.map((m) => (m.id === id ? { ...m, ...updates } : m));
    this.saveMappings();
  }

  public addMapping(mapping: MidiMapping) {
    this.mappings.push(mapping);
    this.saveMappings();
  }

  public removeMapping(id: string) {
    this.mappings = this.mappings.filter((m) => m.id !== id);
    this.saveMappings();
  }

  private saveMappings() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('bandsync_midi_mappings', JSON.stringify(this.mappings));
    }
  }

  private loadMappings() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('bandsync_midi_mappings');
      if (saved) {
        try {
          this.mappings = JSON.parse(saved);
        } catch (e) {}
      }
    }
  }

  public getStatus() {
    return {
      isSupported: this.isSupported,
      isConnected: this.isConnected,
      inputCount: this.inputDevices.length,
      outputCount: this.outputDevices.length,
      inputs: this.inputDevices.map((d) => d.name || 'Unnamed Input'),
      outputs: this.outputDevices.map((d) => d.name || 'Unnamed Output'),
      lastActivityTime: this.lastActivityTime,
      lastActivityDescription: this.lastActivityDescription,
    };
  }
}

export const midiService = new StageMidiService();
