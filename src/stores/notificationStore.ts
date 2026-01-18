import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface NotificationState {
  notifications: Tables['notification_receipts'][];
  unreadCount: number;
  isLoading: boolean;
  channel: RealtimeChannel | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Tables['notification_receipts']) => void;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  channel: null,

  fetchNotifications: async () => {
    set({ isLoading: true });

    const { data, error } = await supabase
      .from('notification_receipts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      const unreadCount = data.filter((n) => !n.is_read).length;
      set({ notifications: data, unreadCount, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    const { error } = await supabase
      .from('notification_receipts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    }
  },

  markAllAsRead: async () => {
    const { notifications } = get();
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('notification_receipts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);

    if (!error) {
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.is_read ? n.read_at : new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    }
  },

  addNotification: (notification: Tables['notification_receipts']) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
    }));
  },

  subscribeToNotifications: (userId: string) => {
    const { channel: existingChannel } = get();

    if (existingChannel) {
      existingChannel.unsubscribe();
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_receipts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Tables['notification_receipts'];
          get().addNotification(newNotification);

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(newNotification.title, {
              body: newNotification.body || '',
              icon: '/favicon.svg',
              badge: '/favicon.svg',
            });
          }
        }
      )
      .subscribe();

    set({ channel });
  },

  unsubscribeFromNotifications: () => {
    const { channel } = get();
    if (channel) {
      channel.unsubscribe();
      set({ channel: null });
    }
  },
}));
