import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for AI song analysis');
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // WebSocket Server on the same HTTP server
  const wss = new WebSocketServer({ server, path: '/ws' });

  interface ClientInfo {
    id: string;
    name: string;
    role: string;
    isMaster: boolean;
    lastPing: number;
    latencyMs: number;
  }

  const clients = new Map<WebSocket, ClientInfo>();

  function broadcast(data: any, senderWs?: WebSocket) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== senderWs) {
        client.send(message);
      }
    });
  }

  function broadcastAll(data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  wss.on('connection', (ws: WebSocket) => {
    const clientId = 'member_' + Math.random().toString(36).substring(2, 9);
    const clientInfo: ClientInfo = {
      id: clientId,
      name: 'Band Member',
      role: 'sound_tech',
      isMaster: false,
      lastPing: Date.now(),
      latencyMs: 0,
    };
    clients.set(ws, clientInfo);

    // Send welcome and current server time for initial clock calibration
    ws.send(JSON.stringify({
      type: 'INIT_ACK',
      clientId,
      serverTime: Date.now(),
      connectedClientsCount: wss.clients.size,
    }));

    // Broadcast member list
    sendConnectedMembers();

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message.toString());

        switch (payload.type) {
          case 'SYNC_PING': {
            // High-precision clock sync: return client's origin timestamp + server receive timestamp
            const serverTime = Date.now();
            ws.send(JSON.stringify({
              type: 'SYNC_PONG',
              clientTimestamp: payload.clientTimestamp,
              serverReceiveTimestamp: serverTime,
              serverSendTimestamp: Date.now(),
            }));
            break;
          }

          case 'REGISTER_MEMBER': {
            const current = clients.get(ws);
            if (current) {
              current.id = payload.id || current.id;
              current.name = payload.name || current.name;
              current.role = payload.role || current.role;
              current.isMaster = !!payload.isMaster;
              current.latencyMs = payload.latencyMs || 0;
            }
            sendConnectedMembers();
            break;
          }

          case 'SCHEDULED_PLAY': {
            // Master schedules playback with timestamp
            broadcastAll({
              type: 'SCHEDULED_PLAY',
              songId: payload.songId,
              sectionIndex: payload.sectionIndex || 0,
              startBar: payload.startBar || 1,
              targetTimestamp: payload.targetTimestamp, // e.g. Date.now() + 1000
              bpm: payload.bpm,
              senderId: payload.senderId,
            });
            break;
          }

          case 'PAUSE_PLAYBACK': {
            broadcastAll({
              type: 'PAUSE_PLAYBACK',
              songId: payload.songId,
              senderId: payload.senderId,
            });
            break;
          }

          case 'STOP_PLAYBACK': {
            broadcastAll({
              type: 'STOP_PLAYBACK',
              songId: payload.songId,
              senderId: payload.senderId,
            });
            break;
          }

          case 'SEEK_SECTION': {
            broadcastAll({
              type: 'SEEK_SECTION',
              songId: payload.songId,
              sectionIndex: payload.sectionIndex,
              targetTimestamp: payload.targetTimestamp,
              senderId: payload.senderId,
            });
            break;
          }

          case 'CHANGE_SONG': {
            broadcastAll({
              type: 'CHANGE_SONG',
              songId: payload.songId,
              setlistIndex: payload.setlistIndex,
              senderId: payload.senderId,
            });
            break;
          }

          case 'EMERGENCY_CUE': {
            // Instant broadcast to all members with high priority
            broadcastAll({
              type: 'EMERGENCY_CUE',
              cue: payload.cue,
              label: payload.label,
              customText: payload.customText,
              senderName: payload.senderName,
              senderRole: payload.senderRole,
              timestamp: Date.now(),
              color: payload.color || '#ef4444',
            });
            break;
          }

          case 'DISMISS_CUE': {
            broadcastAll({
              type: 'DISMISS_CUE',
              cueId: payload.cueId,
            });
            break;
          }

          case 'SETLIST_PUSH': {
            // Push setlist changes across band devices
            broadcast({
              type: 'SETLIST_PUSH',
              setlist: payload.setlist,
              senderId: payload.senderId,
            }, ws);
            break;
          }

          case 'TRACK_UPDATE_PUSH': {
            broadcast({
              type: 'TRACK_UPDATE_PUSH',
              song: payload.song,
              senderId: payload.senderId,
            }, ws);
            break;
          }

          case 'STAGE_PLOT_PUSH': {
            broadcast({
              type: 'STAGE_PLOT_PUSH',
              stagePlot: payload.stagePlot,
              senderId: payload.senderId,
            }, ws);
            break;
          }

          default:
            // Forward any other custom message
            broadcast(payload, ws);
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      sendConnectedMembers();
    });
  });

  function sendConnectedMembers() {
    const memberList = Array.from(clients.values());
    broadcastAll({
      type: 'MEMBER_LIST_UPDATE',
      members: memberList,
      serverTime: Date.now(),
    });
  }

  // API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'BandSync Local Wi-Fi Stage Bridge',
      serverTime: Date.now(),
      connectedDevices: wss.clients.size,
      aiAnalyzerAvailable: !!process.env.GEMINI_API_KEY,
    });
  });

  app.get('/api/sync/time', (req, res) => {
    res.json({
      serverTime: Date.now(),
      precision: 'high',
    });
  });

  // AI Track Analyzer: Analyze a YouTube/Spotify/Link or Song Title & Artist
  app.post('/api/gemini/analyze-track', async (req, res) => {
    try {
      const { query, customKey, roleNotesFocus } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Please provide a song link or song name/artist.' });
      }

      const ai = getGeminiClient();

      const prompt = `You are a professional musical director and live band stage coordinator.
Your task is to search for and extract the REAL, AUTHENTIC, VERBATIM, 100% COMPLETE LIVE BAND ARRANGEMENT with full lyrics and chord charts for this song:

SONG / LINK / QUERY:
"${query.trim()}"
${customKey ? `TARGET KEY REQUESTED: ${customKey}` : ''}
${roleNotesFocus ? `FOCUS ROLE: ${roleNotesFocus}` : ''}

CRITICAL RULES FOR REAL BAND PERFORMANCE:
1. NEVER USE PLACEHOLDER TEXT. NEVER write generic lines like "Full complete lyrics of the first verse...", "[Repeat Chorus]", "...", or "Instrumental lines...".
2. VERBATIM FULL LYRICS: Provide the ACTUAL REAL RECORDED LYRICS for EVERY Verse 1, Verse 2, Verse 3, Chorus, Pre-Chorus, Bridge, and Outro.
3. ACCURATE HARMONY & CHORDS: Provide the real chord progression for each section (e.g. "C#m | B | A | G#m" or "G | D/F# | Em | C").
4. ACCURATE BAR COUNTS: Provide realistic live performance bar counts for each section (typically 4, 8, 16, or 32 bars).
5. INSTRUMENT CUES (drums, bass, lead_guitar, rhythm_guitar, keys, lead_vocals, backing_vocals, sound_tech): Specific, actionable instructions for a live 5-piece rock/pop band.
6. BASS TAB: Real 4-string bass tab for the main groove or riff.

Respond with ONLY valid JSON inside \`\`\`json ... \`\`\` code block (or pure JSON) with this exact schema:
{
  "title": "Real Song Title",
  "artist": "Original Artist Name",
  "bpm": 120,
  "timeSignature": "4/4",
  "key": "E Minor",
  "leadInBars": 1,
  "bufferSecondsAfter": 20,
  "tags": ["Rock", "Singalong"],
  "notes": "Key live arrangement notes or transitions.",
  "sections": [
    {
      "name": "Intro",
      "type": "intro",
      "bars": 8,
      "timeSignature": "4/4",
      "color": "#3b82f6",
      "chords": "Em | C | G | D",
      "lyrics": "(Drum count-in and guitar hook)",
      "bassTab": "G|------------------|\\nD|------------------|\\nA|------3-3---------|\\nE|-0-0------3-3-2-2-|",
      "roleNotes": {
        "drums": "Kick 4-on-floor, snare fill on bar 8",
        "bass": "Driving 8th notes on root",
        "lead_guitar": "Main intro hook",
        "rhythm_guitar": "Punchy chords on 1 and 3",
        "keys": "Bright pad swell",
        "lead_vocals": "Count in the band",
        "backing_vocals": "Tacet",
        "sound_tech": "Push guitar lead in FOH"
      }
    },
    {
      "name": "Verse 1",
      "type": "verse",
      "bars": 16,
      "timeSignature": "4/4",
      "color": "#10b981",
      "chords": "Em | C | G | D",
      "lyrics": "First actual line of the real song\\nSecond actual line of the real song\\nThird actual line of the real song\\nFourth actual line of the real song",
      "roleNotes": {
        "drums": "Tight hi-hat groove, cross-stick",
        "bass": "Staccato root notes following kick",
        "lead_guitar": "Clean rhythmic chops",
        "rhythm_guitar": "Acoustic open strumming",
        "keys": "Warm Rhodes electric piano",
        "lead_vocals": "Intimate vocal delivery on mic",
        "backing_vocals": "Tacet",
        "sound_tech": "Vocals centered, gentle compression"
      }
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2,
        },
      });

      const responseText = response.text || '';
      let songData;
      try {
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        songData = JSON.parse(cleaned);
      } catch (parseErr) {
        // Fallback search with standard JSON format if needed
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          songData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse song structure from AI response.');
        }
      }

      // Ensure valid ID and timestamps
      const generatedSong = {
        ...songData,
        id: 'ai_song_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sections: (songData.sections || []).map((sec: any, idx: number) => ({
          ...sec,
          id: `sec_${idx + 1}_` + Math.random().toString(36).substring(2, 6),
          bars: Number(sec.bars) || 8,
          timeSignature: sec.timeSignature || songData.timeSignature || '4/4',
          color: sec.color || (sec.type === 'chorus' ? '#ef4444' : sec.type === 'verse' ? '#10b981' : '#3b82f6'),
        })),
      };

      res.json({
        success: true,
        song: generatedSong,
      });
    } catch (err: any) {
      console.error('Gemini analyze-track error:', err);
      res.status(500).json({
        error: err.message || 'Failed to analyze track with AI.',
      });
    }
  });

  // AI Playlist Analyzer: Extract all track titles & artists from a playlist link or setlist text
  app.post('/api/gemini/analyze-playlist', async (req, res) => {
    try {
      const { urlOrText } = req.body;

      if (!urlOrText || typeof urlOrText !== 'string' || !urlOrText.trim()) {
        return res.status(400).json({ error: 'Please provide a playlist link or setlist text.' });
      }

      const ai = getGeminiClient();

      const prompt = `You are an expert live band music manager.
The user provided a playlist link, URL, or pasted text representing their setlist:
"${urlOrText.trim()}"

Use Google Search to look up the exact playlist URL or parse the pasted text to find the genuine, real song titles and artist names.
Extract every real song into an organized setlist list.

Respond with ONLY valid JSON inside \`\`\`json ... \`\`\` code block (or pure JSON) with this exact structure:
{
  "playlistTitle": "Exact Playlist or Gig Name",
  "tracks": [
    {
      "title": "Real Song Title",
      "artist": "Artist Name",
      "suggestedKey": "E Minor",
      "suggestedBpm": 128,
      "estimatedDurationSec": 210,
      "setGroup": "Set 1"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2,
        },
      });

      const responseText = response.text || '';
      let playlistData;
      try {
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        playlistData = JSON.parse(cleaned);
      } catch (parseErr) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          playlistData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse playlist tracks from AI response.');
        }
      }

      res.json({
        success: true,
        playlist: playlistData,
      });
    } catch (err: any) {
      console.error('Gemini analyze-playlist error:', err);
      res.status(500).json({
        error: err.message || 'Failed to analyze playlist with AI.',
      });
    }
  });

  // Vite middleware for dev or static serving for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BandSync stage engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
