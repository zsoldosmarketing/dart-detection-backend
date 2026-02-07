import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Camera, CameraOff, Wifi, WifiOff } from 'lucide-react';
import {
  GameCameraViewer,
  GameCameraProvider,
  getGameCameraSessions,
  type GameCameraSession,
} from '../../lib/gameCameraStream';

interface OpponentCameraFeedProps {
  roomId: string;
  userId: string;
  opponentName: string;
  isMyTurn: boolean;
}

type ConnectionState = 'idle' | 'searching' | 'connecting' | 'connected' | 'disconnected' | 'no-camera';

export function OpponentCameraFeed({ roomId, userId, opponentName, isMyTurn }: OpponentCameraFeedProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<GameCameraViewer | null>(null);
  const providerRef = useRef<GameCameraProvider | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedSessionIdRef = useRef<string | null>(null);

  const startProvider = useCallback(async () => {
    if (providerRef.current) return;

    const provider = new GameCameraProvider(roomId, userId);
    const started = await provider.start();
    if (started) {
      providerRef.current = provider;
    }
  }, [roomId, userId]);

  const connectToOpponent = useCallback(async (session: GameCameraSession) => {
    if (connectedSessionIdRef.current === session.id) return;

    if (viewerRef.current) {
      viewerRef.current.disconnect();
    }

    setConnectionState('connecting');
    connectedSessionIdRef.current = session.id;

    const viewer = new GameCameraViewer(userId);

    viewer.setOnStream((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setConnectionState('connected');
      setErrorMessage(null);
    });

    viewer.setOnDisconnect(() => {
      setConnectionState('disconnected');
      connectedSessionIdRef.current = null;
    });

    viewerRef.current = viewer;

    const connected = await viewer.connect(session);
    if (!connected) {
      setConnectionState('disconnected');
      setErrorMessage('Nem sikerult csatlakozni');
      connectedSessionIdRef.current = null;
    }
  }, [userId]);

  const pollForOpponentCamera = useCallback(async () => {
    const sessions = await getGameCameraSessions(roomId);
    const opponentSession = sessions.find(s => s.user_id !== userId);

    if (opponentSession) {
      if (connectedSessionIdRef.current !== opponentSession.id) {
        await connectToOpponent(opponentSession);
      }
    } else if (connectionState !== 'connected') {
      setConnectionState('searching');
    }
  }, [roomId, userId, connectToOpponent, connectionState]);

  useEffect(() => {
    startProvider();

    return () => {
      if (providerRef.current) {
        providerRef.current.stop();
        providerRef.current = null;
      }
    };
  }, [startProvider]);

  useEffect(() => {
    pollForOpponentCamera();

    pollIntervalRef.current = setInterval(pollForOpponentCamera, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pollForOpponentCamera]);

  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.disconnect();
        viewerRef.current = null;
      }
      connectedSessionIdRef.current = null;
    };
  }, []);

  if (isMyTurn) return null;

  return (
    <Card className="shrink-0 overflow-hidden">
      <div className="relative">
        {connectionState === 'connected' ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-48 md:h-64 object-cover bg-dark-900 rounded-t-xl"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-dark-900/70 backdrop-blur-sm rounded-full">
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-xs text-white font-medium">{opponentName}</span>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-dark-900/70 backdrop-blur-sm rounded-full">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-white font-medium">LIVE</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-48 md:h-64 bg-dark-800 flex flex-col items-center justify-center gap-3">
            {connectionState === 'searching' || connectionState === 'idle' ? (
              <>
                <div className="relative">
                  <Camera className="w-10 h-10 text-dark-500" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-2 border-dark-800 rounded-full bg-amber-500 animate-pulse" />
                </div>
                <p className="text-sm text-dark-400">{opponentName} kamerajara varunk...</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-dark-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-dark-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-dark-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </>
            ) : connectionState === 'connecting' ? (
              <>
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-dark-400">Csatlakozas {opponentName} kamerajahoz...</p>
              </>
            ) : connectionState === 'disconnected' ? (
              <>
                <div className="relative">
                  <CameraOff className="w-10 h-10 text-dark-500" />
                  <WifiOff className="w-4 h-4 text-red-400 absolute -bottom-1 -right-1" />
                </div>
                <p className="text-sm text-dark-400">{opponentName} kamera megszakadt</p>
                {errorMessage && (
                  <p className="text-xs text-red-400">{errorMessage}</p>
                )}
                <p className="text-xs text-dark-500">Ujracsatlakozas...</p>
              </>
            ) : (
              <>
                <CameraOff className="w-10 h-10 text-dark-500" />
                <p className="text-sm text-dark-400">{opponentName} nem osztotta meg a kamerat</p>
              </>
            )}
          </div>
        )}

        <div className="px-3 py-2 bg-dark-800/50 border-t border-dark-700/50">
          <p className="text-xs text-dark-400 text-center">
            {opponentName} dobasa folyamatban...
          </p>
        </div>
      </div>
    </Card>
  );
}
