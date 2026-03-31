import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Text, StyleSheet as NavStyles } from 'react-native';
import { Colors, FontSize, Spacing } from '../constants/theme';
import { useChatNotifications } from '../contexts/ChatNotificationContext';

import DashboardScreen from '../screens/DashboardScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import CreateTaskScreen from '../screens/CreateTaskScreen';
import TasksScreen from '../screens/TasksScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ProjectChatScreen from '../screens/ProjectChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UsersScreen from '../screens/UsersScreen';
import RolesScreen from '../screens/RolesScreen';
import WorkloadScreen from '../screens/WorkloadScreen';
import CalendarScreen from '../screens/CalendarScreen';
import AuditLogsScreen from '../screens/AuditLogsScreen';
import { HamburgerButton } from '../components/AppDrawer';

const Tab = createBottomTabNavigator();
const ProjectStack = createNativeStackNavigator();
const TaskStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTitleStyle: { fontWeight: '700' as const, fontSize: FontSize.lg, color: Colors.text },
  headerShadowVisible: false,
  headerTintColor: Colors.primary,
};

function ProjectsStackNavigator() {
  return (
    <ProjectStack.Navigator screenOptions={stackScreenOptions}>
      <ProjectStack.Screen
        name="ProjectsList"
        component={ProjectsScreen}
        options={{
          title: 'Projects',
          headerLeft: () => <HamburgerButton />,
        }}
      />
      <ProjectStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.projectName || 'Project',
        })}
      />
      <ProjectStack.Screen
        name="CreateTask"
        component={CreateTaskScreen}
        options={{ title: 'New Task' }}
      />
    </ProjectStack.Navigator>
  );
}

function TasksStackNavigator() {
  return (
    <TaskStack.Navigator screenOptions={stackScreenOptions}>
      <TaskStack.Screen
        name="TasksList"
        component={TasksScreen}
        options={{
          title: 'Tasks',
          headerLeft: () => <HamburgerButton />,
        }}
      />
      <TaskStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.taskTitle || 'Task',
        })}
      />
    </TaskStack.Navigator>
  );
}

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator screenOptions={stackScreenOptions}>
      <ChatStack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: 'Chats',
          headerLeft: () => <HamburgerButton />,
        }}
      />
      <ChatStack.Screen
        name="ProjectChat"
        component={ProjectChatScreen}
        options={({ route }: any) => ({
          title: route.params?.projectName || 'Chat',
        })}
      />
    </ChatStack.Navigator>
  );
}

function MainTabNavigator() {
  const { totalUnread } = useChatNotifications();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.surface, elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontWeight: '700', fontSize: FontSize.lg, color: Colors.text },
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          height: Platform.OS === 'ios' ? 88 : 80,
          paddingBottom: Platform.OS === 'ios' ? 28 : 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Projects') iconName = focused ? 'folder' : 'folder-outline';
          else if (route.name === 'Tasks') iconName = focused ? 'clipboard' : 'clipboard-outline';
          else if (route.name === 'Chat') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return (
            <View style={focused ? {
              backgroundColor: Colors.primaryBg,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 4,
            } : undefined}>
              <Ionicons name={iconName} size={22} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerLeft: () => <HamburgerButton />,
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsStackNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksStackNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatStackNavigator}
        options={{
          headerShown: false,
          tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.primary,
            color: '#FFF',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerLeft: () => <HamburgerButton />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
      <RootStack.Screen
        name="Users"
        component={UsersScreen}
        options={{
          headerShown: true,
          title: 'Users',
          ...stackScreenOptions,
          headerLeft: () => <HamburgerButton />,
        }}
      />
      <RootStack.Screen
        name="Roles"
        component={RolesScreen}
        options={{
          headerShown: true,
          title: 'Roles & Permissions',
          ...stackScreenOptions,
          headerLeft: () => <HamburgerButton />,
        }}
      />
      <RootStack.Screen
        name="Workload"
        component={WorkloadScreen}
        options={{
          headerShown: true,
          title: 'Workload',
          ...stackScreenOptions,
          headerLeft: () => <HamburgerButton />,
        }}
      />
      <RootStack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          headerShown: true,
          title: 'Calendar',
          ...stackScreenOptions,
          headerLeft: () => <HamburgerButton />,
        }}
      />
      <RootStack.Screen
        name="AuditLogs"
        component={AuditLogsScreen}
        options={{
          headerShown: true,
          title: 'Audit Logs',
          ...stackScreenOptions,
          headerLeft: () => <HamburgerButton />,
        }}
      />
    </RootStack.Navigator>
  );
}
