import React, { useState, useEffect } from 'react';
import { GigEvent, StageRider, StagePlotItem, InputChannel, BandProfile, AvailabilityStatus } from '../types';
import { stageDb } from '../services/db';
import {
  Calendar,
  MapPin,
  Clock,
  PoundSterling,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Plus,
  Trash2,
  Printer,
  FileText,
  Save,
  Sliders,
  Move,
  Layers,
} from 'lucide-react';

interface GigHubProps {
  gigs: GigEvent[];
  stageRider: StageRider;
  bandProfile: BandProfile;
  onUpdateGigs: (gigs: GigEvent[]) => void;
  onUpdateRider: (rider: StageRider) => void;
}

export const GigHub: React.FC<GigHubProps> = ({
  gigs,
  stageRider,
  bandProfile,
  onUpdateGigs,
  onUpdateRider,
}) => {
  const [currentTab, setCurrentTab] = useState<'gigs' | 'availability' | 'stage_plot' | 'input_list'>('gigs');
  const [localGigs, setLocalGigs] = useState<GigEvent[]>(gigs || []);
  const [localRider, setLocalRider] = useState<StageRider>(stageRider);
  const [selectedGigId, setSelectedGigId] = useState<string>(gigs?.[0]?.id || '');
  const [showNewGigModal, setShowNewGigModal] = useState<boolean>(false);
  const [savedNote, setSavedNote] = useState<boolean>(false);

  useEffect(() => {
    if (gigs) {
      setLocalGigs(gigs);
      if (!selectedGigId && gigs[0]?.id) {
        setSelectedGigId(gigs[0].id);
      }
    }
  }, [gigs]);

  useEffect(() => {
    if (stageRider) {
      setLocalRider(stageRider);
    }
  }, [stageRider]);

  const selectedGig = localGigs.find((g) => g.id === selectedGigId) || localGigs[0];

  const handleToggleMemberAvailability = (gigId: string, memberId: string) => {
    const updatedGigs = localGigs.map((g) => {
      if (g.id !== gigId) return g;
      const currentStatus = g.bandAvailability[memberId] || 'tentative';
      const nextStatus: AvailabilityStatus =
        currentStatus === 'available'
          ? 'unavailable'
          : currentStatus === 'unavailable'
          ? 'tentative'
          : 'available';

      return {
        ...g,
        bandAvailability: {
          ...g.bandAvailability,
          [memberId]: nextStatus,
        },
      };
    });

    setLocalGigs(updatedGigs);
    stageDb.saveGig(updatedGigs.find((g) => g.id === gigId)!);
    onUpdateGigs(updatedGigs);
  };

  const handleUpdatePlotItemPosition = (id: string, x: number, y: number) => {
    const updatedItems = localRider.stagePlotItems.map((item) =>
      item.id === id ? { ...item, x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) } : item
    );
    const updatedRider = { ...localRider, stagePlotItems: updatedItems };
    setLocalRider(updatedRider);
    stageDb.saveStageRider(updatedRider);
    onUpdateRider(updatedRider);
  };

  const handleAddPlotItem = (type: StagePlotItem['type'], label: string) => {
    const newItem: StagePlotItem = {
      id: 'sp_' + Date.now(),
      type,
      label,
      x: 50,
      y: 50,
      rotation: 0,
      powerRequired: type === 'drums' || type === 'bass_amp' || type === 'guitar_amp' || type === 'keyboard',
    };
    const updatedRider = {
      ...localRider,
      stagePlotItems: [...localRider.stagePlotItems, newItem],
    };
    setLocalRider(updatedRider);
    stageDb.saveStageRider(updatedRider);
    onUpdateRider(updatedRider);
  };

  const handleRemovePlotItem = (id: string) => {
    const updatedItems = localRider.stagePlotItems.filter((item) => item.id !== id);
    const updatedRider = { ...localRider, stagePlotItems: updatedItems };
    setLocalRider(updatedRider);
    stageDb.saveStageRider(updatedRider);
    onUpdateRider(updatedRider);
  };

  const handleUpdateInputChannel = (index: number, updates: Partial<InputChannel>) => {
    const channels = [...localRider.inputChannels];
    channels[index] = { ...channels[index], ...updates };
    const updatedRider = { ...localRider, inputChannels: channels };
    setLocalRider(updatedRider);
    stageDb.saveStageRider(updatedRider);
    onUpdateRider(updatedRider);
  };

  const handlePrintRider = () => {
    window.print();
  };

  return (
    <div id="gig-hub-root" className="min-h-[calc(100vh-60px)] bg-[#050505] text-zinc-100 p-3 sm:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Sub-Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono text-xs border border-orange-500/30">
              BAND LOGISTICS & PRODUCTION HUB
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">Gigs, Stage Plot & Tech Rider</h1>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setCurrentTab('gigs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'gigs' ? 'bg-orange-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Gigs & Venues
            </button>
            <button
              onClick={() => setCurrentTab('availability')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'availability' ? 'bg-orange-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Availability Matrix
            </button>
            <button
              onClick={() => setCurrentTab('stage_plot')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'stage_plot' ? 'bg-orange-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Visual Stage Plot
            </button>
            <button
              onClick={() => setCurrentTab('input_list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'input_list' ? 'bg-orange-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Tech Input List
            </button>
          </div>
        </div>

        {/* TAB 1: GIGS & VENUES MANAGEMENT */}
        {currentTab === 'gigs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-base uppercase tracking-wider">Upcoming Confirmed Gigs</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localGigs.map((gig) => {
                const confirmedCount = Object.values(gig.bandAvailability).filter((s) => s === 'available').length;
                const totalMembers = bandProfile.members.length;

                return (
                  <div
                    key={gig.id}
                    className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono font-bold text-xs border border-orange-500/30">
                          {gig.date}
                        </span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {gig.currency}{gig.performanceFee.toLocaleString()} Fee
                        </span>
                      </div>

                      <div>
                        <h3 className="font-black text-xl text-white">{gig.title}</h3>
                        <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{gig.venueName}, {gig.city}</span>
                        </div>
                      </div>

                      {/* Schedule Timeline */}
                      <div className="grid grid-cols-4 gap-1 text-center font-mono py-2 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px]">
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase">Load-In</span>
                          <span className="font-bold text-white">{gig.loadInTime}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase">Soundcheck</span>
                          <span className="font-bold text-orange-400">{gig.soundcheckTime}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase">Stage</span>
                          <span className="font-bold text-amber-300">{gig.stageTime}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase">Curfew</span>
                          <span className="font-bold text-red-400">{gig.curfewTime}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {gig.notes}
                      </p>
                    </div>

                    {/* Band Lineup Status */}
                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-zinc-300 font-medium">
                          {confirmedCount}/{totalMembers} Members Ready
                        </span>
                      </div>

                      <span className="text-emerald-400 font-bold text-[11px]">
                        {gig.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: BAND MEMBER AVAILABILITY MATRIX */}
        {currentTab === 'availability' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="font-bold text-white text-base uppercase tracking-wider">
                Band Member Availability Matrix
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tap any status indicator to toggle: Confirmed (Green) → Unavailable (Red) → Tentative (Amber)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase font-bold text-zinc-400">
                    <th className="py-3 px-4">Band Member & Role</th>
                    {localGigs.map((g) => (
                      <th key={g.id} className="py-3 px-4">
                        <div>
                          <span className="block text-white font-bold">{g.venueName}</span>
                          <span className="text-[10px] font-mono text-zinc-500">{g.date}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium">
                  {bandProfile.members.map((member) => (
                    <tr key={member.id} className="hover:bg-zinc-800/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                            style={{ backgroundColor: `${member.color}33`, color: member.color }}
                          >
                            {member.avatar}
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs block">{member.name}</span>
                            <span className="text-[10px] text-zinc-400 font-mono uppercase">{member.role}</span>
                          </div>
                        </div>
                      </td>

                      {localGigs.map((gig) => {
                        const status = gig.bandAvailability[member.id] || 'tentative';

                        return (
                          <td key={gig.id} className="py-3 px-4">
                            <button
                              onClick={() => handleToggleMemberAvailability(gig.id, member.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                status === 'available'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : status === 'unavailable'
                                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {status === 'available' && <CheckCircle2 className="w-3.5 h-3.5" />}
                              {status === 'unavailable' && <XCircle className="w-3.5 h-3.5" />}
                              {status === 'tentative' && <HelpCircle className="w-3.5 h-3.5" />}
                              <span className="capitalize">{status}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: VISUAL STAGE PLOT BUILDER */}
        {currentTab === 'stage_plot' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-white text-base uppercase tracking-wider">
                  Interactive Visual Stage Layout Builder
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Drag items onto the stage to position drum riser, guitar amps, DI boxes, and front microphones
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintRider}
                  className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 border border-zinc-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Plot
                </button>
              </div>
            </div>

            {/* Quick Add Palette */}
            <div className="flex flex-wrap gap-2 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="text-xs font-bold text-zinc-400 self-center mr-2">Add Gear:</span>
              <button
                onClick={() => handleAddPlotItem('vocal_mic', 'Vocal Mic Stand')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-800 cursor-pointer"
              >
                + Vocal Mic
              </button>
              <button
                onClick={() => handleAddPlotItem('guitar_amp', 'Guitar Amp / Cab')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-800 cursor-pointer"
              >
                + Guitar Amp
              </button>
              <button
                onClick={() => handleAddPlotItem('monitor_wedge', 'Monitor Wedge')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-800 cursor-pointer"
              >
                + Wedge
              </button>
              <button
                onClick={() => handleAddPlotItem('di_box', 'Active DI Box')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-800 cursor-pointer"
              >
                + DI Box
              </button>
              <button
                onClick={() => handleAddPlotItem('power_drop', '230V AC Power Drop')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-800 cursor-pointer"
              >
                + AC Power
              </button>
            </div>

            {/* Stage Canvas Area */}
            <div className="relative w-full h-[450px] bg-[#050505] rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col justify-between p-4 select-none">
              {/* Stage Backline Marker */}
              <div className="text-center font-mono font-bold text-xs uppercase tracking-widest text-zinc-600 border-b border-dashed border-zinc-800 pb-2">
                ▲ STAGE REAR / BACKLINE RISER ▲
              </div>

              {/* Draggable Plot Items */}
              {localRider.stagePlotItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="group cursor-move p-2.5 rounded-xl bg-zinc-900 border border-orange-500/80 shadow-lg text-center min-w-[110px]"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[9px] font-mono font-bold text-orange-400 uppercase">{item.type}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePlotItem(item.id);
                      }}
                      className="text-zinc-500 hover:text-red-400 text-[10px] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <span className="font-bold text-white text-xs block leading-tight">{item.label}</span>
                  {item.powerRequired && (
                    <span className="text-[9px] font-mono text-amber-400 font-bold block mt-0.5">⚡ 230V AC</span>
                  )}

                  {/* Nudge controls */}
                  <div className="hidden group-hover:flex items-center justify-center gap-1 mt-1.5 pt-1 border-t border-zinc-800">
                    <button
                      onClick={() => handleUpdatePlotItemPosition(item.id, item.x - 5, item.y)}
                      className="px-1 bg-zinc-800 text-[10px] rounded cursor-pointer"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => handleUpdatePlotItemPosition(item.id, item.x + 5, item.y)}
                      className="px-1 bg-zinc-800 text-[10px] rounded cursor-pointer"
                    >
                      →
                    </button>
                    <button
                      onClick={() => handleUpdatePlotItemPosition(item.id, item.x, item.y - 5)}
                      className="px-1 bg-zinc-800 text-[10px] rounded cursor-pointer"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleUpdatePlotItemPosition(item.id, item.x, item.y + 5)}
                      className="px-1 bg-zinc-800 text-[10px] rounded cursor-pointer"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}

              {/* Stage Front Marker */}
              <div className="text-center font-mono font-bold text-xs uppercase tracking-widest text-zinc-600 border-t border-dashed border-zinc-800 pt-2">
                ▼ STAGE FRONT / AUDIENCE FACING ▼
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TECHNICAL INPUT LIST GENERATOR */}
        {currentTab === 'input_list' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-white text-base uppercase tracking-wider">
                  Technical Stage Input List & FOH Patch Sheet
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  14-Channel professional patch list for venue front-of-house sound engineers
                </p>
              </div>

              <button
                onClick={handlePrintRider}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20"
              >
                <Printer className="w-3.5 h-3.5" /> Export PDF Rider
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase font-bold text-zinc-400 bg-zinc-950">
                    <th className="py-3 px-3">CH</th>
                    <th className="py-3 px-3">Instrument / Source</th>
                    <th className="py-3 px-3">Performer</th>
                    <th className="py-3 px-3">Mic / DI Box</th>
                    <th className="py-3 px-3">Stand Type</th>
                    <th className="py-3 px-3 text-center">48V</th>
                    <th className="py-3 px-3">Sound Tech Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {localRider.inputChannels.map((ch, idx) => (
                    <tr key={ch.channelNumber} className="hover:bg-zinc-800/40">
                      <td className="py-3 px-3 font-mono font-bold text-orange-400">
                        {ch.channelNumber < 10 ? `0${ch.channelNumber}` : ch.channelNumber}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">{ch.instrument}</td>
                      <td className="py-3 px-3 text-zinc-300">{ch.performer}</td>
                      <td className="py-3 px-3 text-amber-300 font-mono text-xs">{ch.micOrDI}</td>
                      <td className="py-3 px-3 text-zinc-400 text-xs">{ch.standType}</td>
                      <td className="py-3 px-3 text-center font-mono">
                        {ch.phantom48v ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/40">
                            +48V
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-zinc-400 text-xs">{ch.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* In-Ear Monitor Routing Warning */}
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-300 space-y-1">
              <span className="font-bold block uppercase tracking-wider">
                CRITICAL IN-EAR MONITOR ROUTING NOTE:
              </span>
              <p>
                Channel 14 (BandSync Click & Voice Cue) is an isolated stage cue bus. It MUST be routed exclusively
                into wireless IEM receivers and under no circumstances unmuted into Front-of-House PA speakers.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
