import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Clock, AlertCircle, X, RefreshCw, UserX, PlayCircle, Check, Loader2 } from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';

interface ActiveGame {
  room_id: string;
  game_type: string;
  starting_score: number;
  status: string;
  opponent_id: string;
  opponent_name: string;
  opponent_avatar: string | null;
  started_at: string;
  paused_at: string | null;
  pause_reason: string | null;
  resume_deadline: string | null;
  can_resume: boolean;
  game_duration_minutes: number;
}

interface ResumeRequest {
  id: string;
  room_id: string;
  requester_id: string;
  opponent_id: string;
  status: string;
  expires_at: string;
}

export function ActiveGamesModal() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [resumeRequests, setResumeRequests] = useState<ResumeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestTimeRemaining, setRequestTimeRemaining] = useState<Record<string, number>>({});
  const [showModal, setShowModal] = useState(false);
  const [hasCheckedOnMount, setHasCheckedOnMount] = useState(false);

  useEffect(() => {
    if (user) {
      checkForGames();
      const interval = setInterval(checkForGames, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRequestTimeRemaining((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          if (updated[key] > 0) {
            updated[key] -= 1;
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkForGames = async () => {
    if (!user) return;

    const dismissedGames = JSON.parse(
      sessionStorage.getItem('dismissedActiveGames') || '[]'
    ) as string[];

    // Fetch active games
    const { data: games, error: gamesError } = await supabase.rpc('get_active_and_paused_games', {
      p_user_id: user.id,
    });

    // Fetch resume requests
    const { data: requests } = await supabase
      .from('game_resume_requests')
      .select('*')
      .or(`requester_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (!gamesError && games) {
      const filteredGames = games.filter((g: ActiveGame) => !dismissedGames.includes(g.room_id));
      setActiveGames(filteredGames);

      // Auto-show modal on first check if there are games or requests
      if (!hasCheckedOnMount && (filteredGames.length > 0 || (requests && requests.length > 0))) {
        setShowModal(true);
        setHasCheckedOnMount(true);
      }
    }

    if (requests) {
      setResumeRequests(requests);
      const timeMap: Record<string, number> = {};
      requests.forEach((req) => {
        const remaining = Math.max(
          0,
          Math.floor((new Date(req.expires_at).getTime() - Date.now()) / 1000)
        );
        timeMap[req.id] = remaining;
      });
      setRequestTimeRemaining(timeMap);

      // Show modal if there are pending resume requests
      if (requests.length > 0 && !hasCheckedOnMount) {
        setShowModal(true);
        setHasCheckedOnMount(true);
      }
    }
  };

  const handleResumeRequest = async (roomId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_resume_request', {
        p_room_id: roomId,
      });

      if (error) throw error;

      if (data.success) {
        await checkForGames();
      } else {
        alert(data.error || 'Failed to send resume request');
      }
    } catch (err) {
      console.error('Failed to create resume request:', err);
      alert('Failed to send resume request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespondToRequest = async (requestId: string, accept: boolean) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('respond_to_resume_request', {
        p_request_id: requestId,
        p_accept: accept,
      });

      if (error) throw error;

      if (data.success) {
        if (accept && data.room_id) {
          setShowModal(false);
          navigate(`/game/${data.room_id}`);
        } else {
          await checkForGames();
        }
      } else {
        alert(data.error || 'Failed to respond to request');
      }
    } catch (err) {
      console.error('Failed to respond to request:', err);
      alert('Failed to respond to request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissGame = async (roomId: string) => {
    const dismissedGames = JSON.parse(
      sessionStorage.getItem('dismissedActiveGames') || '[]'
    ) as string[];
    dismissedGames.push(roomId);
    sessionStorage.setItem('dismissedActiveGames', JSON.stringify(dismissedGames));
    setActiveGames(activeGames.filter((g) => g.room_id !== roomId));
  };

  const handleDismissAll = () => {
    const allGameIds = activeGames.map((g) => g.room_id);
    sessionStorage.setItem('dismissedActiveGames', JSON.stringify(allGameIds));
    setActiveGames([]);
    setShowModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'success';
      case 'paused_disconnect':
        return 'warning';
      case 'paused_mutual':
        return 'primary';
      case 'abandoned':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'Folyamatban';
      case 'paused_disconnect':
        return 'Szünetel (disconnect)';
      case 'paused_mutual':
        return 'Szünetel (közös)';
      case 'abandoned':
        return 'Félbehagyva';
      default:
        return status;
    }
  };

  const totalItems = activeGames.length + resumeRequests.length;

  if (totalItems === 0 || !showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="sticky top-0 bg-white dark:bg-dark-800 pb-4 border-b border-dark-200 dark:border-dark-700 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <Swords className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="mb-1">Aktív Játékok</CardTitle>
                <p className="text-sm text-dark-600 dark:text-dark-400">
                  {totalItems} játék vár folytatásra
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5 text-dark-500" />
            </button>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          {/* Resume Requests */}
          {resumeRequests.map((request) => {
            const game = activeGames.find((g) => g.room_id === request.room_id);
            const isRequester = request.requester_id === user?.id;
            const timeLeft = requestTimeRemaining[request.id] || 0;

            return (
              <div
                key={request.id}
                className="p-4 rounded-xl border-2 border-primary-500/50 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-900/10 shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-7 h-7 text-white animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg text-dark-900 dark:text-white">
                        {isRequester ? 'Folytatás Kérve' : 'Folytatási Kérés'}
                      </h3>
                      <Badge variant="primary" size="sm">
                        <Clock className="w-3 h-3 mr-1" />
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                      </Badge>
                    </div>
                    <p className="text-dark-700 dark:text-dark-300 mb-3">
                      {isRequester
                        ? `Várakozás ${game?.opponent_name || 'ellenfél'} válaszára`
                        : `${game?.opponent_name || 'Ellenfeled'} folytatni szeretné a játékot`}
                    </p>
                    {game && (
                      <div className="flex items-center gap-3 text-sm text-dark-600 dark:text-dark-400">
                        <span className="font-semibold">
                          {game.game_type === 'x01' ? game.starting_score : game.game_type}
                        </span>
                        <span>•</span>
                        <span>{Math.floor(game.game_duration_minutes)} perc</span>
                      </div>
                    )}
                    {!isRequester && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          leftIcon={<Check className="w-4 h-4" />}
                          onClick={() => handleRespondToRequest(request.id, true)}
                          disabled={isLoading}
                          className="flex-1"
                        >
                          Elfogadom
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<X className="w-4 h-4" />}
                          onClick={() => handleRespondToRequest(request.id, false)}
                          disabled={isLoading}
                          className="flex-1"
                        >
                          Elutasítom
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Active Games */}
          {activeGames.map((game) => {
            const hasActiveRequest = resumeRequests.some((r) => r.room_id === game.room_id);
            if (hasActiveRequest) return null;

            return (
              <div
                key={game.room_id}
                className={`p-4 rounded-xl border-2 shadow-lg ${
                  game.status === 'in_progress'
                    ? 'border-success-500/50 bg-gradient-to-br from-success-50 to-success-100/50 dark:from-success-900/20 dark:to-success-900/10'
                    : 'border-warning-500/50 bg-gradient-to-br from-warning-50 to-warning-100/50 dark:from-warning-900/20 dark:to-warning-900/10'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    {game.opponent_avatar ? (
                      <img
                        src={game.opponent_avatar}
                        alt={game.opponent_name}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-white dark:ring-dark-700"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-xl font-bold ring-2 ring-white dark:ring-dark-700">
                        {game.opponent_name[0]}
                      </div>
                    )}
                    {game.status === 'in_progress' ? (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success-500 rounded-full border-2 border-white dark:border-dark-800 flex items-center justify-center">
                        <Swords className="w-3 h-3 text-white" />
                      </div>
                    ) : (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-warning-500 rounded-full border-2 border-white dark:border-dark-800 flex items-center justify-center">
                        <AlertCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg text-dark-900 dark:text-white truncate">
                        vs {game.opponent_name}
                      </h3>
                      <Badge size="sm" variant={getStatusColor(game.status)}>
                        {getStatusText(game.status)}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-sm text-dark-600 dark:text-dark-400 mb-4">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 flex-shrink-0" />
                        <span className="font-semibold">
                          {game.game_type === 'x01' ? game.starting_score : game.game_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Kezdés: {formatDistanceToNow(new Date(game.started_at), { addSuffix: true, locale: hu })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PlayCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Játékidő: {Math.floor(game.game_duration_minutes)} perc</span>
                      </div>
                      {game.pause_reason && (
                        <div className="flex items-center gap-2 text-warning-600 dark:text-warning-400 font-medium">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>
                            {game.pause_reason === 'disconnect'
                              ? 'Ellenfél lecsatlakozott'
                              : game.pause_reason === 'mutual'
                              ? 'Közös szünet'
                              : 'Szüneteltetve'}
                          </span>
                        </div>
                      )}
                      {game.resume_deadline && (
                        <div className="text-xs text-warning-700 dark:text-warning-300 font-medium">
                          Határidő: {formatDistanceToNow(new Date(game.resume_deadline), { addSuffix: true, locale: hu })}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {game.status === 'in_progress' && (
                        <Button
                          size="sm"
                          leftIcon={<PlayCircle className="w-4 h-4" />}
                          onClick={() => {
                            setShowModal(false);
                            navigate(`/game/${game.room_id}`);
                          }}
                          className="flex-1"
                        >
                          Folytatás
                        </Button>
                      )}
                      {game.can_resume && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<RefreshCw className="w-4 h-4" />}
                            onClick={() => handleResumeRequest(game.room_id)}
                            disabled={isLoading}
                            className="flex-1"
                          >
                            Hívás
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDismissGame(game.room_id)}
                            title="Elrejtés"
                          >
                            <UserX className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeGames.length > 0 && resumeRequests.length === 0 && (
          <div className="mt-6 pt-4 border-t border-dark-200 dark:border-dark-700">
            <Button
              variant="outline"
              onClick={handleDismissAll}
              className="w-full"
              leftIcon={<UserX className="w-4 h-4" />}
            >
              Összes Elrejtése
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
