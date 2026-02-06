import { ReactNode, memo } from 'react';
import {
  Swords,
  Plus,
  Clock,
  Target,
  Trophy,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';

type SkillFilter = 'any' | 'similar' | 'higher' | 'lower';

interface LobbyEntry {
  id: string;
  user_id: string;
  game_type: string;
  starting_score: number;
  legs_to_win: number;
  sets_to_win: number;
  double_in: boolean;
  double_out: boolean;
  skill_filter: SkillFilter;
  created_at: string;
  expires_at: string;
  user_profile?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  player_stats?: {
    pvp_average: number | null;
    pvp_games_played: number;
    lifetime_average: number | null;
  };
}

interface LobbyBrowserProps {
  lobbyEntries: LobbyEntry[];
  isLoading: boolean;
  isManualRefresh: boolean;
  myLobby: LobbyEntry | null;
  lobbyTimeRemaining: Record<string, number>;
  onManualRefresh: () => void;
  onShowCreateLobby: () => void;
  onChallengePlayer: (lobbyId: string) => void;
  getSkillFilterLabel: (filter: SkillFilter) => string;
  getSkillFilterIcon: (filter: SkillFilter) => ReactNode;
  formatTimeRemaining: (seconds: number) => string;
}

export const LobbyBrowser = memo(function LobbyBrowser({
  lobbyEntries,
  isLoading,
  isManualRefresh,
  myLobby,
  lobbyTimeRemaining,
  onManualRefresh,
  onShowCreateLobby,
  onChallengePlayer,
  getSkillFilterLabel,
  getSkillFilterIcon,
  formatTimeRemaining,
}: LobbyBrowserProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-dark-600 dark:text-dark-400">
          {lobbyEntries.length} játékos vár kihívóra
        </p>
        <Button
          leftIcon={<RefreshCw className={`w-4 h-4 ${isManualRefresh ? 'animate-spin' : ''}`} />}
          variant="outline"
          size="sm"
          onClick={onManualRefresh}
          disabled={isManualRefresh}
        >
          {isManualRefresh ? 'Frissítés...' : 'Frissítés'}
        </Button>
      </div>

      {!myLobby && (
        <Card className="border-2 border-primary-500/30 bg-primary-50/50 dark:bg-primary-900/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-dark-900 dark:text-white mb-1">
                Várakozz kihívóra
              </h3>
              <p className="text-sm text-dark-600 dark:text-dark-400">
                Állíts be egy játékot és várd meg, hogy mások kihívjanak
              </p>
            </div>
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={onShowCreateLobby}
            >
              Belépés az arénába
            </Button>
          </div>
        </Card>
      )}

      {lobbyEntries.length === 0 && !isLoading && (
        <Card className="text-center py-12">
          <Users className="w-12 h-12 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-600 dark:text-dark-400">
            Jelenleg nincs várakozó játékos
          </p>
          <p className="text-sm text-dark-500 mt-2">
            Lépj be te először az arénába!
          </p>
        </Card>
      )}

      <div className="grid gap-3">
        {lobbyEntries.map((entry) => (
          <Card key={entry.id} className="hover:shadow-lg transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0">
                  {(entry.user_profile?.display_name || entry.user_profile?.username || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-dark-900 dark:text-white text-sm sm:text-base">
                      {entry.user_profile?.display_name || entry.user_profile?.username}
                    </h3>
                    {(() => {
                      const hasPvpAvg = entry.player_stats?.pvp_average && entry.player_stats.pvp_average > 0;
                      const hasLifetimeAvg = entry.player_stats?.lifetime_average && entry.player_stats.lifetime_average > 0;

                      if (hasPvpAvg) {
                        return (
                          <Badge variant="warning" size="sm">
                            <Target className="w-3 h-3 mr-1" />
                            {entry.player_stats.pvp_average!.toFixed(1)} PVP
                          </Badge>
                        );
                      } else if (hasLifetimeAvg) {
                        return (
                          <Badge variant="secondary" size="sm">
                            <Target className="w-3 h-3 mr-1" />
                            {entry.player_stats.lifetime_average!.toFixed(1)} Össz
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                    {entry.player_stats && entry.player_stats.pvp_games_played > 0 && (
                      <Badge variant="default" size="sm">
                        <Trophy className="w-3 h-3 mr-1" />
                        {entry.player_stats.pvp_games_played} PVP
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Badge variant="default" size="sm">{entry.starting_score}</Badge>
                    <Badge variant="secondary" size="sm">
                      L{entry.legs_to_win} S{entry.sets_to_win}
                    </Badge>
                    {entry.double_out && <Badge variant="success" size="sm">DO</Badge>}
                    {entry.double_in && <Badge variant="warning" size="sm">DI</Badge>}
                    <Badge variant="default" size="sm" className="flex items-center gap-1">
                      {getSkillFilterIcon(entry.skill_filter)}
                      <span className="hidden sm:inline">{getSkillFilterLabel(entry.skill_filter)}</span>
                    </Badge>
                    {lobbyTimeRemaining[entry.id] > 0 && (
                      <Badge variant="warning" size="sm" className="font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeRemaining(lobbyTimeRemaining[entry.id])}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-dark-500 dark:text-dark-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: hu })}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                leftIcon={<Swords className="w-4 h-4" />}
                onClick={() => onChallengePlayer(entry.id)}
                className="w-full sm:w-auto"
              >
                Kihívás
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
});
