import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import NativeSocketService from "../services/NativeSocketService";
import { loadMessages, saveMessage, updateMessageStatus } from "../services/ChatStorage";
import { WS_URL } from "../config/AppConfig";

const DRIVER_QUICK_REPLIES = [
  "I am on the way",
  "Arrived at pickup point",
  "Traffic delay - 2 mins",
  "Okay, got it",
];

export default function DriverChatScreen({ route, navigation }) {
  const {
    userId = "driver_201",
    receiverId = "customer_101",
    receiverName = "Customer 101",
  } = route.params || {};

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);
  const conversationId = [userId, receiverId].sort().join("_");

  // ─── Merge helper: deduplicates by messageId / id ────────────────────────
  const mergeMessage = useCallback((incoming) => {
    const msgId = incoming.messageId || incoming.id;
    setMessages((prev) => {
      const exists = prev.some(
        (m) => (m.messageId && m.messageId === msgId) || m.id === msgId,
      );
      if (exists) {
        return prev.map((m) =>
          (m.messageId === msgId || m.id === msgId)
            ? { ...m, status: incoming.status || m.status }
            : m,
        );
      }
      return [...prev, { ...incoming, id: msgId }];
    });
  }, []);

  // ─── If opened from a notification containing a message, ingest immediately ─
  useEffect(() => {
    if (route.params?.message) {
      const notifMsgId = route.params.messageId || `${Date.now()}_notif`;
      const notifMsg = {
        id: notifMsgId,
        messageId: notifMsgId,
        conversationId,
        senderId: receiverId,
        receiverId: userId,
        senderType: "client",
        receiverType: "driver",
        message: route.params.message,
        type: "text",
        messageType: "text",
        timestamp: Date.now(),
        status: "delivered",
      };
      console.log("📥 [DriverChat] Ingesting message directly from notification params:", notifMsg);
      mergeMessage(notifMsg);
      saveMessage(conversationId, notifMsg);
    }
  }, [conversationId, receiverId, userId, route.params?.message, route.params?.messageId, mergeMessage]);

  // ─── Load messages from AsyncStorage + fetch from server on screen open ───
  useEffect(() => {
    let isCancelled = false;

    const loadAndSync = async () => {
      // 1. Load local messages first (instant)
      const stored = await loadMessages(conversationId);
      if (!isCancelled && stored.length > 0) {
        setMessages(stored);
      }

      // 2. Fetch server history (catches messages sent while app was closed or minimized)
      try {
        const serverMessages = await NativeSocketService.getMessages(userId, receiverId);
        if (!isCancelled && Array.isArray(serverMessages) && serverMessages.length > 0) {
          setMessages((prev) => {
            // Build a set of existing IDs for fast lookup
            const existingIds = new Set(
              prev.map((m) => m.messageId || m.id).filter(Boolean),
            );
            // Find new messages from server not in local
            const newMsgs = serverMessages.filter((m) => {
              const msgId = m.messageId || m.id;
              return msgId && !existingIds.has(msgId);
            });
            if (newMsgs.length === 0) return prev;

            console.log(`[DriverChat] Synced ${newMsgs.length} new message(s) from server`);
            const merged = [...prev, ...newMsgs].sort(
              (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
            );
            // Persist merged messages to AsyncStorage
            newMsgs.forEach((msg) => saveMessage(conversationId, msg));
            return merged;
          });
        }
      } catch (err) {
        console.warn("[DriverChat] Server message sync error:", err);
      }
    };

    loadAndSync();

    // Re-sync whenever app returns from minimized/background to foreground
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        console.log("🔄 [DriverChat] App resumed to active — re-syncing messages");
        loadAndSync();
      }
    });

    return () => {
      isCancelled = true;
      sub?.remove();
    };
  }, [conversationId, userId, receiverId]);

  // ─── Set active screen to suppress notifications while chatting ─────────
  useEffect(() => {
    NativeSocketService.setActiveScreen("DriverChat", receiverId, conversationId);
    return () => {
      NativeSocketService.setActiveScreen(null, null, null);
    };
  }, [receiverId, conversationId]);

  // ─── Native socket receive message listener ───────────────────────────────
  useEffect(() => {
    // Service is already started from LoginScreen — just set up listeners here.
    // Calling start() again would disrupt the existing bound connection.

    const unsub = NativeSocketService.onMessage((data) => {
      console.log("[DriverChat] raw event received:", JSON.stringify(data).slice(0, 120));

      if (data?.type === "receiveMessage" || data?.type === "chat") {
        const isThisConv =
          data.conversationId === conversationId ||
          (data.senderId === receiverId && data.receiverId === userId) ||
          (data.senderId === userId && data.receiverId === receiverId);

        if (isThisConv) {
          const msg = { ...data, status: "delivered" };
          mergeMessage(msg);
          saveMessage(conversationId, msg);
        }
      } else if (data?.type === "messageDelivered") {
        const deliveredId = data?.messageId || data?.id;
        if (deliveredId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === deliveredId || m.id === deliveredId
                ? { ...m, status: "delivered" }
                : m,
            ),
          );
          updateMessageStatus(conversationId, deliveredId, "delivered");
        }
      }
    });

    return () => {
      unsub();
    };
  }, [conversationId, mergeMessage, receiverId, userId]);

  // ─── Auto-scroll on new messages ─────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (customText) => {
      const text = (customText || draft).trim();
      if (!text) return;

      const tempId = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newMsg = {
        id: tempId,
        messageId: tempId,
        conversationId,
        senderId: userId,
        receiverId,
        senderType: "driver",
        receiverType: "client",
        message: text,
        type: "text",
        messageType: "text",
        timestamp: Date.now(),
        status: "sending",
      };

      setMessages((prev) => [...prev, newMsg]);
      if (!customText) setDraft("");

      // Persist immediately
      saveMessage(conversationId, newMsg);

      // Send via native OkHttp WebSocket
      NativeSocketService.sendMessage(newMsg).then((sent) => {
        console.log(`[DriverChat] sendMessage native sent=${sent} id=${tempId}`);
        if (sent) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: "sent" } : m)),
          );
          updateMessageStatus(conversationId, tempId, "sent");
        }
      });
    },
    [conversationId, draft, receiverId, userId],
  );

  // ─── Render single message bubble ────────────────────────────────────────
  const renderMessage = ({ item }) => {
    const isMine = item.senderId === userId;
    const timeString = new Date(item.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View style={[styles.messageRow, isMine ? styles.mineRow : styles.otherRow]}>
        <View style={[styles.bubble, isMine ? styles.mineBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMine && styles.mineText]}>
            {item.message}
          </Text>
          <View style={styles.bubbleFooter}>
            <Text style={[styles.time, isMine && styles.mineTime]}>{timeString}</Text>
            {isMine && (
              <Text style={styles.statusText}>
                {item.status === "delivered"
                  ? "✓✓ Delivered"
                  : item.status === "sent"
                  ? "✓ Sent"
                  : "Sending..."}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>BACK</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {receiverName}
            </Text>
            <Text style={styles.headerStatus}>CUSTOMER • ACTIVE RIDE</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerActionBtn, styles.headerTrackBtn]}
              onPress={() =>
                navigation.navigate("DriverTracking", {
                  driverId: userId,
                  customerId: receiverId,
                  customerName: receiverName || "Customer",
                })
              }
              activeOpacity={0.7}
            >
              <Text style={styles.headerTrackBtnText}>TRACK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerActionBtn, styles.headerCallBtn]}
              onPress={() =>
                navigation.navigate("DriverCallScreen", {
                  userId,
                  receiverId,
                  receiverName: receiverName || "Customer",
                })
              }
              activeOpacity={0.7}
            >
              <Text style={styles.headerCallBtnText}>CALL</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Message Feed */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id || item.messageId || String(item.timestamp)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Chat with {receiverName}</Text>
              <Text style={styles.emptySub}>
                Coordinate pickup location or arrival status in real time.
              </Text>
            </View>
          }
        />

        {/* Driver Quick Reply Chips */}
        <View style={styles.quickRepliesContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={DRIVER_QUICK_REPLIES}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.quickRepliesList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => sendMessage(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Input Composer */}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message to customer..."
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              draft.trim().length > 0 && styles.sendButtonActive,
            ]}
            onPress={() => sendMessage()}
            activeOpacity={0.8}
          >
            <Text style={styles.sendText}>SEND</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    height: 64,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  backText: { fontSize: 11, fontWeight: "800", color: "#0F172A", letterSpacing: 0.5 },
  headerInfo: { flex: 1 },
  headerName: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  headerStatus: { color: "#059669", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerActionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  headerTrackBtn: { backgroundColor: "#ECFDF5" },
  headerTrackBtnText: { color: "#059669", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  headerCallBtn: { backgroundColor: "#FEF2F2" },
  headerCallBtnText: { color: "#DC2626", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  messageList: { paddingHorizontal: 16, paddingVertical: 14, flexGrow: 1 },
  messageRow: { marginVertical: 4, flexDirection: "row" },
  mineRow: { justifyContent: "flex-end" },
  otherRow: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  mineBubble: { backgroundColor: "#2563EB", borderBottomRightRadius: 4 },
  otherBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  messageText: { color: "#0F172A", fontSize: 14, lineHeight: 19 },
  mineText: { color: "#FFFFFF" },
  bubbleFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  time: { color: "#64748B", fontSize: 10, fontWeight: "500" },
  mineTime: { color: "#BFDBFE" },
  statusText: { color: "#BFDBFE", fontSize: 10, fontWeight: "700" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyTitle: { color: "#0F172A", fontSize: 17, fontWeight: "800" },
  emptySub: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 240,
    lineHeight: 18,
  },
  quickRepliesContainer: { backgroundColor: "#F8FAFC", paddingVertical: 8 },
  quickRepliesList: { paddingHorizontal: 14, gap: 8 },
  quickChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  quickChipText: { color: "#0F172A", fontSize: 11, fontWeight: "700" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    color: "#0F172A",
    fontSize: 14,
  },
  sendButton: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#94A3B8",
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonActive: { backgroundColor: "#2563EB" },
  sendText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
});
