import { Song, SongSection, Setlist } from '../types';

/**
 * Calculates the duration of a single section in seconds
 */
export function calculateSectionDurationSec(section: SongSection, songBpm: number): number {
  if (!section || section.bars <= 0) return 0;
  const bpm = section.bpmOverride && section.bpmOverride > 0 ? section.bpmOverride : songBpm || 120;
  
  let beatsPerBar = 4;
  if (section.timeSignature === '3/4') beatsPerBar = 3;
  else if (section.timeSignature === '6/8') beatsPerBar = 6;
  else if (section.timeSignature === '2/4') beatsPerBar = 2;
  else if (section.timeSignature === '5/4') beatsPerBar = 5;
  else if (section.timeSignature === '7/8') beatsPerBar = 7;
  else if (section.timeSignature === '12/8') beatsPerBar = 12;

  // In 6/8 and 12/8 compound meters, each eighth note is (60 / (bpm * 1.5)) or standard tempo
  const secPerBeat = section.timeSignature === '6/8' || section.timeSignature === '12/8' 
    ? (60 / (bpm * 1.5)) 
    : (60 / bpm);

  return section.bars * beatsPerBar * secPerBeat;
}

/**
 * Calculates the total duration of a song in seconds based on its sections
 */
export function calculateSongDurationSec(song: Song | null): number {
  if (!song || !song.sections || song.sections.length === 0) return 180; // 3 min fallback

  const sectionsDuration = song.sections.reduce((acc, sec) => {
    return acc + calculateSectionDurationSec(sec, song.bpm);
  }, 0);

  // Add lead-in count-in bars
  const leadInBeats = (song.leadInBars || 1) * (song.timeSignature === '3/4' ? 3 : 4);
  const leadInSec = (leadInBeats * 60) / (song.bpm || 120);

  return Math.round(sectionsDuration + leadInSec);
}

/**
 * Calculates elapsed seconds for a currently playing song
 */
