import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Platform, Vibration, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import { createApi } from '../services/api';

// Configure foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type ChatNotification = {
  id: string;
  projectId: number;
  projectName: string;
  messageId: number;
  senderName: string;
  content: string;
  isMention: boolean;
  read: boolean;
  timestamp: string;
};

type UnreadCounts = Record<number, number>;

type ChatNotificationContextType = {
  notifications: ChatNotification[];
  unreadCounts: UnreadCounts;
  totalUnread: number;
  activeToasts: ChatNotification[];
  markAsRead: (projectId: number) => void;
  dismissToast: (id: string) => void;
  clearAllNotifications: () => void;
  onNotificationTap: React.MutableRefObject<((projectId: number, projectName: string) => void) | null>;
};

const ChatNotificationContext = createContext<ChatNotificationContextType>({
  notifications: [],
  unreadCounts: {},
  totalUnread: 0,
  activeToasts: [],
  markAsRead: () => {},
  dismissToast: () => {},
  clearAllNotifications: () => {},
  onNotificationTap: { current: null },
});

export const useChatNotifications = () => useContext(ChatNotificationContext);

export function ChatNotificationProvider({ children }: { children: React.ReactNode }) {
  const { access, user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [activeToasts, setActiveToasts] = useState<ChatNotification[]>([]);
  const lastCheckedRef = useRef<Record<number, number>>({});
  const projectsRef = useRef<{ id: number; name: string }[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const onNotificationTap = useRef<((projectId: number, projectName: string) => void) | null>(null);

  const api = useCallback(() => createApi(access), [access]);

  // Setup notification channels + permissions
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('chat-messages', {
          name: 'Chat Messages',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#F97316',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
        await Notifications.setNotificationChannelAsync('chat-mentions', {
          name: 'Chat Mentions',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#EF4444',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }
    })();
  }, [isAuthenticated]);

  // Handle notification tap from system tray
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        projectId?: number;
        projectName?: string;
      };
      if (data.projectId && onNotificationTap.current) {
        onNotificationTap.current(data.projectId, data.projectName || 'Chat');
      }
    });
    return () => sub.remove();
  }, []);

  // Show a toast that auto-dismisses
  const showToast = useCallback((notif: ChatNotification) => {
    setActiveToasts((prev) => {
      const exists = prev.some((t) => t.id === notif.id);
      if (exists) return prev;
      return [notif, ...prev].slice(0, 3);
    });
    const duration = notif.isMention ? 8000 : 5000;
    setTimeout(() => {
      setActiveToasts((prev) => prev.filter((t) => t.id !== notif.id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load projects and seed last-checked IDs
  const initSubscriptions = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api().get('/api/pm/projects/');
      const projects = (res.data || []) as { id: number; name: string }[];
      projectsRef.current = projects;

      await Promise.all(
        projects.map(async (p) => {
          try {
            const msgRes = await api().get(`/api/chat/project/${p.id}/messages/`);
            const msgs = msgRes.data || [];
            if (msgs.length > 0) {
              const maxId = Math.max(...msgs.map((m: { id: number }) => m.id));
              lastCheckedRef.current[p.id] = maxId;
            } else {
              lastCheckedRef.current[p.id] = 0;
            }
          } catch {
            lastCheckedRef.current[p.id] = 0;
          }
        })
      );

      const counts: UnreadCounts = {};
      await Promise.all(
        projects.map(async (p) => {
          try {
            const unreadRes = await api().get(`/api/chat/project/${p.id}/unread/`);
            counts[p.id] = unreadRes.data?.unread_count ?? 0;
          } catch {
            counts[p.id] = 0;
          }
        })
      );
      setUnreadCounts(counts);
    } catch {}
  }, [api, isAuthenticated]);

  // Poll for new messages and show top-of-screen toasts
  const pollNewMessages = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    const projects = projectsRef.current;
    if (!projects.length) return;

    for (const project of projects) {
      try {
        const res = await api().get(`/api/chat/project/${project.id}/messages/`);
        const msgs = (res.data || []) as {
          id: number;
          sender: { id: number; username: string };
          content: string;
          mentions?: number[];
          created_at: string;
        }[];

        const lastChecked = lastCheckedRef.current[project.id] || 0;
        const newMsgs = msgs.filter((m) => m.id > lastChecked && m.sender.id !== user.id);

        if (newMsgs.length > 0) {
          lastCheckedRef.current[project.id] = Math.max(...msgs.map((m) => m.id));

          const newNotifs: ChatNotification[] = newMsgs.map((m) => ({
            id: `${m.id}_${project.id}`,
            projectId: project.id,
            projectName: project.name,
            messageId: m.id,
            senderName: m.sender.username,
            content: m.content,
            isMention: (m.mentions || []).includes(user.id),
            read: false,
            timestamp: m.created_at,
          }));

          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const unique = newNotifs.filter((n) => !existingIds.has(n.id));
            return [...unique, ...prev].slice(0, 50);
          });

          setUnreadCounts((prev) => ({
            ...prev,
            [project.id]: (prev[project.id] || 0) + newMsgs.length,
          }));

          // Show top-of-screen toasts + fire system notification
          for (const notif of newNotifs) {
            showToast(notif);
            // System notification (persists in notification panel, plays sound)
            const preview = notif.content.length > 120
              ? notif.content.substring(0, 120) + '...'
              : notif.content;
            Notifications.scheduleNotificationAsync({
              content: {
                title: notif.isMention
                  ? `@Mentioned in ${notif.projectName}`
                  : notif.projectName,
                body: `${notif.senderName}: ${preview}`,
                sound: 'default',
                data: {
                  projectId: notif.projectId,
                  projectName: notif.projectName,
                },
                ...(Platform.OS === 'android' && {
                  channelId: notif.isMention ? 'chat-mentions' : 'chat-messages',
                  color: '#F97316',
                }),
              },
              trigger: null,
            }).catch(() => {});
          }
        }
      } catch {}
    }
  }, [api, isAuthenticated, user?.id, showToast]);

  // Init on auth
  useEffect(() => {
    if (isAuthenticated) {
      initSubscriptions();
    } else {
      setNotifications([]);
      setUnreadCounts({});
      setActiveToasts([]);
      lastCheckedRef.current = {};
      projectsRef.current = [];
    }
  }, [isAuthenticated, initSubscriptions]);

  // Start/stop polling based on app state
  useEffect(() => {
    if (!isAuthenticated) return;

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(pollNewMessages, 5000);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const handleAppState = (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        pollNewMessages();
        startPolling();
      } else if (nextState.match(/inactive|background/)) {
        stopPolling();
      }
      appStateRef.current = nextState;
    };

    startPolling();
    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [isAuthenticated, pollNewMessages]);

  const markAsRead = useCallback(async (projectId: number) => {
    // Clear local state immediately
    setNotifications((prev) =>
      prev.map((n) => (n.projectId === projectId ? { ...n, read: true } : n))
    );
    setUnreadCounts((prev) => ({ ...prev, [projectId]: 0 }));
    setActiveToasts((prev) => prev.filter((t) => t.projectId !== projectId));

    // Tell backend to mark all messages read
    try {
      await api().post(`/api/chat/project/${projectId}/mark-all-read/`);
    } catch { /* ignore */ }

    // Update lastCheckedRef so poller doesn't re-notify
    try {
      const res = await api().get(`/api/chat/project/${projectId}/messages/`);
      const msgs = res.data || [];
      if (msgs.length > 0) {
        lastCheckedRef.current[projectId] = Math.max(...msgs.map((m: { id: number }) => m.id));
      }
    } catch { /* ignore */ }

    // Dismiss system notifications
    Notifications.dismissAllNotificationsAsync().catch(() => {});
  }, [api]);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setActiveToasts([]);
    Notifications.dismissAllNotificationsAsync().catch(() => {});
  }, []);

  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);

  return (
    <ChatNotificationContext.Provider
      value={{
        notifications,
        unreadCounts,
        totalUnread,
        activeToasts,
        markAsRead,
        dismissToast,
        clearAllNotifications,
        onNotificationTap,
      }}
    >
      {children}
    </ChatNotificationContext.Provider>
  );
}
