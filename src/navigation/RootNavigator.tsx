import React, { useEffect, useCallback } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { AppDrawerProvider } from '../components/AppDrawer';
import { ChatNotificationProvider, useChatNotifications } from '../contexts/ChatNotificationContext';
import TopNotificationToasts from '../components/TopNotificationToasts';
import AiChatbot from '../components/AiChatbot';

function AuthenticatedApp() {
  const navigationRef = useNavigationContainerRef();
  const { onNotificationTap } = useChatNotifications();

  // Wire up notification tap → navigate to chat
  useEffect(() => {
    onNotificationTap.current = (projectId: number, projectName: string) => {
      try {
        (navigationRef as any).navigate('Chat');
        setTimeout(() => {
          (navigationRef as any).navigate('ProjectChat', { projectId, projectName });
        }, 100);
      } catch {}
    };
    return () => { onNotificationTap.current = null; };
  }, [navigationRef, onNotificationTap]);

  return (
    <NavigationContainer ref={navigationRef}>
      <AppDrawerProvider navigation={navigationRef}>
        <View style={{ flex: 1 }}>
          <MainNavigator />
          <TopNotificationToasts />
          <AiChatbot />
        </View>
      </AppDrawerProvider>
    </NavigationContainer>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  return (
    <ChatNotificationProvider>
      <AuthenticatedApp />
    </ChatNotificationProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});
