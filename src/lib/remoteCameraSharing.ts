import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RemoteCameraSession {
  id: string;
  user_id: string;
  device_name: string;
  device_type: 'phone' | 'tablet' | 'desktop';
  status: 'waiting' | 'connected' | 'disconnected';
  sdp_offer: string | null;
  sdp_answer: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface ICECandidate {
  id: string;
  session_id: string;
  candidate: RTCIceCandidateInit;
  from_device: 'camera' | 'viewer';
  created_at: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function getDeviceType(): 'phone' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'phone';
  }
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android[^;]*;\s*([^)]+)/);
    return match ? match[1].split(' Build')[0].trim() : 'Android';
  }
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'Unknown Device';
}

export class RemoteCameraProvider {
  private session: RemoteCameraSession | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private channel: RealtimeChannel | null = null;
  private heartbeatInterval: number | null = null;
  private onStatusChange?: (status: string) => void;
  private onError?: (error: string) => void;

  constructor(callbacks?: {
    onStatusChange?: (status: string) => void;
    onError?: (error: string) => void;
  }) {
    this.onStatusChange = callbacks?.onStatusChange;
    this.onError = callbacks?.onError;
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = window.setInterval(async () => {
      if (this.session) {
        const newExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await supabase
          .from('remote_camera_sessions')
          .update({
            updated_at: new Date().toISOString(),
            expires_at: newExpiry
          })
          .eq('id', this.session.id);
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async startSharing(stream: MediaStream): Promise<string | null> {
    try {
      this.localStream = stream;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        this.onError?.('Not authenticated');
        return null;
      }

      const { data: session, error } = await supabase
        .from('remote_camera_sessions')
        .insert({
          user_id: userData.user.id,
          device_name: getDeviceName(),
          device_type: getDeviceType(),
          status: 'waiting',
        })
        .select()
        .single();

      if (error || !session) {
        this.onError?.('Failed to create session');
        return null;
      }

      this.session = session;
      this.onStatusChange?.('waiting');

      this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, stream);
      });

      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate && this.session) {
          await supabase.from('remote_camera_ice_candidates').insert({
            session_id: this.session.id,
            candidate: event.candidate.toJSON(),
            from_device: 'camera',
          });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        if (state === 'connected') {
          this.onStatusChange?.('connected');
          this.updateSessionStatus('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          this.onStatusChange?.('disconnected');
          this.updateSessionStatus('disconnected');
        }
      };

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await this.peerConnection.setLocalDescription(offer);

      await supabase
        .from('remote_camera_sessions')
        .update({ sdp_offer: JSON.stringify(offer) })
        .eq('id', this.session.id);

      this.subscribeToSignaling();
      this.startHeartbeat();

      return this.session.id;
    } catch (err) {
      this.onError?.(`Failed to start sharing: ${err}`);
      return null;
    }
  }

  private subscribeToSignaling() {
    if (!this.session) return;

    this.channel = supabase
      .channel(`camera-session-${this.session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'remote_camera_sessions',
          filter: `id=eq.${this.session.id}`,
        },
        async (payload) => {
          const updated = payload.new as RemoteCameraSession;
          if (updated.sdp_answer && !this.peerConnection?.remoteDescription) {
            const answer = JSON.parse(updated.sdp_answer);
            await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(answer));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'remote_camera_ice_candidates',
          filter: `session_id=eq.${this.session.id}`,
        },
        async (payload) => {
          const candidate = payload.new as ICECandidate;
          if (candidate.from_device === 'viewer') {
            await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate.candidate));
          }
        }
      )
      .subscribe();
  }

  private async updateSessionStatus(status: 'waiting' | 'connected' | 'disconnected') {
    if (!this.session) return;
    await supabase
      .from('remote_camera_sessions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', this.session.id);
  }

  async stopSharing() {
    this.stopHeartbeat();

    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.session) {
      await supabase
        .from('remote_camera_sessions')
        .delete()
        .eq('id', this.session.id);
      this.session = null;
    }

    this.onStatusChange?.('disconnected');
  }

  getSessionId(): string | null {
    return this.session?.id || null;
  }
}

export class RemoteCameraViewer {
  private peerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;
  private onStream?: (stream: MediaStream) => void;
  private onStatusChange?: (status: string) => void;
  private onError?: (error: string) => void;

  constructor(callbacks?: {
    onStream?: (stream: MediaStream) => void;
    onStatusChange?: (status: string) => void;
    onError?: (error: string) => void;
  }) {
    this.onStream = callbacks?.onStream;
    this.onStatusChange = callbacks?.onStatusChange;
    this.onError = callbacks?.onError;
  }

  async connectToSession(sessionId: string): Promise<boolean> {
    try {
      this.sessionId = sessionId;

      const { data: session, error } = await supabase
        .from('remote_camera_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        this.onError?.('Session not found');
        return false;
      }

      if (!session.sdp_offer) {
        this.onError?.('Session not ready');
        return false;
      }

      this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.onStream?.(this.remoteStream);
      };

      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await supabase.from('remote_camera_ice_candidates').insert({
            session_id: sessionId,
            candidate: event.candidate.toJSON(),
            from_device: 'viewer',
          });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        if (state === 'connected') {
          this.onStatusChange?.('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          this.onStatusChange?.('disconnected');
        }
      };

      const offer = JSON.parse(session.sdp_offer);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const { data: candidates } = await supabase
        .from('remote_camera_ice_candidates')
        .select('*')
        .eq('session_id', sessionId)
        .eq('from_device', 'camera');

      if (candidates) {
        for (const c of candidates) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(c.candidate));
        }
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      await supabase
        .from('remote_camera_sessions')
        .update({ sdp_answer: JSON.stringify(answer) })
        .eq('id', sessionId);

      this.subscribeToSignaling(sessionId);

      return true;
    } catch (err) {
      this.onError?.(`Failed to connect: ${err}`);
      return false;
    }
  }

  private subscribeToSignaling(sessionId: string) {
    this.channel = supabase
      .channel(`camera-viewer-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'remote_camera_ice_candidates',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const candidate = payload.new as ICECandidate;
          if (candidate.from_device === 'camera' && this.peerConnection) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate.candidate));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'remote_camera_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          this.onStatusChange?.('disconnected');
          this.disconnect();
        }
      )
      .subscribe();
  }

  async disconnect() {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.sessionId = null;
  }

  getStream(): MediaStream | null {
    return this.remoteStream;
  }
}

export async function getActiveRemoteCameras(): Promise<RemoteCameraSession[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('remote_camera_sessions')
    .select('*')
    .eq('user_id', userData.user.id)
    .in('status', ['waiting', 'connected'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export function subscribeToRemoteCameras(
  userId: string,
  callback: (sessions: RemoteCameraSession[]) => void
): RealtimeChannel {
  const channel = supabase
    .channel('remote-cameras-list')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'remote_camera_sessions',
        filter: `user_id=eq.${userId}`,
      },
      async () => {
        const sessions = await getActiveRemoteCameras();
        callback(sessions);
      }
    )
    .subscribe();

  return channel;
}
