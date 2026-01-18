import { useState, useEffect } from 'react';
import { Bell, X, Check, BellRing, Smartphone, Target } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  subscribeToNotifications,
  getNotificationPermissionStatus,
  isSubscribed,
} from '../../lib/pushNotifications';
import { Button } from './Button';
import { Card, CardTitle } from './Card';

interface PushNotificationModalProps {
  onComplete?: () => void;
}

export function PushNotificationModal({ onComplete }: PushNotificationModalProps) {
  const { user, shouldShowPushPrompt, setShouldShowPushPrompt } = useAuthStore();
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkIfShouldShow();
  }, [shouldShowPushPrompt, user]);

  const checkIfShouldShow = async () => {
    if (!shouldShowPushPrompt || !user) {
      setShow(false);
      return;
    }

    const subscribed = await isSubscribed();
    const permission = getNotificationPermissionStatus();

    if (subscribed || permission === 'denied') {
      setShouldShowPushPrompt(false);
      setShow(false);
      return;
    }

    setShow(true);
  };

  const handleEnable = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const result = await subscribeToNotifications(user.id);
      if (result) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Push subscription error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setShow(false);
    setShouldShowPushPrompt(false);
    if (onComplete) onComplete();
  };

  if (!show) return null;

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <Card className="max-w-md w-full animate-scale-in">
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-dark-900 dark:text-white mb-3">
              Sikeresen Engedélyezve!
            </h3>
            <p className="text-dark-600 dark:text-dark-400">
              Most már értesítéseket kapsz a fontos eseményekről
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="max-w-lg w-full animate-scale-in">
        <div className="relative">
          <button
            onClick={handleClose}
            className="absolute top-0 right-0 p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5 text-dark-500" />
          </button>

          <div className="text-center pt-6 pb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-6 relative">
              <Bell className="w-12 h-12 text-white" />
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-warning-400 to-warning-600 rounded-full flex items-center justify-center animate-pulse">
                <BellRing className="w-5 h-5 text-white" />
              </div>
            </div>

            <CardTitle className="mb-4 text-2xl">
              Ne maradj le semmiről!
            </CardTitle>

            <p className="text-dark-600 dark:text-dark-400 mb-6 px-4">
              Engedélyezd az értesítéseket, hogy azonnal értesülj a fontos eseményekről
            </p>

            <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-6 mb-6 mx-4">
              <h4 className="font-semibold text-dark-900 dark:text-white mb-4 flex items-center justify-center gap-2">
                <Smartphone className="w-5 h-5" />
                Mit kapsz értesítésben?
              </h4>
              <div className="space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark-900 dark:text-white">
                      PVP kihívások
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-400">
                      Amikor valaki kihív egy mérkőzésre
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark-900 dark:text-white">
                      Játék állapot változások
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-400">
                      Folytatási kérések, ellenfél csatlakozása
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark-900 dark:text-white">
                      Barát kérések
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-400">
                      Új barát felkérések és elfogadások
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark-900 dark:text-white">
                      Verseny hírek
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-400">
                      Verseny kezdet, eredmények, ranglisták
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-4">
              <Button
                onClick={handleEnable}
                disabled={isLoading}
                size="lg"
                className="flex-1"
                leftIcon={<Bell className="w-5 h-5" />}
              >
                {isLoading ? 'Engedélyezés...' : 'Engedélyezem'}
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                size="lg"
              >
                Később
              </Button>
            </div>

            <p className="text-xs text-dark-500 dark:text-dark-400 mt-4 px-4">
              Bármikor kikapcsolhatod a beállításokban
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
