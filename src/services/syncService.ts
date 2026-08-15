import { EmergencyCueType, EmergencyEvent, InstrumentRole, Setlist, Song } from '../types';

export interface ConnectedMemberInfo {
  id: string;
  name: string;
  role: InstrumentRole;
  isMaster: boolean;
  latencyMs: number;
  lastPing?: number;
}

type SyncEventListener = (event: any) => void;

class StageSyncService {
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isConnected: boolean = false;
  private clientId: string = '';
  private isMaster: boolean = false;
  private memberName: string = 'Band Member';
  private role: InstrumentRole = 'drums';

  // Clock Synchronization metrics (NTP offset in ms)
  private clockOffsetMs: number = 0;
  private roundTripLatencyMs: number = 0;
  private pingIntervalId: number | null = null;
  private recentOffsets: number[] = [];

  // Connected band members
  private connectedMembers: ConnectedMemberInfo[] = [];

  // Event Listeners
  private listeners: Set<SyncEventListener> = new Set();
  private reconnectTimer: number | null = null;

  private statusListeners: Set<(status: { connected: boolean; offsetMs: number; roundTripLatencyMs: number; clientCount: number }) => void> = new Set();

  constructor() {
    this.clientId = 'performer_' + Math.random().toString(36).substring(2, 9);
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('bandsync_bus');
        this.broadcastChannel.onmessage = (e) => {
          this.handleIncomingPayload(e.data, true);
        };
      } catch (err) {}
    }
  }

  public connect(name: string = 'Band Member', role: InstrumentRole = 'drums', isMaster: boolean = false) {
    this.memberName = name;
    this.role = role;
    this.isMaster = isMaster;

    this.initWebSocket();
  }

  public disconnect() {
    this.stopClockSync();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.notifyStatusListeners();
  }

  public onStatusChange(listener: (status: { connected: boolean; offsetMs: number; roundTripLatencyMs: number; clientCount: number }) => void): () => void {
    this.statusListeners.add(listener);
    // Send immediate initial state
    listener({
      connected: this.isConnected,
      offsetMs: this.clockOffsetMs,
      roundTripLatencyMs: this.roundTripLatencyMs,
      clientCount: Math.max(1, this.connectedMembers.length),
    });
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatusListeners() {
    const status = {
      connected: this.isConnected,
      offsetMs: this.clockOffsetMs,
      roundTripLatencyMs: this.roundTripLatencyMs,
      clientCount: Math.max(1, this.connectedMembers.length),
    };
    this.statusListeners.forEach((fn) => fn(status));
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Register identity with server
        this.send({
          type: 'REGISTER_MEMBER',
          id: this.clientId,
          name: this.memberName,
          role: this.role,
          isMaster: this.isMaster,
          latencyMs: this.roundTripLatencyMs,
        });

        // Start NTP clock sync pings
        this.startClockSync();
        this.dispatchLocalEvent({ type: 'SYNC_CONNECTION_STATE', isConnected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleIncomingPayload(payload, false);
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopClockSync();
        this.dispatchLocalEvent({ type: 'SYNC_CONNECTION_STATE', isConnected: false });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('Sync WebSocket error (will retry):', err);
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.initWebSocket();
    }, 2500);
  }

  private startClockSync() {
    this.stopClockSync();
    // Do rapid initial 4 pings for accurate initial lock
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.sendNtpPing(), i * 200);
    }
    // Periodic sync every 4 seconds
    this.pingIntervalId = window.setInterval(() => this.sendNtpPing(), 4000);
  }

  private stopClockSync() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private sendNtpPing() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const clientTimestamp = Date.now();
    this.send({
      type: 'SYNC_PING',
      clientTimestamp,
    });
  }

  private handleIncomingPayload(payload: any, isFromBroadcastChannel: boolean = false) {
    switch (payload.type) {
      case 'SYNC_PONG': {
        const t4 = Date.now();
        const t1 = payload.clientTimestamp;
        const t2 = payload.serverReceiveTimestamp;
        const t3 = payload.serverSendTimestamp;

        const roundTrip = t4 - t1;
        this.roundTripLatencyMs = Math.round(roundTrip / 2);

        // NTP Offset calculation: ((t2 - t1) + (t3 - t4)) / 2
        const currentOffset = Math.round(((t2 - t1) + (t3 - t4)) / 2);

        this.recentOffsets.push(currentOffset);
        if (this.recentOffsets.length > 7) {
          this.recentOffsets.shift();
        }

        // Compute median offset to reject outlier network spikes
        const sorted = [...this.recentOffsets].sort((a, b) => a - b);
        this.clockOffsetMs = sorted[Math.floor(sorted.length / 2)];

        this.dispatchLocalEvent({
          type: 'CLOCK_SYNC_UPDATE',
          clockOffsetMs: this.clockOffsetMs,
          latencyMs: this.roundTripLatencyMs,
        });
        this.notifyStatusListeners();
        break;
      }

      case 'MEMBER_LIST_UPDATE': {
        this.connectedMembers = payload.members || [];
        this.dispatchLocalEvent(payload);
        this.notifyStatusListeners();
        break;
      }

      default:
        this.dispatchLocalEvent(payload);
        break;
    }
  }

  private send(data: any) {
    const jsonStr = JSON.stringify(data);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(jsonStr);
    }
    // Also broadcast to other browser tabs locally
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(data);
      } catch (e) {}
    }
  }

  public getSynchronizedEpochTime(): number {
    return Date.now() + this.clockOffsetMs;
  }

  // --- Live Stage Transport Commands ---

  public broadcastPlay(songId: string, sectionIndex: number = 0, startBar: number = 1, bpm: number = 120) {
    // Schedule start 1000ms ahead for zero-jitter lock across all band members
    const leadTimeMs = 1000;
    const targetTimestamp = this.getSynchronizedEpochTime() + leadTimeMs;

    this.send({
      type: 'SCHEDULED_PLAY',
      songId,
      sectionIndex,
      startBar,
      targetTimestamp,
      bpm,
      senderId: this.clientId,
      senderName: this.memberName,
    });
  }

  public broadcastPause(songId: string) {
    this.send({
      type: 'PAUSE_PLAYBACK',
      songId,
      senderId: this.clientId,
    });
  }

  public broadcastStop(songId: string) {
    this.send({
      type: 'STOP_PLAYBACK',
      songId,
      senderId: this.clientId,
    });
  }

  public broadcastSeek(songId: string, sectionIndex: number) {
    const targetTimestamp = this.getSynchronizedEpochTime() + 200;
    this.send({
      type: 'SEEK_SECTION',
      songId,
      sectionIndex,
      targetTimestamp,
      senderId: this.clientId,
    });
  }

  public broadcastChangeSong(songId: string, setlistIndex: number) {
    this.send({
      type: 'CHANGE_SONG',
      songId,
      setlistIndex,
      senderId: this.clientId,
    });
  }

  public broadcastEmergencyCue(cue: EmergencyCueType, label: string, color: string, customText?: string) {
    this.send({
      type: 'EMERGENCY_CUE',
      cue,
      label,
      customText,
      senderName: this.memberName,
      senderRole: this.role,
      color,
      timestamp: Date.now(),
    });
  }

  public broadcastDismissCue(cueId?: string) {
    this.send({
      type: 'DISMISS_CUE',
      cueId,
    });
  }

  public broadcastSetlistUpdate(setlist: Setlist) {
    this.send({
      type: 'SETLIST_PUSH',
      setlist,
      senderId: this.clientId,
    });
  }

  public broadcastTrackUpdate(song: Song) {
    this.send({
      type: 'TRACK_UPDATE_PUSH',
      song,
      senderId: this.clientId,
    });
  }

  public updateRoleAndName(name: string, role: InstrumentRole, isMaster: boolean) {
    this.memberName = name;
    this.role = role;
    this.isMaster = isMaster;

    this.send({
      type: 'REGISTER_MEMBER',
      id: this.clientId,
      name,
      role,
      isMaster,
      latencyMs: this.roundTripLatencyMs,
    });
  }

  // --- Subscriptions ---

  public onSyncEvent(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private dispatchLocalEvent(event: any) {
    this.listeners.forEach((fn) => fn(event));
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      clientId: this.clientId,
      memberName: this.memberName,
      role: this.role,
      isMaster: this.isMaster,
      clockOffsetMs: this.clockOffsetMs,
      latencyMs: this.roundTripLatencyMs,
      connectedMembers: this.connectedMembers,
    };
  }
}

export const syncService = new StageSyncService();
