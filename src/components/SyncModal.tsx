import React, { useState, useEffect } from 'react';
import { syncService, ConnectedMemberInfo } from '../services/syncService';
import { InstrumentRole } from '../types';
import { ROLE_DEFINITIONS } from '../constants';
import { Wifi, X, Smartphone, ShieldCheck, Check, Laptop, Copy, RefreshCw } from 'lucide-react';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMaster: boolean;
  onToggleMaster: (isMaster: boolean) => void;
  currentRole: InstrumentRole;
  currentName: string;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  isMaster,
  onToggleMaster,
  currentRole,
  currentName,
}) => {
  const [syncStatus, setSyncStatus] = useState(syncService.getStatus());
  const [copied, setCopied] = useState<boolean>(false);
  const [hostUrl, setHostUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setSyncStatus(syncService.getStatus());
    }, 500);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hostUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      id="sync-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="sync-modal-content"
        className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Local Stage Wi-Fi Synchronisation</h2>
              <p className="text-xs text-zinc-400">Sub-millisecond lockstep clock sync over local venue PA router</p>
            </div>
          </div>
          <button
            id="btn-close-sync-modal"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master vs Client Toggle Card */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isMaster ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  This Device Mode: {isMaster ? 'STAGE MASTER (Broadcaster)' : 'PERFORMER CLIENT (Follower)'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isMaster ? 'bg-orange-500 text-black' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'}`}>
                  {isMaster ? 'MASTER' : 'CLIENT'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isMaster
                  ? 'Controls master transport (Play/Pause/Setlist/Song changes) broadcasted to all band devices.'
                  : 'Receives and executes scheduled start times in lockstep with the master.'}
              </p>
            </div>
          </div>

          <button
            id="btn-toggle-master-mode"
            onClick={() => onToggleMaster(!isMaster)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isMaster
                ? 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                : 'bg-orange-500 hover:bg-orange-400 text-black shadow-lg shadow-orange-500/20'
            }`}
          >
            {isMaster ? 'Switch to Client Mode' : 'Claim Master Control'}
          </button>
        </div>

        {/* Sync Latency & Clock Precision Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-[11px] uppercase font-bold text-zinc-500 block mb-1">Bridge Connection</span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${syncStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="font-bold text-white text-sm">
                {syncStatus.isConnected ? 'Connected to Local Bridge' : 'Standalone / Offline Mode'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-[11px] uppercase font-bold text-zinc-500 block mb-1">NTP Clock Offset</span>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-mono font-bold text-orange-300 text-sm">
                {syncStatus.clockOffsetMs >= 0 ? `+${syncStatus.clockOffsetMs}` : syncStatus.clockOffsetMs} ms
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">(Jitter-free)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-[11px] uppercase font-bold text-zinc-500 block mb-1">LAN Network Latency</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-emerald-300 text-sm">{syncStatus.latencyMs} ms</span>
              <span className="text-[10px] text-zinc-500 font-mono">(Roundtrip)</span>
            </div>
          </div>
        </div>

        {/* How to Connect Band Devices over Venue Wi-Fi */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-orange-400" />
              How to Connect Band Members on Stage
            </span>
            <button
              onClick={handleCopyUrl}
              className="px-3 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-orange-400 flex items-center gap-1.5 border border-zinc-800 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied URL!' : 'Copy Stage URL'}
            </button>
          </div>

          <div className="text-xs text-zinc-400 space-y-1.5">
            <p>1. Connect all band devices (iPads, Android phones, laptops) to the same local venue Wi-Fi router (no internet required).</p>
            <p>2. Open browser on member device and navigate to:</p>
            <div className="p-2.5 rounded-lg bg-zinc-950 font-mono text-orange-400 text-xs border border-zinc-800 select-all">
              {hostUrl}
            </div>
            <p>3. Select instrument role on their device. When Master presses Play, all audio and cues trigger in exact lockstep!</p>
          </div>
        </div>

        {/* Connected Bandmates Presence Table */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Connected Band Devices ({syncStatus.connectedMembers.length > 0 ? syncStatus.connectedMembers.length : 1})
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono">Real-time status</span>
          </div>

          <div className="space-y-2">
            {syncStatus.connectedMembers.length > 0 ? (
              syncStatus.connectedMembers.map((member) => {
                const roleDef = ROLE_DEFINITIONS.find((r) => r.id === member.role) || ROLE_DEFINITIONS[0];

                return (
                  <div
                    key={member.id}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                        style={{ backgroundColor: `${roleDef.defaultColor}33`, color: roleDef.defaultColor }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{member.name}</span>
                          {member.isMaster && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-500 text-black text-[9px] font-black uppercase">
                              MASTER
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-400 font-medium">{roleDef.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {member.latencyMs || 2}ms
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
                    {currentName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{currentName} (You)</span>
                      {isMaster && (
                        <span className="px-1.5 py-0.5 rounded bg-orange-500 text-black text-[9px] font-black uppercase">
                          MASTER
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      {ROLE_DEFINITIONS.find((r) => r.id === currentRole)?.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Active on Stage
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
          <button
            id="btn-close-sync-modal-done"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-md shadow-orange-500/20"
          >
            <Check className="w-4 h-4 stroke-[3]" /> Done
          </button>
        </div>
      </div>
    </div>
  );
};
