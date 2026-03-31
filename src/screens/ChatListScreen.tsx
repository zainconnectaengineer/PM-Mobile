import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useChatNotifications } from '../contexts/ChatNotificationContext';
import { createApi } from '../services/api';
import type { Project } from '../types';

const COLORS = ['#6366F1', '#06B6D4', '#F97316', '#EC4899', '#22C55E', '#8B5CF6'];
const getColor = (name: string) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

type ProjectChat = Project & { unread: number };

export default function ChatListScreen({ navigation }: any) {
  const { access } = useAuth();
  const { unreadCounts } = useChatNotifications();
  const [chats, setChats] = useState<ProjectChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const api = createApi(access);
      const res = await api.get('/api/pm/projects/');
      const projects = res.data as Project[];

      // Use context unread counts, fallback to API
      const withUnread = await Promise.all(
        projects.map(async (p) => {
          if (unreadCounts[p.id] !== undefined) {
            return { ...p, unread: unreadCounts[p.id] };
          }
          try {
            const unreadRes = await api.get(`/api/chat/project/${p.id}/unread/`);
            return { ...p, unread: unreadRes.data?.unread_count ?? 0 };
          } catch {
            return { ...p, unread: 0 };
          }
        })
      );

      setChats(withUnread);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access]));

  // Update chats when unread counts change from context
  useEffect(() => {
    setChats(prev => prev.map(c => ({
      ...c,
      unread: unreadCounts[c.id] ?? c.unread,
    })));
  }, [unreadCounts]);

  const renderItem = ({ item }: { item: ProjectChat }) => {
    const color = getColor(item.name);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ProjectChat', {
          projectId: item.id,
          projectName: item.name,
        })}
      >
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.desc} numberOfLines={1}>
            {item.description || 'Tap to open chat'}
          </Text>
        </View>
        {item.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No project chats yet</Text>
            <Text style={styles.emptyHint}>Join a project to start chatting</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.lg },
  info: { flex: 1, marginLeft: Spacing.md, marginRight: Spacing.sm },
  name: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  desc: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  badge: {
    backgroundColor: Colors.primary, borderRadius: 12,
    minWidth: 24, height: 24, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingTop: 120 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
});
