import { ReactNode, memo } from 'react';
import { t } from '../../lib/i18n';
import {
  Plus,
  Clock,
  Target,
  X,
  Check,
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
  status?: string;
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

interface Challenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  lobby_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  challenger?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  challenger_stats?: {
    pvp_average: number | null;
    pvp_games_played: number;
    lifetime_average: number | null;
  };
  lobby?: LobbyEntry;
}

interface LobbyWaitingProps {
  myLobby: LobbyEntry | null;
  challenges: Challenge[];
  timeRemaining: number;
  challengeTimeRemaining: Record<string, number>;
  onCancelLobby: () => void;
  onShowCreateLobby: () => void;
  onRespondToChallenge: (challengeId: string, accept: boolean) => void;
  getSkillFilterLabel: (filter: SkillFilter) => string;
  getSkillFilterIcon: (filter: SkillFilter) => ReactNode;
  formatTimeRemaining: (seconds: number) => string;
}

export const LobbyWaiting = memo(function LobbyWaiting({
  myLobby,
  challenges,
  timeRemaining,
  challengeTimeRemaining,
  onCancelLobby,
  onShowCreateLobby,
  onRespondToChallenge,
  getSkillFilterLabel,
  getSkillFilterIcon,
  formatTimeRemaining,
}: LobbyWaitingProps) {
  return (
    <div className="space-y-4">
      {myLobby ? (
        <>
          <Card className="border-2 border-success-500/30 bg-success-50/50 dark:bg-success-900/10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
                  <Clock className="w-5 h-5 text-success-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-dark-900 dark:text-white">
                    {t('pvp.waiting_for_challenger')}
                  </h3>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    {t('pvp.others_see_settings')}
                  </p>
                </div>
              </div>
              {timeRemaining > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-xs text-dark-500 dark:text-dark-400">{t('pvp.expires')}</span>
                  <span className="text-lg font-bold text-success-600 dark:text-success-400 font-mono">
                    {formatTimeRemaining(timeRemaining)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="default">{myLobby.starting_score}</Badge>
              <Badge variant="secondary">L{myLobby.legs_to_win} S{myLobby.sets_to_win}</Badge>
              {myLobby.double_out && <Badge variant="success" size="sm">Double Out</Badge>}
              {myLobby.double_in && <Badge variant="warning" size="sm">Double In</Badge>}
              <Badge variant="default" size="sm">
                {getSkillFilterIcon(myLobby.skill_filter)}
                <span className="ml-1">{getSkillFilterLabel(myLobby.skill_filter)}</span>
              </Badge>
              {(() => {
                const hasPvpAvg = myLobby.player_stats?.pvp_average && myLobby.player_stats.pvp_average > 0;
                const hasLifetimeAvg = myLobby.player_stats?.lifetime_average && myLobby.player_stats.lifetime_average > 0;

                if (hasPvpAvg) {
                  return (
                    <Badge variant="warning" size="sm">
                      <Target className="w-3 h-3 mr-1" />
                      {myLobby.player_stats.pvp_average!.toFixed(1)} PVP
                    </Badge>
                  );
                } else if (hasLifetimeAvg) {
                  return (
                    <Badge variant="secondary" size="sm">
                      <Target className="w-3 h-3 mr-1" />
                      {myLobby.player_stats.lifetime_average!.toFixed(1)} {t('stat.overall')}
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>

            <Button
              variant="outline"
              leftIcon={<X className="w-4 h-4" />}
              onClick={onCancelLobby}
            >
              {t('pvp.leave_arena')}
            </Button>
          </Card>

          {challenges.length > 0 && (
            <div>
              <h3 className="font-semibold text-dark-900 dark:text-white mb-3">
                {t('pvp.incoming_challenges', { count: challenges.length })}
              </h3>
              <div className="grid gap-3">
                {challenges.map((challenge) => (
                  <Card key={challenge.id} className="border-l-4 border-l-warning-500">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning-500 to-error-500 flex items-center justify-center text-white font-bold shrink-0">
                          {(challenge.challenger?.display_name || challenge.challenger?.username || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-dark-900 dark:text-white truncate">
                              {challenge.challenger?.display_name || challenge.challenger?.username}
                            </p>
                            {(() => {
                              const hasPvpAvg = challenge.challenger_stats?.pvp_average && challenge.challenger_stats.pvp_average > 0;
                              const hasLifetimeAvg = challenge.challenger_stats?.lifetime_average && challenge.challenger_stats.lifetime_average > 0;

                              if (hasPvpAvg) {
                                return (
                                  <Badge variant="warning" size="sm">
                                    <Target className="w-3 h-3 mr-1" />
                                    {challenge.challenger_stats.pvp_average!.toFixed(1)} PVP
                                  </Badge>
                                );
                              } else if (hasLifetimeAvg) {
                                return (
                                  <Badge variant="secondary" size="sm">
                                    <Target className="w-3 h-3 mr-1" />
                                    {challenge.challenger_stats.lifetime_average!.toFixed(1)} {t('stat.overall')}
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-dark-500 dark:text-dark-400">
                            <span>{formatDistanceToNow(new Date(challenge.created_at), { addSuffix: true, locale: hu })}</span>
                            {challengeTimeRemaining[challenge.id] !== undefined && (
                              <div className="flex items-center gap-1 text-warning-600 dark:text-warning-400 font-medium">
                                <Clock className="w-3 h-3" />
                                <span className="font-mono">
                                  {Math.floor(challengeTimeRemaining[challenge.id] / 60)}:{(challengeTimeRemaining[challenge.id] % 60).toString().padStart(2, '0')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          leftIcon={<Check className="w-4 h-4" />}
                          onClick={() => onRespondToChallenge(challenge.id, true)}
                          className="flex-1 sm:flex-none"
                        >
                          {t('pvp.accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<X className="w-4 h-4" />}
                          onClick={() => onRespondToChallenge(challenge.id, false)}
                          className="flex-1 sm:flex-none"
                        >
                          {t('pvp.decline')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card className="text-center py-12">
          <Clock className="w-12 h-12 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-600 dark:text-dark-400 mb-4">
            {t('pvp.not_in_arena')}
          </p>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onShowCreateLobby}
          >
            {t('pvp.enter_arena')}
          </Button>
        </Card>
      )}
    </div>
  );
});
