import { create } from 'zustand';
import type { Place, Notification } from '@/lib/types/database';

interface AppState {
  selectedPlace: Place | null;
  notifications: Notification[];
  unreadCount: number;
  setSelectedPlace: (place: Place | null) => void;
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  addNotification: (notification: Notification) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedPlace: null,
  notifications: [],
  unreadCount: 0,
  setSelectedPlace: (place) => set({ selectedPlace: place }),
  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    }),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
    })),
}));
