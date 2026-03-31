import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  ScrollView, Animated, Dimensions, Modal, SafeAreaView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;

type DrawerContextType = {
  openDrawer: () => void;
  closeDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
});

export const useDrawer = () => useContext(DrawerContext);

type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color?: string;
  /** If set, user must have at least one of these permissions to see this item */
  requiredPermissions?: string[];
};

const MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', icon: 'home-outline', route: 'MainTabs' },
  {
    label: 'Users', icon: 'people-outline', route: 'Users', color: Colors.info,
    requiredPermissions: ['accounts.view_user', 'accounts.change_user', 'accounts.add_user'],
  },
  {
    label: 'Roles', icon: 'shield-checkmark-outline', route: 'Roles', color: Colors.chart3,
    requiredPermissions: [
      'auth.view_group', 'auth.change_group', 'auth.add_group',
      'accounts.view_role', 'accounts.change_role', 'accounts.add_role',
    ],
  },
  {
    label: 'Workload', icon: 'bar-chart-outline', route: 'Workload', color: Colors.warning,
    requiredPermissions: ['projects.view_workload'],
  },
  { label: 'Calendar', icon: 'calendar-outline', route: 'Calendar', color: Colors.success },
  {
    label: 'Audit Logs', icon: 'document-text-outline', route: 'AuditLogs', color: Colors.error,
    requiredPermissions: ['auditlog.view_auditlog', 'auditlog.change_auditlog'],
  },
];

export function AppDrawerProvider({
  children,
  navigation,
}: {
  children: React.ReactNode;
  navigation: any;
}) {
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const { user, logout } = useAuth();

  const visibleMenuItems = MENU_ITEMS.filter(item => {
    if (!item.requiredPermissions) return true;
    const perms = user?.permissions ?? [];
    return item.requiredPermissions.some(rp => perms.includes(rp));
  });

  const openDrawer = useCallback(() => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, overlayAnim]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [slideAnim, overlayAnim]);

  const handleNavigate = (route: string) => {
    closeDrawer();
    setTimeout(() => {
      if (route === 'MainTabs') {
        // Reset to main tabs
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      } else {
        navigation.navigate(route);
      }
    }, 250);
  };

  const handleLogout = () => {
    closeDrawer();
    setTimeout(() => logout(), 250);
  };

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeDrawer}
      >
        <View style={styles.modalContainer}>
          {/* Overlay */}
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>

          {/* Drawer panel */}
          <Animated.View
            style={[
              styles.drawerPanel,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <SafeAreaView style={styles.drawerInner}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {user?.username?.slice(0, 2).toUpperCase() || 'U'}
                  </Text>
                </View>
                <Text style={styles.username}>{user?.username || 'User'}</Text>
                <Text style={styles.email}>{user?.email || ''}</Text>
                {user?.roles?.[0] && (
                  <View style={styles.roleBadge}>
                    <Ionicons name="shield-checkmark-outline" size={12} color="#fff" />
                    <Text style={styles.roleText}>{user.roles[0]}</Text>
                  </View>
                )}
              </View>

              {/* Menu */}
              <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
                {visibleMenuItems.map((item) => (
                  <TouchableOpacity
                    key={item.route}
                    style={styles.menuItem}
                    activeOpacity={0.7}
                    onPress={() => handleNavigate(item.route)}
                  >
                    <View
                      style={[
                        styles.menuIconWrap,
                        {
                          backgroundColor: item.color
                            ? item.color + '15'
                            : Colors.surfaceAlt,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={item.color || Colors.textSecondary}
                      />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                  <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
                <Text style={styles.version}>Connecta AI v1.0.0</Text>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </DrawerContext.Provider>
  );
}

// Hamburger button for headers
export function HamburgerButton() {
  const { openDrawer } = useDrawer();
  return (
    <TouchableOpacity
      onPress={openDrawer}
      style={{ marginLeft: Spacing.md, padding: Spacing.xs }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="menu" size={26} color={Colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerInner: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 20 : (StatusBar.currentHeight || 24) + 16,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.primary,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.xl },
  username: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  email: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  roleText: { fontSize: FontSize.xs, fontWeight: '600', color: '#fff' },

  menuScroll: { flex: 1, paddingTop: Spacing.md },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: 2,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },

  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  logoutText: { fontSize: FontSize.md, fontWeight: '500', color: Colors.error },
  version: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
