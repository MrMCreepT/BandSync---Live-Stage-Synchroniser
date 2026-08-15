import { Song } from '../types';

export interface PlaylistAnalysisResult {
  playlistTitle: string;
  tracks: Array<{
    title: string;
    artist: string;
    suggestedKey?: string;
    suggestedBpm?: number;
    estimatedDurationSec?: number;
    setGroup?: string;
  }>;
}

export const aiTrackService = {
  async analyzeTrack(query: string, customKey?: string, roleNotesFocus?: string): Promise<Song> {
    const response = await fetch('/api/gemini/analyze-track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, customKey, roleNotesFocus }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.song) {
      throw new Error('Invalid song response format received from AI.');
    }

    return data.song;
  },

  async analyzePlaylist(urlOrText: string): Promise<PlaylistAnalysisResult> {
    const response = await fetch('/api/gemini/analyze-playlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urlOrText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.playlist) {
      throw new Error('Invalid playlist response format received from AI.');
    }

    return data.playlist;
  },
};
