import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';

type AuditEntry = {
  id: number;
  activity_type: string;
  action: string;
  entity: string;
  entity_id: string;
  user_name: string;
  user_role: string;
  ip_address: string;
  timestamp: string;
};

const ACTIVITY_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  CREATE: { icon: 'add-circle', color: Colors.success, bg: Colors.successBg },
  UPDATE: { icon: 'create', color: Colors.info, bg: Colors.infoBg },
  DELETE: { icon: 'trash', color: Colors.error, bg: Colors.errorBg },
  LOGIN: { icon: 'log-in', color: Colors.chart3, bg: '#F5F3FF' },
};

export default function AuditLogsScreen() {
  const { access } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await createApi(access).get('/api/audit/audit-logs/');
      setLogs(res.data?.results || res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access]));

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  const renderLog = ({ item }: { item: AuditEntry }) => {
    const ac = ACTIVITY_ICONS[item.activity_type] || ACTIVITY_ICONS.UPDATE;
    return (
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: ac.bg }]}>
          <Ionicons name={ac.icon} size={18} color={ac.color} />
        </View>
        <View style={styles.info}>
          <Text style={styles.action}>{item.action}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.entity}>{item.entity}</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.user}>{item.user_name || 'System'}</Text>
          </View>
          <View style={styles.bottomRow}>
            <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        renderItem={renderLog}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No audit logs</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  info: { flex: 1 },
  action: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  entity: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.primary },
  separator: { color: Colors.textMuted, fontSize: 10 },
  user: { fontSize: FontSize.sm, color: Colors.textSecondary },
  bottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  ip: { fontSize: FontSize.xs, color: Colors.textMuted },
  emptyWrap: { alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },
});
