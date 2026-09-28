import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { fetchLongTimeout } from '@/utils/apiClient';
import { FontAwesome6 } from '@expo/vector-icons';

type Msg = { role: 'user' | 'assistant'; content: string };

const GREETING =
  '你好呀，我是「弦歌回响」。孔子在杏坛弦歌讲学，有问必答、循循善诱——你有任何学习或生活上的困惑，都可以直接问我。今天想聊些什么？';

export default function QwenChatPage() {
  const router = useSafeRouter();
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const nextHistory: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages([...nextHistory, { role: 'assistant', content: '…' }]);
    setLoading(true);
    try {
      const payload = nextHistory.map(({ role, content }) => ({ role, content }));
      const res = await fetchLongTimeout('/api/v1/qwen-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      const data = await res.json();
      const reply = data?.content || '抱歉，我没有收到清晰的回复，换个说法再问我一次好吗？';
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant' as const, content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: '网络似乎开小差了，请稍后再试。' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  return (
    <Screen safeAreaEdges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>弦歌回响</Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.msgList}
          contentContainerStyle={styles.msgContent}
        >
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.userRow : styles.aiRow]}>
              {m.role === 'assistant' && (
                <View style={styles.avatar}>
                  <FontAwesome6 name="pen-nib" size={13} color="#fff" />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  m.role === 'user' ? styles.userBubble : styles.aiBubble,
                ]}
              >
                {m.content === '…' ? (
                  <ActivityIndicator size="small" color="#9CA3AF" />
                ) : (
                  <Text style={m.role === 'user' ? styles.userText : styles.aiText}>{m.content}</Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="向弦歌回响提问…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            activeOpacity={0.7}
            onPress={send}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome6 name="arrow-up" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#E5E5E5',
  },
  back: { width: 56 },
  backText: { fontSize: 14, color: '#000', fontFamily: 'serif' },
  title: { fontSize: 16, color: '#333', fontFamily: 'serif', fontWeight: '600' },
  body: { flex: 1, backgroundColor: '#F9FAFB' },
  msgList: { flex: 1 },
  msgContent: { padding: 16, paddingBottom: 24, gap: 12 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  avatar: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#1D4ED8',
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderBottomLeftRadius: 4 },
  userText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'serif', lineHeight: 22 },
  aiText: { fontSize: 15, color: '#1F2937', fontFamily: 'serif', lineHeight: 22 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120,
    borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB',
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: 'serif',
    color: '#1F2937',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#1D4ED8',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#9CA3AF' },
});