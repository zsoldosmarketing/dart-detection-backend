import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { t } from '../lib/i18n';
import { useNotificationStore } from '../stores/notificationStore';
import type { Tables } from '../lib/supabase';

const categoryColors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
  system: 'default',
  game: 'primary',
  club: 'secondary',
  tournament: 'success',
  admin: 'warning',
  nudge: 'error',
};

export function InboxPage() {
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = notifications.filter(
    (n) => filter === 'all' || !n.is_read
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            {t('notifications.title')}
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            {unreadCount > 0
              ? `${unreadCount} olvasatlan ertesites`
              : 'Nincs olvasatlan ertesites'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            leftIcon={<CheckCheck className="w-4 h-4" />}
            onClick={() => markAllAsRead()}
          >
            {t('notifications.mark_all_read')}
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700'
          }`}
        >
          Osszes ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700'
          }`}
        >
          Olvasatlan ({unreadCount})
        </button>
      </div>

      {filteredNotifications.length === 0 ? (
        <Card className="text-center py-12">
          <Bell className="w-12 h-12 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-500 dark:text-dark-400">{t('notifications.empty')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={() => markAsRead(notification.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface NotificationCardProps {
  notification: Tables['notification_receipts'];
  onMarkRead: () => void;
}

function NotificationCard({ notification, onMarkRead }: NotificationCardProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: hu,
  });

  return (
    <Card
      className={`transition-all ${
        !notification.is_read
          ? 'border-l-4 border-l-primary-500'
          : 'opacity-75 hover:opacity-100'
      }`}
      padding="sm"
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-2 rounded-lg ${
            !notification.is_read
              ? 'bg-primary-100 dark:bg-primary-900/30'
              : 'bg-dark-100 dark:bg-dark-700'
          }`}
        >
          <Bell
            className={`w-5 h-5 ${
              !notification.is_read
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-dark-500'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className={`font-medium ${
                    !notification.is_read
                      ? 'text-dark-900 dark:text-white'
                      : 'text-dark-700 dark:text-dark-300'
                  }`}
                >
                  {notification.title}
                </h3>
                <Badge
                  variant={categoryColors[notification.category] || 'default'}
                  size="sm"
                >
                  {notification.category}
                </Badge>
              </div>
              <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                {notification.body}
              </p>
            </div>
            <span className="text-xs text-dark-400 whitespace-nowrap">{timeAgo}</span>
          </div>

          <div className="flex items-center gap-2 mt-3">
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Check className="w-3 h-3" />}
                onClick={onMarkRead}
              >
                {t('notifications.mark_read')}
              </Button>
            )}
            {notification.action_url && (
              <a
                href={notification.action_url}
                onClick={() => !notification.is_read && onMarkRead()}
                className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Megnyitas <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {notification.image_url && (
          <img
            src={notification.image_url}
            alt=""
            className="w-16 h-16 rounded-lg object-cover"
          />
        )}
      </div>
    </Card>
  );
}
