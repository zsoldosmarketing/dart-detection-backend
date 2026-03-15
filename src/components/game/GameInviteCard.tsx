import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Clock, Check, X, User, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';

interface GameInvite {
  id: string;
  room_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
  inviter?: {
    display_name: string;
    avatar_url: string | null;
    pvp_average?: number | null;
    pvp_games_played?: number;
  };
  room?: {
    game_type: string;
    game_variant: string;
    starting_score: number;
  };
}

interface GameInviteCardProps {
  invite: GameInvite;
  onRespond?: (inviteId: string, accepted: boolean) => void;
}

export function GameInviteCard({ invite, onRespond }: GameInviteCardProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [responded, setResponded] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(invite.created_at), {
    addSuffix: true,
    locale: hu,
  });

  const expiresIn = formatDistanceToNow(new Date(invite.expires_at), {
    locale: hu,
  });

  const isExpired = new Date(invite.expires_at) < new Date();

  const handleResponse = async (accept: boolean) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('game_invites')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', invite.id);

      if (error) throw error;

      setResponded(true);
      onRespond?.(invite.id, accept);

      if (accept) {
        navigate(`/game/${invite.room_id}`);
      }
    } catch (err) {
      console.error('Failed to respond to invite:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getGameTypeLabel = (type: string) => {
    switch (type) {
      case 'x01':
        return 'X01';
      case 'cricket':
        return 'Cricket';
      case 'around_the_clock':
        return 'Around the Clock';
      default:
        return type;
    }
  };

  if (responded || invite.status !== 'pending') {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-primary-500 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
          <Swords className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-dark-900 dark:text-white">
              Játék meghívó
            </h3>
            {isExpired ? (
              <Badge variant="error" size="sm">Lejárt</Badge>
            ) : (
              <Badge variant="warning" size="sm">Fuggo</Badge>
            )}
          </div>

          <div className="space-y-1 mb-2">
            <div className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-400">
              {invite.inviter?.avatar_url ? (
                <img
                  src={invite.inviter.avatar_url}
                  alt=""
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span className="font-medium">{invite.inviter?.display_name || 'Ismeretlen'}</span>
              <span>meghívott egy játékra</span>
            </div>
            {invite.inviter?.pvp_average !== null && invite.inviter?.pvp_average !== undefined && (
              <div className="flex items-center gap-1 text-xs text-dark-500 dark:text-dark-400 ml-7">
                <Target className="w-3 h-3" />
                <span>{invite.inviter.pvp_average.toFixed(1)} átlag</span>
                <span>•</span>
                <span>{invite.inviter.pvp_games_played || 0} PVP játék</span>
              </div>
            )}
          </div>

          {invite.room && (
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="secondary">
                {getGameTypeLabel(invite.room.game_type)}
              </Badge>
              {invite.room.starting_score > 0 && (
                <Badge variant="default">
                  {invite.room.starting_score} pont
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400 mb-4">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
            {!isExpired && (
              <>
                <span>|</span>
                <span>Lejar: {expiresIn} mulva</span>
              </>
            )}
          </div>

          {!isExpired && (
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Check className="w-4 h-4" />}
                onClick={() => handleResponse(true)}
                isLoading={isLoading}
              >
                Elfogadom
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<X className="w-4 h-4" />}
                onClick={() => handleResponse(false)}
                isLoading={isLoading}
              >
                Elutasitom
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
