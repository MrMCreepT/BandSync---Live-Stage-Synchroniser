import React, { useState } from 'react';
import { BandProfile, BandMember, InstrumentRole } from '../types';
import { ROLE_DEFINITIONS } from '../constants';
import { stageDb } from '../services/db';
import { syncService } from '../services/syncService';
import { audioEngine } from '../services/audioEngine';
import {
  Settings,
  Users,
  Shield,
  Palette,
  Download,
  Upload,
  RefreshCw,
  Check,
  Save,
  Plus,
  Trash2,
  Volume2,
} from 'lucide-react';

interface BandSettingsProps {
  bandProfile: BandProfile;
  onUpdateProfile: (profile: BandProfile) => void;
  onSelectPerformer: (performerId: string) => void;
  currentPerformerId: string;
}

export const BandSettings: React.FC<BandSettingsProps> = ({
  bandProfile,
  onUpdateProfile,
  onSelectPerformer,
  currentPerformerId,
}) => {
  const [profile, setProfile] = useState<BandProfile>(bandProfile);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [backupJson, setBackupJson] = useState<string>('');

  const handleSave = () => {
    stageDb.saveBandProfile(profile);
    onUpdateProfile(profile);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleUpdateMember = (id: string, updates: Partial<BandMember>) => {
    const updatedMembers = profile.members.map((m) => (m.id === id ? { ...m, ...updates } : m));
    const updated = { ...profile, members: updatedMembers };
    setProfile(updated);
    stageDb.saveBandProfile(updated);
    onUpdateProfile(updated);
  };

  const handleAddMember = () => {
    const newMember: BandMember = {
      id: 'm_' + Date.now(),
      name: 'New Musician',
      role: 'keys',
      avatar: '🎹',
      color: '#a855f7',
      isMaster: false,
    };
    const updated = { ...profile, members: [...profile.members, newMember] };
    setProfile(updated);
    stageDb.saveBandProfile(updated);
    onUpdateProfile(updated);
  };

  const handleRemoveMember = (id: string) => {
    if (profile.members.length <= 1) return;
    const updated = { ...profile, members: profile.members.filter((m) => m.id !== id) };
    setProfile(updated);
    stageDb.saveBandProfile(updated);
    onUpdateProfile(updated);
  };

  const handleExportBackup = () => {
    const json = stageDb.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BandSync_Backup_${profile.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && stageDb.importFullBackup(content)) {
        window.location.reload();
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all songs, setlists, and stage data to factory presets?')) {
      stageDb.resetToFactoryDefaults();
      window.location.reload();
    }
  };

  return (
    <div id="band-settings-root" className="min-h-[calc(100vh-60px)] bg-[#050505] text-zinc-100 p-3 sm:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono text-xs border border-orange-500/30">
              BAND PROFILE & HARDWARE SETTINGS
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">Band Branding & Performer Setup</h1>
          </div>

          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 transition-all"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedSuccess ? 'Saved & Synced!' : 'Save Settings'}
          </button>
        </div>

        {/* Branding & Visual Stage Themes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Band Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Musical Genre</label>
            <input
              type="text"
              value={profile.genre}
              onChange={(e) => setProfile({ ...profile, genre: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Stage Accent Theme</label>
            <div className="flex items-center gap-2">
              {['#f97316', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'].map((color) => (
                <button
                  key={color}
                  onClick={() => setProfile({ ...profile, accentColor: color })}
                  className="w-8 h-8 rounded-full border-2 transition-transform transform hover:scale-110 cursor-pointer"
                  style={{
                    backgroundColor: color,
                    borderColor: profile.accentColor === color ? '#ffffff' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Band Members Roster */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white text-base uppercase tracking-wider">
                Band Members & Instrument Roles ({profile.members.length})
              </h2>
              <p className="text-xs text-zinc-400">Configure musicians and designate the Stage Master device</p>
            </div>

            <button
              onClick={handleAddMember}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-orange-400 flex items-center gap-1.5 border border-zinc-800 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Musician
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.members.map((member) => {
              const isCurrent = member.id === currentPerformerId;

              return (
                <div
                  key={member.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    isCurrent
                      ? 'bg-zinc-850 border-orange-500 shadow-md shadow-orange-500/10'
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{member.avatar}</span>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => handleUpdateMember(member.id, { name: e.target.value })}
                        className="bg-transparent font-bold text-sm text-white focus:outline-none border-b border-transparent focus:border-zinc-500 px-1"
                      />
                    </div>

                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Role Selector */}
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Assigned Role</label>
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateMember(member.id, { role: e.target.value as InstrumentRole })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-orange-500 outline-none"
                    >
                      {ROLE_DEFINITIONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Master & Active Device Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={member.isMaster}
                        onChange={(e) => handleUpdateMember(member.id, { isMaster: e.target.checked })}
                        className="rounded bg-zinc-900 border-zinc-800 text-orange-500 accent-orange-500"
                      />
                      <span className="text-zinc-300 text-[11px] font-medium">Stage Master</span>
                    </label>

                    <button
                      onClick={() => onSelectPerformer(member.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-orange-500 text-black shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {isCurrent ? 'Current Device' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Offline Storage, JSON Backup & Factory Reset */}
        <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
          <h2 className="font-bold text-white text-base uppercase tracking-wider">
            Offline Storage & Stage Data Backup
          </h2>
          <p className="text-xs text-zinc-400">
            Export complete song libraries, setlists, and stage plots to JSON or transfer them between band devices.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportBackup}
              className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4 text-orange-400" /> Export JSON Stage Backup
            </button>

            <label className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-emerald-400" /> Import JSON Backup
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>

            <button
              onClick={handleResetDefaults}
              className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-xs font-semibold text-red-300 flex items-center gap-2 cursor-pointer transition-colors ml-auto"
            >
              <RefreshCw className="w-4 h-4" /> Reset Factory Presets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
