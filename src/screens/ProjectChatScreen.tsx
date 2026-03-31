import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useChatNotifications } from '../contexts/ChatNotificationContext';
import { createApi } from '../services/api';

type ChatMessage = {
  id: number;
  sender: { id: number; username: string; email: string };
  content: string;
  created_at: string;
  is_edited: boolean;
  reply_to?: {
    id: number;
    sender: { id: number; username: string };
    content: string;
  } | null;
};

export default function ProjectChatScreen({ route }: any) {
  const { projectId } = route.params;
  const { access, user } = useAuth();
  const { markAsRead } = useChatNotifications();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const api = createApi(access);
      const res = await api.get(`/api/chat/project/${projectId}/messages/`);
      setMessages(res.data || []);
    } catch {
      if (!silent) Alert.alert('Error', 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
    markAsRead(projectId);
    // Poll for new messages every 5 seconds
    pollRef.current = setInterval(() => load(true), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [access, projectId]));

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const api = createApi(access);
      const payload: any = { content };
      if (replyTo) payload.reply_to = replyTo.id;
      await api.post(`/api/chat/project/${projectId}/messages/`, payload);
      setText('');
      setReplyTo(null);
      await load(true);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (msg: ChatMessage) => {
    Alert.alert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await createApi(access).delete(`/api/chat/project/${projectId}/messages/${msg.id}/`);
            setMessages(prev => prev.filter(m => m.id !== msg.id));
          } catch {
            Alert.alert('Error', 'Failed to delete.');
          }
        },
      },
    ]);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMe = item.sender.id === user?.id;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDate = !prevMsg ||
      new Date(item.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

    return (
      <View>
        {showDate && (
          <View style={styles.dateSep}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => {
            if (isMe) {
              Alert.alert('Message', undefined, [
                { text: 'Reply', onPress: () => setReplyTo(item) },
                { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
                { text: 'Cancel', style: 'cancel' },
              ]);
            } else {
              setReplyTo(item);
            }
          }}
          style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}
        >
          {!isMe && (
            <Text style={styles.senderName}>{item.sender.username}</Text>
          )}
          {item.reply_to && (
            <View style={styles.replyBar}>
              <Text style={styles.replyAuthor}>{item.reply_to.sender.username}</Text>
              <Text style={styles.replyText} numberOfLines={1}>{item.reply_to.content}</Text>
            </View>
          )}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <View style={styles.msgMeta}>
            <Text style={[styles.timeText, isMe && styles.timeTextMe]}>{formatTime(item.created_at)}</Text>
            {item.is_edited && <Text style={[styles.editedText, isMe && styles.timeTextMe]}>edited</Text>}
          </View>
        </TouchableOpacity>
      </View>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptyHint}>Start the conversation!</Text>
          </View>
        }
      />

      {/* Reply preview */}
      {replyTo && (
        <View style={styles.replyPreview}>
          <View style={styles.replyPreviewBar} />
          <View style={styles.replyPreviewContent}>
            <Text style={styles.replyPreviewAuthor}>Replying to {replyTo.sender.username}</Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingBottom: Spacing.sm },

  dateSep: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.lg },
  dateLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dateText: {
    fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600',
    marginHorizontal: Spacing.md,
  },

  bubble: {
    maxWidth: '80%', borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  bubbleMe: {
    backgroundColor: Colors.primary, alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.surface, alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  senderName: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.info, marginBottom: 2 },

  replyBar: {
    borderLeftWidth: 3, borderLeftColor: Colors.primaryLight,
    marginBottom: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 4,
    paddingVertical: Spacing.xs, paddingRight: Spacing.xs, paddingLeft: Spacing.sm,
  },
  replyAuthor: { fontSize: 10, fontWeight: '700', color: Colors.info },
  replyText: { fontSize: 11, color: Colors.textSecondary },

  msgText: { fontSize: FontSize.md, color: Colors.text, lineHeight: 22 },
  msgTextMe: { color: '#fff' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, justifyContent: 'flex-end' },
  timeText: { fontSize: 10, color: Colors.textMuted },
  timeTextMe: { color: 'rgba(255,255,255,0.7)' },
  editedText: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },

  replyPreview: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  replyPreviewBar: { width: 3, height: 32, backgroundColor: Colors.primary, borderRadius: 2, marginRight: Spacing.sm },
  replyPreviewContent: { flex: 1 },
  replyPreviewAuthor: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  replyPreviewText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: Colors.surface, padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
  },
  input: {
    flex: 1, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full, paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    fontSize: FontSize.md, color: Colors.text,
    maxHeight: 100, marginRight: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },

  emptyWrap: { alignItems: 'center', paddingTop: 120 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
});