export function calculateSongElapsedSec(
  song: Song | null,
  currentSectionIndex: number,
  currentBar: number,
  currentBeat: number,
  currentBpm: number
): number {
  if (!song || !song.sections || song.sections.length === 0) return 0;

  // Sum completed sections
  let elapsed = 0;
  for (let i = 0; i < Math.min(currentSectionIndex, song.sections.length); i++) {
    elapsed += calculateSectionDurationSec(song.sections[i], song.bpm);
  }

  // Add progress within active section
  const activeSection = song.sections[currentSectionIndex];
  if (activeSection) {
    const bpm = activeSection.bpmOverride || currentBpm || song.bpm || 120;
    const beatsPerBar = activeSection.timeSignature === '3/4' ? 3 : activeSection.timeSignature === '2/4' ? 2 : 4;
    const secPerBeat = 60 / bpm;
    const completedBarsSec = Math.max(0, currentBar - 1) * beatsPerBar * secPerBeat;
    const completedBeatsSec = Math.max(0, currentBeat - 1) * secPerBeat;
    elapsed += completedBarsSec + completedBeatsSec;
  }

  return Math.max(0, elapsed);
}

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatTimeDisplay(totalSec: number, includeHours: boolean = false): string {
  const safeSec = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(safeSec / 3600);
  const minutes = Math.floor((safeSec % 3600) / 60);
  const seconds = safeSec % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (includeHours || hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

export interface SetTimingMetrics {
  currentSetGroup: 'Set 1' | 'Set 2' | 'Encore';
  currentSongIndexInSet: number;
  totalSongsInSet: number;
  
  // Song timing
  songTotalSec: number;
  songElapsedSec: number;
  songRemainingSec: number;
  songProgressPercent: number;

  // Set timing
  setTotalSec: number;
  setElapsedSec: number;
  setRemainingSec: number;
  setProgressPercent: number;

  // Total Gig timing
  gigTotalSec: number;
  gigElapsedSec: number;
  gigRemainingSec: number;
  gigProgressPercent: number;
}

/**
 * Computes live set & gig metrics
 */
export function computeLiveTiming(
  setlist: Setlist,
  allSongs: Song[],
  currentSongIndex: number,
  currentSectionIndex: number,
  currentBar: number,
  currentBeat: number,
  currentBpm: number,
  isPlaying: boolean
): SetTimingMetrics {
  const items = setlist?.items || [];
  const totalSongs = items.length;
  const safeSongIndex = Math.max(0, Math.min(currentSongIndex, totalSongs - 1));
  const currentItem = items[safeSongIndex];

  // Derive song object
  const currentSong = allSongs.find((s) => s.id === currentItem?.songId) || null;
  const currentSetGroup: 'Set 1' | 'Set 2' | 'Encore' = 
    (currentItem?.setGroup as any) || (safeSongIndex < 14 ? 'Set 1' : safeSongIndex < 28 ? 'Set 2' : 'Encore');

  // Song timing
  const songTotalSec = calculateSongDurationSec(currentSong);
  const songElapsedSec = isPlaying 
    ? Math.min(songTotalSec, calculateSongElapsedSec(currentSong, currentSectionIndex, currentBar, currentBeat, currentBpm))
    : 0;
  const songRemainingSec = Math.max(0, songTotalSec - songElapsedSec);
  const songProgressPercent = songTotalSec > 0 ? (songElapsedSec / songTotalSec) * 100 : 0;

  const bufferSec = setlist.interSongBufferSec || 20;

  // Categorize songs by set group
  const set1Items: { item: typeof items[0]; song: Song | null; index: number }[] = [];
  const set2Items: { item: typeof items[0]; song: Song | null; index: number }[] = [];
  const encoreItems: { item: typeof items[0]; song: Song | null; index: number }[] = [];

  items.forEach((item, idx) => {
    const s = allSongs.find((song) => song.id === item.songId) || null;
    const group = item.setGroup || (idx < 14 ? 'Set 1' : idx < 28 ? 'Set 2' : 'Encore');
    if (group === 'Set 1') set1Items.push({ item, song: s, index: idx });
    else if (group === 'Set 2') set2Items.push({ item, song: s, index: idx });
    else encoreItems.push({ item, song: s, index: idx });
  });

  const activeSetList = currentSetGroup === 'Set 1' ? set1Items : currentSetGroup === 'Set 2' ? set2Items : encoreItems;
  const totalSongsInSet = activeSetList.length;
  const currentSongIndexInSet = Math.max(1, activeSetList.findIndex((x) => x.index === safeSongIndex) + 1);

  // Calculate Set Total Duration
  const setTotalSec = activeSetList.reduce((acc, entry, idx) => {
    const dur = calculateSongDurationSec(entry.song);
    const buf = idx < activeSetList.length - 1 ? bufferSec : 0;
    return acc + dur + buf;
  }, 0);

  // Calculate Set Elapsed & Remaining
  let setElapsedSec = 0;
  let setRemainingSec = 0;

  activeSetList.forEach((entry) => {
    const dur = calculateSongDurationSec(entry.song);
    if (entry.index < safeSongIndex) {
      // Completed song in this set
      setElapsedSec += dur + bufferSec;
    } else if (entry.index === safeSongIndex) {
      // Currently active song
      setElapsedSec += songElapsedSec;
      setRemainingSec += songRemainingSec + bufferSec;
    } else {
      // Future song in this set
      setRemainingSec += dur + bufferSec;
    }
  });

  // Clamp remaining
  setRemainingSec = Math.max(0, setRemainingSec);
  const setProgressPercent = setTotalSec > 0 ? Math.min(100, (setElapsedSec / setTotalSec) * 100) : 0;

  // Gig Total & Remaining
  let gigTotalSec = 0;
  let gigElapsedSec = 0;
  let gigRemainingSec = 0;

  items.forEach((item, idx) => {
    const s = allSongs.find((song) => song.id === item.songId) || null;
    const dur = calculateSongDurationSec(s);
    gigTotalSec += dur + bufferSec;

    if (idx < safeSongIndex) {
      gigElapsedSec += dur + bufferSec;
    } else if (idx === safeSongIndex) {
      gigElapsedSec += songElapsedSec;
      gigRemainingSec += songRemainingSec + bufferSec;
    } else {
      gigRemainingSec += dur + bufferSec;
    }
  });

  // Add intermission buffer if configured (e.g. 20 min)
  const intermissionSec = (setlist.intermissionMinutes || 20) * 60;
  gigTotalSec += intermissionSec;
  if (currentSetGroup === 'Set 2' || currentSetGroup === 'Encore') {
    gigElapsedSec += intermissionSec;
  } else {
    gigRemainingSec += intermissionSec;
  }

  const gigProgressPercent = gigTotalSec > 0 ? Math.min(100, (gigElapsedSec / gigTotalSec) * 100) : 0;

  return {
    currentSetGroup,
    currentSongIndexInSet,
    totalSongsInSet,
    songTotalSec,
    songElapsedSec,
    songRemainingSec,
    songProgressPercent,
    setTotalSec,
    setElapsedSec,
    setRemainingSec,
    setProgressPercent,
    gigTotalSec,
    gigElapsedSec,
    gigRemainingSec,
    gigProgressPercent,
  };
}
