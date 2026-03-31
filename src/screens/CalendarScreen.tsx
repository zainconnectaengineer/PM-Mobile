import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';

type TaskEvent = {
  id: number;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  due_date: string | null;
  start_from: string | null;
  project: number;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  PENDING: { color: Colors.warning, bg: Colors.warningBg, icon: 'time-outline', label: 'Pending' },
  IN_PROGRESS: { color: Colors.info, bg: Colors.infoBg, icon: 'flash-outline', label: 'In Progress' },
  COMPLETED: { color: Colors.success, bg: Colors.successBg, icon: 'checkmark-circle', label: 'Done' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const { access } = useAuth();
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await createApi(access).get('/api/pm/tasks/');
      setTasks(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access]));

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentMonth(newDate);
  };

  const formatDateKey = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Group tasks by due_date
  const tasksByDate = new Map<string, TaskEvent[]>();
  tasks.forEach(t => {
    if (t.due_date) {
      const key = t.due_date;
      if (!tasksByDate.has(key)) tasksByDate.set(key, []);
      tasksByDate.get(key)!.push(t);
    }
  });

  const selectedKey = formatDateKey(selectedDate);
  const selectedTasks = tasksByDate.get(selectedKey) || [];
  const todayKey = formatDateKey(new Date());

  const renderCalendarDays = () => {
    const days: React.ReactNode[] = [];

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      const dateKey = formatDateKey(date);
      const isSelected = dateKey === selectedKey;
      const isToday = dateKey === todayKey;
      const hasTasks = tasksByDate.has(dateKey);

      days.push(
        <TouchableOpacity
          key={d}
          style={[
            styles.dayCell,
            isToday && styles.dayCellToday,
            isSelected && styles.dayCellSelected,
          ]}
          onPress={() => setSelectedDate(date)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.dayText,
            isToday && styles.dayTextToday,
            isSelected && styles.dayTextSelected,
          ]}>
            {d}
          </Text>
          {hasTasks && (
            <View style={[styles.dot, isSelected && styles.dotSelected]} />
          )}
        </TouchableOpacity>
      );
    }

    return days;
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
    >
      {/* Month header */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthBtn}>
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {DAYS.map(day => (
          <View key={day} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {renderCalendarDays()}
      </View>

      {/* Selected date tasks */}
      <View style={styles.taskSection}>
        <Text style={styles.taskSectionTitle}>
          {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>

        {selectedTasks.length === 0 ? (
          <View style={styles.noTasksWrap}>
            <Ionicons name="calendar-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.noTasksText}>No tasks due on this date</Text>
          </View>
        ) : (
          selectedTasks.map(task => {
            const cfg = STATUS_CONFIG[task.status];
            return (
              <View key={task.id} style={styles.taskCard}>
                <View style={[styles.taskDot, { backgroundColor: cfg.color }]} />
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <View style={[styles.taskBadge, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={10} color={cfg.color} />
                    <Text style={[styles.taskBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },

  monthHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  monthBtn: { padding: Spacing.sm },
  monthText: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },

  dayHeaders: { flexDirection: 'row' },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  dayHeaderText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },

  calendarGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xs, marginBottom: Spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  dayCell: {
    width: '14.28%', alignItems: 'center', paddingVertical: Spacing.md,
  },
  dayCellToday: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  dayText: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  dayTextToday: { fontWeight: '800', color: Colors.primary },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: Colors.primary, marginTop: 3,
  },
  dotSelected: { backgroundColor: '#fff' },

  taskSection: { marginTop: Spacing.xs },
  taskSectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  noTasksWrap: {
    alignItems: 'center', padding: Spacing.xxl,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
  },
  noTasksText: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm },
  taskCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  taskDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.md },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  taskBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: Radius.full, marginTop: Spacing.xs,
  },
  taskBadgeText: { fontSize: 10, fontWeight: '600' },
});
