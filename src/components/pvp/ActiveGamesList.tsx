import { memo } from 'react';
import {
  Swords,
  Clock,
  X,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';

interface ActiveGamesListProps {
  activeGames: any[];
  isLoading: boolean;
  userId: string | undefined;
  onNavigate: (path: string) => void;
  onRefreshGames: () => void;
}

export const ActiveGamesList = memo(function ActiveGamesList({
  activeGames,
  isLoading,
  userId,
  onNavigate,
  onRefreshGames,
}: ActiveGamesListProps) {
  return (
    <div className="space-y-4">
      {activeGames.length === 0 && !isLoading ? (
        <Card className="text-center py-12">
          <Clock className="w-12 h-12 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-600 dark:text-dark-400 mb-2 font-medium">
            Nincs aktív játékod
          </p>
          <p className="text-sm text-dark-500 dark:text-dark-400">
            Kezdj új játékot az Aréna vagy Kihívás tabon
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeGames.map((game: any) => {
            const otherPlayer = game.game_players.find((p: any) => p.user_id !== userId);
            const myPlayer = game.game_players.find((p: any) => p.user_id === userId);
            const gameAge = Date.now() - new Date(game.updated_at || game.started_at).getTime();
            const hoursOld = gameAge / (1000 * 60 * 60);
            const minutesOld = gameAge / (1000 * 60);

            const otherPlayerName = otherPlayer?.display_name ||
              otherPlayer?.user_profile?.display_name ||
              otherPlayer?.user_profile?.username ||
              'Ellenfél';

            const isDisconnected = game.status === 'paused_disconnect';
            const isPaused = game.status === 'paused_mutual';

            return (
              <Card
                key={game.id}
                className={`border-l-4 ${
                  isDisconnected ? 'border-l-error-500' :
                  isPaused ? 'border-l-warning-500' :
                  'border-l-success-500'
                } hover:shadow-lg transition-all`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                        game.mode === 'pvp'
                          ? 'from-primary-500 to-secondary-500'
                          : 'from-success-500 to-success-600'
                      } flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0`}>
                        {game.mode === 'pvp' ? <Swords className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-dark-900 dark:text-white truncate">
                            {otherPlayerName}
                          </p>
                          <Badge
                            variant={
                              game.status === 'in_progress' ? 'success' :
                              isDisconnected ? 'error' : 'warning'
                            }
                            size="sm"
                          >
                            {game.status === 'in_progress' && 'Folyamatban'}
                            {isDisconnected && 'Lekapcsolódva'}
                            {isPaused && 'Szüneteltetve'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {minutesOld < 60
                              ? `${Math.floor(minutesOld)} perce`
                              : hoursOld < 24
                              ? `${Math.floor(hoursOld)} órája`
                              : `${Math.floor(hoursOld / 24)} napja`}
                          </span>
                          <span>•</span>
                          <span>{game.mode === 'pvp' ? 'PVP Aréna' : 'Baráti kihívás'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-3 py-2 bg-dark-50 dark:bg-dark-800 rounded-lg">
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-dark-900 dark:text-white">
                        {myPlayer?.current_score || 0}
                      </p>
                      <p className="text-xs text-dark-500 dark:text-dark-400">Te</p>
                    </div>
                    <div className="text-dark-400 dark:text-dark-500">VS</div>
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-dark-900 dark:text-white">
                        {otherPlayer?.current_score || 0}
                      </p>
                      <p className="text-xs text-dark-500 dark:text-dark-400 truncate">
                        {otherPlayerName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400 flex-wrap">
                    <Badge variant="default" size="sm">{game.starting_score}</Badge>
                    <Badge variant="secondary" size="sm">
                      {game.game_type === 'cricket' ? 'Cricket' :
                       game.game_type === 'shanghai' ? 'Shanghai' :
                       game.game_type === 'killer' ? 'Killer' :
                       game.game_type === 'knockout' ? 'Knockout' :
                       game.game_type === 'halve_it' ? 'Halve It' : 'X01'}
                    </Badge>
                    {game.legs_to_win > 1 && (
                      <Badge variant="secondary" size="sm">
                        BO{game.legs_to_win * 2 - 1}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      onClick={() => onNavigate(`/game/${game.id}`)}
                    >
                      Folytatás
                    </Button>
                    {isDisconnected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await supabase
                            .from('push_notifications')
                            .insert({
                              user_id: otherPlayer.user_id,
                              type: 'game_reconnect_request',
                              title: 'Újracsatlakozás kérése',
                              body: `${myPlayer?.display_name || 'Ellenfeled'} szeretné folytatni a játékot`,
                              data: { game_id: game.id }
                            });
                        }}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
                      onClick={async () => {
                        if (confirm('Biztosan feladod ezt a játékot?')) {
                          await supabase.rpc('surrender_game', { p_game_id: game.id });
                          onRefreshGames();
                        }
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
});
