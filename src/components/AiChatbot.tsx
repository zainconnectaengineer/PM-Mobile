import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated as RNAnimated,
  StatusBar,
  Dimensions,
  PanResponder,
} from 'react-native';
import Svg, { Rect, Circle, Ellipse, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';
import { Colors, FontSize, Spacing, Radius } from '../constants/theme';

// Robot Avatar matching the web app's AnimatedAgentAvatar
function RobotAvatar({ size = 44 }: { size?: number }) {
  const bounceAnim = useRef(new RNAnimated.Value(0)).current;
  const blinkAnim = useRef(new RNAnimated.Value(1)).current;
  const glowAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    // Floating bounce
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(bounceAnim, { toValue: -2, duration: 1000, useNativeDriver: true }),
        RNAnimated.timing(bounceAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    // Antenna glow
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        RNAnimated.timing(glowAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [bounceAnim, glowAnim]);

  return (
    <RNAnimated.View style={{ transform: [{ translateY: bounceAnim }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {/* Antenna stick */}
        <Line x1="50" y1="22" x2="50" y2="10" stroke="white" strokeWidth={3} strokeLinecap="round" />
        {/* Antenna glow dot */}
        <Circle cx="50" cy="8" r="4" fill="white" opacity={0.9} />
        {/* Head */}
        <Rect x="18" y="22" width="64" height="50" rx="14" fill="white" />
        {/* Left eye */}
        <Ellipse cx="38" cy="45" rx="7" ry="8" fill="#f97316" />
        <Circle cx="39" cy="44" r="3" fill="white" opacity={0.8} />
        {/* Right eye */}
        <Ellipse cx="62" cy="45" rx="7" ry="8" fill="#f97316" />
        <Circle cx="63" cy="44" r="3" fill="white" opacity={0.8} />
        {/* Mouth - smile */}
        <Path d="M 38 58 Q 50 66 62 58" stroke="#f97316" strokeWidth={3} strokeLinecap="round" fill="none" />
        {/* Left ear */}
        <Rect x="10" y="38" width="10" height="16" rx="4" fill="white" opacity={0.85} />
        {/* Right ear */}
        <Rect x="80" y="38" width="10" height="16" rx="4" fill="white" opacity={0.85} />
        {/* Body hint */}
        <Rect x="30" y="74" width="40" height="16" rx="8" fill="white" opacity={0.7} />
        {/* Body line detail */}
        <Line x1="50" y1="76" x2="50" y2="86" stroke="#f97316" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      </Svg>
    </RNAnimated.View>
  );
}

type OnboardingStep = 'welcome' | 'name-agent' | 'capabilities' | 'loading' | 'chat';

type ChatMessage = {
  role: 'agent' | 'user';
  text: string;
  actionResult?: string | null;
};

// Simple markdown-ish renderer
function FormattedMessage({ text, isUser }: { text: string; isUser: boolean }) {
  const textColor = isUser ? '#FFFFFF' : Colors.text;
  const lines = text.split('\n');

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        // Bullet points
        if (/^[-•]\s/.test(trimmed)) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: textColor }]}>•</Text>
              <Text style={[styles.msgText, { color: textColor, flex: 1 }]}>
                {renderInline(trimmed.replace(/^[-•]\s/, ''), textColor)}
              </Text>
            </View>
          );
        }
        // Numbered list
        if (/^\d+[.)]\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+[.)])\s(.*)/);
          if (match) {
            return (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bulletNum, { color: textColor }]}>{match[1]}</Text>
                <Text style={[styles.msgText, { color: textColor, flex: 1 }]}>
                  {renderInline(match[2], textColor)}
                </Text>
              </View>
            );
          }
        }
        // Empty line
        if (!trimmed) return <View key={i} style={{ height: 6 }} />;
        // Normal text
        return (
          <Text key={i} style={[styles.msgText, { color: textColor }]}>
            {renderInline(trimmed, textColor)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(text: string, color: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t${lastIndex}`} style={{ color }}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }
    if (match[2]) {
      // Bold
      parts.push(
        <Text key={`b${match.index}`} style={{ fontWeight: '700', color }}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // Italic
      parts.push(
        <Text key={`i${match.index}`} style={{ fontStyle: 'italic', color }}>
          {match[3]}
        </Text>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(
      <Text key={`t${lastIndex}`} style={{ color }}>
        {text.slice(lastIndex)}
      </Text>
    );
  }
  return parts.length ? parts : [<Text key="0" style={{ color }}>{text}</Text>];
}

const CAPABILITIES = [
  { icon: 'clipboard-outline' as const, color: '#3B82F6', bg: '#EFF6FF', title: 'Task Management', desc: 'Create, edit, update & delete tasks' },
  { icon: 'folder-outline' as const, color: '#22C55E', bg: '#F0FDF4', title: 'Project Details', desc: 'View projects, members & progress' },
  { icon: 'bar-chart-outline' as const, color: '#8B5CF6', bg: '#F5F3FF', title: 'Analytics & Reports', desc: 'Workload, deadlines & insights' },
  { icon: 'people-outline' as const, color: '#F97316', bg: '#FFF7ED', title: 'Team Overview', desc: 'Check who\'s available & assigned' },
  { icon: 'sparkles-outline' as const, color: '#EC4899', bg: '#FDF2F8', title: 'Smart Actions', desc: 'Natural language commands & more' },
];

export default function AiChatbot() {
  const { user, access, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [agentName, setAgentName] = useState('');
  const [agentNameInput, setAgentNameInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const api = useCallback(() => createApi(access), [access]);

  // Draggable FAB position
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
  const FAB_SIZE = 56;
  const STATUS_BAR_H = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 12;
  const NAV_BAR_H = Platform.OS === 'ios' ? 88 : 70;
  const TOP_MARGIN = STATUS_BAR_H + 10;
  const BOTTOM_MARGIN = NAV_BAR_H + 20;

  const pan = useRef(new RNAnimated.ValueXY({
    x: SCREEN_W - FAB_SIZE - 16,
    y: SCREEN_H - BOTTOM_MARGIN - FAB_SIZE,
  })).current;
  const panOffset = useRef({ x: SCREEN_W - FAB_SIZE - 16, y: SCREEN_H - BOTTOM_MARGIN - FAB_SIZE });
  const hasDragged = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onPanResponderGrant: () => {
        hasDragged.current = false;
        pan.setOffset(panOffset.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3) {
          hasDragged.current = true;
        }
        // Clamp within screen bounds
        const newX = Math.max(8, Math.min(SCREEN_W - FAB_SIZE - 8, panOffset.current.x + gesture.dx));
        const newY = Math.max(TOP_MARGIN, Math.min(SCREEN_H - BOTTOM_MARGIN - FAB_SIZE, panOffset.current.y + gesture.dy));
        pan.setValue({ x: newX - panOffset.current.x, y: newY - panOffset.current.y });
      },
      onPanResponderRelease: (_, gesture) => {
        const finalX = Math.max(8, Math.min(SCREEN_W - FAB_SIZE - 8, panOffset.current.x + gesture.dx));
        const finalY = Math.max(TOP_MARGIN, Math.min(SCREEN_H - BOTTOM_MARGIN - FAB_SIZE, panOffset.current.y + gesture.dy));
        pan.flattenOffset();
        panOffset.current = { x: finalX, y: finalY };
        pan.setValue({ x: finalX, y: finalY });

        if (!hasDragged.current) {
          setIsOpen(true);
        }
      },
    })
  ).current;

  // Pulse animation for FAB
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Load saved agent name
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(`agent_name_${user.id}`);
        if (saved) {
          setAgentName(saved);
          setStep('chat');
        }
      } catch {}
    })();
  }, [user?.id]);

  // Load conversation from backend
  const loadConversation = useCallback(async () => {
    try {
      const res = await api().get('/api/agent/conversation/');
      if (res.data?.messages?.length) {
        setMessages(
          res.data.messages
            .filter((m: { role: string }) => m.role !== 'system')
            .map((m: { role: string; content: string }) => ({
              role: m.role === 'user' ? 'user' : 'agent',
              text: m.content,
            }))
        );
      }
    } catch {}
  }, [api]);

  // Load history when chat opens
  useEffect(() => {
    if (isOpen && step === 'chat') {
      loadConversation();
    }
  }, [isOpen, step, loadConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isTyping]);

  const saveAgentName = async () => {
    const name = agentNameInput.trim();
    if (!name) return;
    setAgentName(name);
    if (user?.id) {
      await SecureStore.setItemAsync(`agent_name_${user.id}`, name);
    }
    setStep('capabilities');
  };

  const startChat = () => {
    setStep('loading');
    setTimeout(() => {
      setMessages([{
        role: 'agent',
        text: `Hi ${user?.username || 'there'}! I'm ${agentName}, your project management assistant. How can I help you today?`,
      }]);
      setStep('chat');
    }, 2000);
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || isTyping) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setIsTyping(true);

    try {
      const res = await api().post('/api/agent/chat/', { message: text });
      const { reply, action_result } = res.data;
      setMessages(prev => [
        ...prev,
        { role: 'agent', text: reply, actionResult: action_result },
      ]);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 'Sorry, something went wrong. Please try again.';
      setMessages(prev => [...prev, { role: 'agent', text: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearConversation = async () => {
    try {
      await api().delete('/api/agent/conversation/');
      setMessages([{
        role: 'agent',
        text: `Conversation cleared! How can I help you, ${user?.username || 'there'}?`,
      }]);
    } catch {}
  };

  const renameAgent = async () => {
    const name = renameInput.trim();
    if (!name) return;
    setAgentName(name);
    if (user?.id) {
      await SecureStore.setItemAsync(`agent_name_${user.id}`, name);
    }
    setIsRenaming(false);
    setRenameInput('');
  };

  const resetAgent = async () => {
    if (user?.id) {
      await SecureStore.deleteItemAsync(`agent_name_${user.id}`);
    }
    try { await api().delete('/api/agent/conversation/'); } catch {}
    setAgentName('');
    setAgentNameInput('');
    setMessages([]);
    setChatInput('');
    setShowSettings(false);
    setIsRenaming(false);
    setStep('welcome');
  };

  if (!isAuthenticated) return null;

  const userDisplayName = user?.username || 'User';
  const userRoles = user?.roles?.length ? user.roles.join(', ') : 'Team Member';

  // ─── Render helpers ────────────────────────────

  const renderWelcome = () => (
    <View style={styles.centeredStep}>
      <View style={[styles.stepIcon, { backgroundColor: '#3B82F6' }]}>
        <RobotAvatar size={52} />
      </View>
      <Text style={styles.stepTitle}>Hi There!</Text>
      <Text style={styles.stepSubtitle}>
        Welcome <Text style={{ fontWeight: '700', color: Colors.text }}>{userDisplayName}</Text>
        {'\n'}to Connecta Agentic Communicator{'\n'}Let's grow with your skills
        {'\n'}<Text style={{ color: Colors.primary, fontWeight: '600' }}>({userRoles})</Text>
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('name-agent')}>
        <Text style={styles.primaryBtnText}>Let's move</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  const renderNameAgent = () => (
    <View style={styles.centeredStep}>
      <View style={[styles.stepIcon, { backgroundColor: '#8B5CF6' }]}>
        <Ionicons name="sparkles" size={36} color="#FFF" />
      </View>
      <Text style={styles.stepTitle}>Name Your Agent</Text>
      <Text style={styles.stepSubtitle}>Pick a name for your personal AI assistant</Text>
      <TextInput
        style={styles.nameInput}
        placeholder="e.g. Andy, Nova, Max..."
        placeholderTextColor={Colors.textMuted}
        value={agentNameInput}
        onChangeText={setAgentNameInput}
        onSubmitEditing={saveAgentName}
        autoFocus
        returnKeyType="done"
      />
      <TouchableOpacity
        style={[styles.primaryBtn, !agentNameInput.trim() && styles.disabledBtn]}
        onPress={saveAgentName}
        disabled={!agentNameInput.trim()}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  const renderCapabilities = () => (
    <View style={styles.capabilitiesStep}>
      <Text style={styles.stepTitle}>Meet {agentName}!</Text>
      <Text style={[styles.stepSubtitle, { marginBottom: 16 }]}>Here's what I can do for you</Text>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {CAPABILITIES.map((cap, i) => (
          <View key={i} style={styles.capCard}>
            <View style={[styles.capIconBox, { backgroundColor: cap.bg }]}>
              <Ionicons name={cap.icon} size={20} color={cap.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.capTitle}>{cap.title}</Text>
              <Text style={styles.capDesc}>{cap.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={startChat}>
        <Text style={styles.primaryBtnText}>All Set! Let's Go</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.centeredStep}>
      <View style={[styles.stepIcon, { backgroundColor: '#22C55E' }]}>
        <Ionicons name="checkmark-circle" size={40} color="#FFF" />
      </View>
      <Text style={styles.stepTitle}>All Set!</Text>
      <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
      <Text style={[styles.stepSubtitle, { fontSize: FontSize.xs }]}>Preparing {agentName}...</Text>
    </View>
  );

  const renderSettings = () => (
    <View style={{ flex: 1, padding: Spacing.lg }}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => { setShowSettings(false); setIsRenaming(false); }}
      >
        <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
        <Text style={styles.backBtnText}>Back to chat</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { textAlign: 'left', marginBottom: 20 }]}>Settings</Text>

      {/* Rename */}
      <Text style={styles.settingLabel}>Agent Name</Text>
      {isRenaming ? (
        <View style={styles.renameRow}>
          <TextInput
            style={[styles.nameInput, { flex: 1, textAlign: 'left', marginBottom: 0 }]}
            value={renameInput}
            onChangeText={setRenameInput}
            onSubmitEditing={renameAgent}
            autoFocus
            placeholder="New name..."
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.smallBtn, !renameInput.trim() && styles.disabledBtn]}
            onPress={renameAgent}
            disabled={!renameInput.trim()}
          >
            <Text style={styles.smallBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.settingValueRow}>
          <Text style={styles.settingValue}>{agentName || 'Connecta Agent'}</Text>
          <TouchableOpacity onPress={() => { setIsRenaming(true); setRenameInput(agentName); }}>
            <Ionicons name="pencil" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Capabilities */}
      <Text style={[styles.settingLabel, { marginTop: 20 }]}>What I can do</Text>
      {CAPABILITIES.map((cap, i) => (
        <View key={i} style={styles.settingCapRow}>
          <View style={[styles.settingCapIcon, { backgroundColor: cap.bg }]}>
            <Ionicons name={cap.icon} size={14} color={cap.color} />
          </View>
          <Text style={styles.settingCapText}>{cap.desc}</Text>
        </View>
      ))}

      {/* Reset */}
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.resetBtn} onPress={resetAgent}>
        <Ionicons name="refresh" size={18} color={Colors.error} />
        <Text style={styles.resetBtnText}>Reset Agent</Text>
      </TouchableOpacity>
      <Text style={styles.resetHint}>
        This will clear your conversation and restart from the beginning.
      </Text>
    </View>
  );

  const renderMessageItem = ({ item }: { item: ChatMessage & { _key: string } }) => (
    <View>
      <View style={[styles.msgRow, item.role === 'user' ? styles.msgRowUser : styles.msgRowAgent]}>
        {item.role === 'agent' && (
          <View style={styles.agentAvatar}>
            <RobotAvatar size={20} />
          </View>
        )}
        <View style={[
          styles.msgBubble,
          item.role === 'user' ? styles.userBubble : styles.agentBubble,
        ]}>
          <FormattedMessage text={item.text} isUser={item.role === 'user'} />
        </View>
      </View>
      {item.actionResult && (
        <View style={[styles.msgRow, styles.msgRowAgent]}>
          <View style={{ width: 28 }} />
          <View style={styles.actionResultBubble}>
            <FormattedMessage text={item.actionResult} isUser={false} />
          </View>
        </View>
      )}
    </View>
  );

  const renderChat = () => {
    const data = messages.map((m, i) => ({ ...m, _key: `${i}` }));
    return (
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={item => item._key}
        renderItem={renderMessageItem}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListFooterComponent={
          isTyping ? (
            <View style={[styles.msgRow, styles.msgRowAgent]}>
              <View style={styles.agentAvatar}>
                <RobotAvatar size={20} />
              </View>
              <View style={[styles.msgBubble, styles.agentBubble, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <ActivityIndicator size="small" color={Colors.textMuted} />
                <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{agentName} is thinking...</Text>
              </View>
            </View>
          ) : null
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
    );
  };

  return (
    <>
      {/* Floating Action Button - Draggable */}
      {!isOpen && (
        <RNAnimated.View
          style={[styles.fab, {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: pulseAnim },
            ],
          }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.fabInner}>
            <RobotAvatar size={40} />
          </View>
        </RNAnimated.View>
      )}

      {/* Chat Modal */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle={isFullscreen ? 'fullScreen' : 'pageSheet'}
        statusBarTranslucent={isFullscreen}
        onRequestClose={() => { setIsOpen(false); setShowSettings(false); setIsFullscreen(false); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: '#FFF' }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={[styles.header, isFullscreen && styles.headerFullscreen]}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <RobotAvatar size={28} />
              </View>
              <View>
                <Text style={styles.headerTitle}>{agentName || 'Connecta Agent'}</Text>
                <Text style={styles.headerSubtitle}>AI Assistant</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {step === 'chat' && !showSettings && (
                <>
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => setIsFullscreen(f => !f)}
                  >
                    <Ionicons
                      name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                      size={18}
                      color="rgba(255,255,255,0.7)"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerBtn} onPress={clearConversation}>
                    <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => { setShowSettings(true); setIsRenaming(false); }}
                  >
                    <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => { setIsOpen(false); setShowSettings(false); setIsFullscreen(false); }}
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body */}
          <View style={{ flex: 1 }}>
            {showSettings && renderSettings()}
            {!showSettings && step === 'welcome' && renderWelcome()}
            {!showSettings && step === 'name-agent' && renderNameAgent()}
            {!showSettings && step === 'capabilities' && renderCapabilities()}
            {!showSettings && step === 'loading' && renderLoading()}
            {!showSettings && step === 'chat' && renderChat()}
          </View>

          {/* Chat Input */}
          {!showSettings && step === 'chat' && (
            <View style={styles.inputBar}>
              <TextInput
                style={styles.chatInput}
                placeholder={`Ask ${agentName} anything...`}
                placeholderTextColor={Colors.textMuted}
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!chatInput.trim() || isTyping) && styles.disabledBtn]}
                onPress={sendMessage}
                disabled={!chatInput.trim() || isTyping}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // FAB
  fab: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
    elevation: 8,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },

  // Header
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerFullscreen: {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFF', fontWeight: '700', fontSize: FontSize.md },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.xs },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: {
    padding: 8,
    borderRadius: 8,
  },

  // Steps (onboarding)
  centeredStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  capabilitiesStep: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  stepIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  stepTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: Radius.xl,
    marginTop: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '600', fontSize: FontSize.md },
  disabledBtn: { opacity: 0.4 },
  nameInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: FontSize.md,
    textAlign: 'center',
    color: Colors.text,
    marginTop: 16,
  },

  // Capabilities
  capCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 8,
  },
  capIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capTitle: { fontWeight: '600', fontSize: FontSize.sm, color: Colors.text },
  capDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Chat messages
  msgRow: {
    flexDirection: 'row',
    marginBottom: 10,
    maxWidth: '88%',
  },
  msgRowUser: { alignSelf: 'flex-end' },
  msgRowAgent: { alignSelf: 'flex-start' },
  agentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '90%',
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
  },
  actionResultBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    maxWidth: '90%',
  },
  msgText: { fontSize: FontSize.sm, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', marginBottom: 2 },
  bulletDot: { width: 16, fontSize: FontSize.sm, lineHeight: 20 },
  bulletNum: { width: 22, fontSize: FontSize.sm, lineHeight: 20, fontWeight: '600' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: '#FFF',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: FontSize.sm,
    color: Colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Settings
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  settingLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  settingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  settingValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  smallBtnText: { color: '#FFF', fontWeight: '600', fontSize: FontSize.xs },
  settingCapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 6,
  },
  settingCapIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCapText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.errorBg,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  resetBtnText: { color: Colors.error, fontWeight: '600', fontSize: FontSize.sm },
  resetHint: {
    textAlign: 'center',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 8,
  },
});
