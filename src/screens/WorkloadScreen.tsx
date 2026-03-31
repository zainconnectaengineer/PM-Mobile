import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';

type EmployeeWorkload = {
  user_id: number;
  username: string;
  email: string;
  roles: string[];
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
};

type ProjectWorkload = {
  project_id: number;
  project_name: string;
  employees: EmployeeWorkload[];
};

export default function WorkloadScreen() {
  const { access } = useAuth();
  const [data, setData] = useState<ProjectWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await createApi(access).get('/api/pm/workload/');
      setData(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
    >
      {data.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="bar-chart-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No workload data</Text>
        </View>
      ) : (
        data.map(project => (
          <View key={project.project_id} style={styles.projectCard}>
            <Text style={styles.projectName}>{project.project_name}</Text>

            {project.employees.length === 0 ? (
              <Text style={styles.noEmployees}>No team members</Text>
            ) : (
              project.employees.map(emp => {
                const progress = emp.total_tasks > 0
                  ? Math.round((emp.completed_tasks / emp.total_tasks) * 100)
                  : 0;
                return (
                  <View key={emp.user_id} style={styles.empCard}>
                    <View style={styles.empHeader}>
                      <View style={styles.empAvatar}>
                        <Text style={styles.empAvatarText}>
                          {emp.username.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.empInfo}>
                        <Text style={styles.empName}>{emp.username}</Text>
                        {emp.roles.length > 0 && (
                          <Text style={styles.empRole}>{emp.roles[0]}</Text>
                        )}
                      </View>
                      <Text style={styles.empTotal}>{emp.total_tasks} tasks</Text>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.progressRow}>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{progress}%</Text>
                    </View>

                    {/* Status chips */}
                    <View style={styles.statusRow}>
                      <View style={[styles.statusChip, { backgroundColor: Colors.warningBg }]}>
                        <Ionicons name="time-outline" size={12} color={Colors.warning} />
                        <Text style={[styles.statusChipText, { color: Colors.warning }]}>
                          {emp.pending_tasks} Pending
                        </Text>
                      </View>
                      <View style={[styles.statusChip, { backgroundColor: Colors.infoBg }]}>
                        <Ionicons name="flash-outline" size={12} color={Colors.info} />
                        <Text style={[styles.statusChipText, { color: Colors.info }]}>
                          {emp.in_progress_tasks} Active
                        </Text>
                      </View>
                      <View style={[styles.statusChip, { backgroundColor: Colors.successBg }]}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                        <Text style={[styles.statusChipText, { color: Colors.success }]}>
                          {emp.completed_tasks} Done
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  projectCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  projectName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  noEmployees: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },
  empCard: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  empHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  empAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.chart3, alignItems: 'center', justifyContent: 'center',
  },
  empAvatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  empInfo: { flex: 1, marginLeft: Spacing.sm },
  empName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  empRole: { fontSize: FontSize.xs, color: Colors.textMuted },
  empTotal: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  progressBar: {
    flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.success },
  progressText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success, width: 35 },
  statusRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full,
  },
  statusChipText: { fontSize: 10, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },
});
