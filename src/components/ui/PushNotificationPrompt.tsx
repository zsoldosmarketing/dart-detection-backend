import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  canRequestPermission,
  subscribeToNotifications,
  getNotificationPermissionStatus,
  isSubscribed,
} from '../../lib/pushNotifications';
import { Button } from './Button';

interface PushNotificationPromptProps {
  context?: string;
  onDismiss?: () => void;
}

export function PushNotificationPrompt({ context, onDismiss }: PushNotificationPromptProps) {
  const { user } = useAuthStore();
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    const subscribed = await isSubscribed();
    const permission = getNotificationPermissionStatus();

    setAlreadySubscribed(subscribed);
    setShow(!subscribed && permission !== 'denied' && !!user);
  };

  const handleEnable = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const success = await subscribeToNotifications(user.id);
      if (success) {
        setShow(false);
        if (onDismiss) onDismiss();
      }
    } catch (error) {
      console.error('Push subscription error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    if (onDismiss) onDismiss();
  };

  if (!show || alreadySubscribed) return null;

  const messages = {
    default: {
      title: 'Ne maradj le semmiről!',
      description: 'Engedélyezd az értesítéseket, hogy azonnal értesülj a fontos eseményekről.',
    },
    tournament: {
      title: 'Verseny értesítések',
      description: 'Kapsz értesítést a verseny kezdetéről, eredményekről és ranglistáról.',
    },
    pvp: {
      title: 'PVP mérkőzés értesítések',
      description: 'Kapsz értesítést, ha ellenfélt találtunk, és ha sorra kerülsz.',
    },
    challenge: {
      title: 'Kihívás értesítések',
      description: 'Kapsz értesítést új kihívásokról és barátaid eredményeiről.',
    },
    training: {
      title: 'Edzés emlékeztetők',
      description: 'Rendszeres emlékeztetőket kapsz az edzéseidhez.',
    },
  };

  const message = messages[context as keyof typeof messages] || messages.default;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-slate-400 hover:text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-1">
              {message.title}
            </h3>
            <p className="text-xs text-slate-300 mb-3">
              {message.description}
            </p>

            <div className="flex gap-2">
              <Button
                onClick={handleEnable}
                disabled={isLoading}
                size="sm"
                className="flex-1"
              >
                {isLoading ? 'Engedélyezés...' : 'Engedélyezem'}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="outline"
                size="sm"
              >
                Később
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
