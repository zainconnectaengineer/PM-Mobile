import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatNotifications, type ChatNotification } from '../contexts/ChatNotificationContext';
import { Colors, FontSize, Radius } from '../constants/theme';

const AVATAR_COLORS = ['#6366F1', '#06B6D4', '#F97316', '#EC4899', '#22C55E', '#8B5CF6'];
const getColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

// Extra padding for edge-to-edge Android
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 12;

function TopToast({
  notification,
  index,
  onDismiss,
  onPress,
}: {
  notification: ChatNotification;
  index: number;
  onDismiss: () => void;
  onPress: () => void;
}) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide down from top
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const preview = notification.content.length > 80
    ? notification.content.substring(0, 80) + '...'
    : notification.content;
  const avatarColor = getColor(notification.senderName);
  const initial = notification.senderName?.charAt(0).toUpperCase() || '?';

  return (
    <Animated.View
      style={[
        styles.toast,
        notification.isMention && styles.toastMention,
        {
          transform: [{ translateY }],
          opacity,
          marginTop: index > 0 ? 6 : 0,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        activeOpacity={0.7}
        onPress={() => {
          handleDismiss();
          setTimeout(onPress, 220);
        }}
      >
        <View style={styles.toastRow}>
          {/* App icon / avatar */}
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {/* Top row: project name + time indicator */}
            <View style={styles.toastHeader}>
              <View style={styles.appBadge}>
                <Ionicons name="chatbubbles" size={10} color={Colors.primary} />
                <Text style={styles.appName}>Connecta</Text>
              </View>
              <Text style={styles.timeText}>now</Text>
            </View>
            {/* Title: project name or mention */}
            <Text style={styles.toastTitle} numberOfLines={1}>
              {notification.isMention
                ? `@Mentioned in ${notification.projectName}`
                : notification.projectName}
            </Text>
            {/* Body */}
            <Text style={styles.toastBody} numberOfLines={2}>
              {notification.senderName}: {preview}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
        <Ionicons name="close" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TopNotificationToasts() {
  const { activeToasts, dismissToast, onNotificationTap } = useChatNotifications();

  if (activeToasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {activeToasts.map((n, i) => (
        <TopToast
          key={n.id}
          notification={n}
          index={i}
          onDismiss={() => dismissToast(n.id)}
          onPress={() => {
            if (onNotificationTap.current) {
              onNotificationTap.current(n.projectId, n.projectName);
            }
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT,
    left: 8,
    right: 8,
    zIndex: 99999,
    elevation: 99999,
  },
  toast: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Shadow for the "floating notification" look
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  toastMention: {
    backgroundColor: '#FFFBF5',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  toastContent: { flex: 1 },
  toastRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  toastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  appName: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: FontSize.sm },
  toastTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 1,
  },
  toastBody: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    marginTop: -2,
  },
});
