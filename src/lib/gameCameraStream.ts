import { supabase } from './supabase';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface GameCameraSession {
  id: string;
  room_id: string;
  user_id: string;
  status: string;
  sdp_offer: string | null;
  sdp_answer: string | null;
}

export class GameCameraProvider {
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private sessionId: string | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private roomId: string;
  private userId: string;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  async start(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: false,
      });

      const { data, error } = await supabase
        .from('game_camera_sessions')
        .upsert({
          room_id: this.roomId,
          user_id: this.userId,
          status: 'waiting',
          sdp_offer: null,
          sdp_answer: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'room_id,user_id' })
        .select()
        .maybeSingle();

      if (error || !data) return false;
      this.sessionId = data.id;

      this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      this.stream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.stream!);
      });

      this.pc.onicecandidate = async (event) => {
        if (event.candidate && this.sessionId) {
          await supabase.from('game_camera_ice_candidates').insert({
            session_id: this.sessionId,
            candidate: event.candidate.toJSON(),
            from_user_id: this.userId,
          });
        }
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      await supabase
        .from('game_camera_sessions')
        .update({
          sdp_offer: JSON.stringify(offer),
          status: 'waiting',
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.sessionId);

      this.channel = supabase
        .channel(`game-cam-provider-${this.sessionId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_camera_sessions',
          filter: `id=eq.${this.sessionId}`,
        }, async (payload) => {
          const session = payload.new as GameCameraSession;
          if (session.sdp_answer && this.pc && !this.pc.currentRemoteDescription) {
            try {
              const answer = JSON.parse(session.sdp_answer);
              await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
              await supabase
                .from('game_camera_sessions')
                .update({ status: 'connected', updated_at: new Date().toISOString() })
                .eq('id', this.sessionId);
            } catch (e) {
              console.error('[GameCamera] Failed to set remote description:', e);
            }
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'game_camera_ice_candidates',
          filter: `session_id=eq.${this.sessionId}`,
        }, async (payload) => {
          const row = payload.new as { from_user_id: string; candidate: RTCIceCandidateInit };
          if (row.from_user_id !== this.userId && this.pc) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(row.candidate));
            } catch (e) {
              console.error('[GameCamera] ICE candidate error:', e);
            }
          }
        })
        .subscribe();

      return true;
    } catch (e) {
      console.error('[GameCamera] Provider start failed:', e);
      return false;
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async stop() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.sessionId) {
      await supabase
        .from('game_camera_sessions')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', this.sessionId);
      this.sessionId = null;
    }
  }
}

export class GameCameraViewer {
  private pc: RTCPeerConnection | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private remoteStream: MediaStream | null = null;
  private sessionId: string | null = null;
  private userId: string;
  private onStream: ((stream: MediaStream) => void) | null = null;
  private onDisconnect: (() => void) | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  setOnStream(cb: (stream: MediaStream) => void) {
    this.onStream = cb;
  }

  setOnDisconnect(cb: () => void) {
    this.onDisconnect = cb;
  }

  async connect(session: GameCameraSession): Promise<boolean> {
    if (!session.sdp_offer) return false;

    this.sessionId = session.id;

    try {
      this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      this.pc.ontrack = (event) => {
        this.remoteStream = event.streams[0] || new MediaStream([event.track]);
        this.onStream?.(this.remoteStream);
      };

      this.pc.oniceconnectionstatechange = () => {
        if (this.pc?.iceConnectionState === 'disconnected' || this.pc?.iceConnectionState === 'failed') {
          this.onDisconnect?.();
        }
      };

      this.pc.onicecandidate = async (event) => {
        if (event.candidate && this.sessionId) {
          await supabase.from('game_camera_ice_candidates').insert({
            session_id: this.sessionId,
            candidate: event.candidate.toJSON(),
            from_user_id: this.userId,
          });
        }
      };

      const offer = JSON.parse(session.sdp_offer);
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

      const { data: existingCandidates } = await supabase
        .from('game_camera_ice_candidates')
        .select('*')
        .eq('session_id', this.sessionId)
        .neq('from_user_id', this.userId);

      if (existingCandidates) {
        for (const row of existingCandidates) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(row.candidate));
          } catch {}
        }
      }

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      await supabase
        .from('game_camera_sessions')
        .update({
          sdp_answer: JSON.stringify(answer),
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.sessionId);

      this.channel = supabase
        .channel(`game-cam-viewer-${this.sessionId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'game_camera_ice_candidates',
          filter: `session_id=eq.${this.sessionId}`,
        }, async (payload) => {
          const row = payload.new as { from_user_id: string; candidate: RTCIceCandidateInit };
          if (row.from_user_id !== this.userId && this.pc) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(row.candidate));
            } catch {}
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_camera_sessions',
          filter: `id=eq.${this.sessionId}`,
        }, (payload) => {
          const session = payload.new as GameCameraSession;
          if (session.status === 'disconnected') {
            this.onDisconnect?.();
          }
        })
        .subscribe();

      return true;
    } catch (e) {
      console.error('[GameCamera] Viewer connect failed:', e);
      return false;
    }
  }

  getStream(): MediaStream | null {
    return this.remoteStream;
  }

  disconnect() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
    this.sessionId = null;
  }
}

export async function getGameCameraSessions(roomId: string): Promise<GameCameraSession[]> {
  const { data } = await supabase
    .from('game_camera_sessions')
    .select('*')
    .eq('room_id', roomId)
    .in('status', ['waiting', 'connected']);
  return data || [];
}
