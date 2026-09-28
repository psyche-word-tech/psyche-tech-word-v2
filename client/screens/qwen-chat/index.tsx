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
    setMessages([...nextHistory, { role: 'assistant', content: '' }]);
    setLoading(true);
    try {
      const payload = nextHistory.map(({ role, content }) => ({ role, content }));
      const res = await fetchLongTimeout('/api/v1/qwen-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      if (!res.ok || !res.body) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: '服务暂时不可用，请稍后再试。' },
        ]);
        return;
      }
      // 流式消费 SSE，逐字累积到最后一个 assistant 气泡
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          if (!part.startsWith('data:')) continue;
          const payloadStr = part.slice(5).trim();
          if (payloadStr === '[DONE]') continue;
          if (payloadStr.startsWith('[ERROR]')) {
            const msg = payloadStr.slice(7).trim().replace(/^"|"$/g, '');
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: 'assistant', content: `出错了：${msg}`.slice(0, 200) },
            ]);
            return;
          }
          try {
            const parsed = JSON.parse(payloadStr);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              full += delta;
              setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: full }]);
            }
          } catch { /* 忽略无法解析的 SSE 行 */ }
        }
      }
      if (!full) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: '抱歉，我没有收到清晰的回复，换个说法再问我一次好吗？' },
        ]);
      }
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

  // 首次进入立即滚到底，让完整引导语可见（动画版可能因首帧未就绪而停在顶部）
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(t);
  }, []);

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
                {m.content && m.content !== '…' ? (
                  <Text style={m.role === 'user' ? styles.userText : styles.aiText}>
                    {m.content}
                    {m.role === 'assistant' && loading && i === messages.length - 1 && (
                      <Text style={styles.cursor}>▍</Text>
                    )}
                  </Text>
                ) : (
                  <ActivityIndicator size="small" color="#9CA3AF" />
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
            placeholder="向弦歌回响提问，或说说你的困惑…"
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
  cursor: { fontSize: 16, color: '#1D4ED8', fontWeight: '700' },
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