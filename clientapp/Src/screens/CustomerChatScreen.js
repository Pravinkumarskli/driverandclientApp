import React, { useEffect, useRef, useState } from "react";
import {
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

import SocketService from "../services/SocketService";

const QUICK_REPLIES = [
  "I am at pickup point",
  "Where are you now?",
  "Please wait 2 mins",
  "Coming down right now",
];

export default function CustomerChatScreen({ route, navigation }) {
  const {
    userId = "customer_101",
    receiverId = "driver_201",
    receiverName = "Driver",
  } = route.params || {};

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);
  const conversationId = [userId, receiverId].sort().join("_");

  useEffect(() => {
    SocketService.connect(userId);

    const handleReceiveMessage = (message) => {
      if (message.conversationId === conversationId) {
        setMessages((current) => {
          if (current.some((m) => m.id === message.id)) {
            return current;
          }
          return [...current, message];
        });
      }
    };

    const handleMessageDelivered = (message) => {
      if (message.conversationId === conversationId) {
        setMessages((current) =>
          current.map((m) =>
            m.id === message.id ? { ...m, status: "delivered" } : m,
          ),
        );
      }
    };

    SocketService.getMessages(userId, receiverId, (result) => {
      if (result?.success && Array.isArray(result.messages)) {
        setMessages(result.messages);
      }
    });

    SocketService.on("receiveMessage", handleReceiveMessage);
    SocketService.on("messageDelivered", handleMessageDelivered);

    return () => {
      SocketService.off("receiveMessage", handleReceiveMessage);
      SocketService.off("messageDelivered", handleMessageDelivered);
    };
  }, [conversationId, receiverId, userId]);

  const sendMessage = (customText) => {
    const text = (customText || draft).trim();
    if (!text) return;

    const tempId = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newMsg = {
      id: tempId,
      conversationId,
      senderId: userId,
      receiverId,
      message: text,
      type: "text",
      timestamp: Date.now(),
      status: "sending",
    };

    setMessages((current) => [...current, newMsg]);
    if (!customText) {
      setDraft("");
    }

    SocketService.sendMessage(newMsg, (result) => {
      if (result?.success && result.message) {
        setMessages((current) =>
          current.map((m) => (m.id === tempId ? result.message : m)),
        );
      }
    });
  };

  const openCall = () => {
    navigation.navigate("CustomerCallScreen", {
      userId,
      receiverId,
      receiverName: receiverName || "Driver",
    });
  };

  const openTracking = () => {
    navigation.navigate("CustomerTracking", {
      customerId: userId,
      driverId: receiverId,
      driverName: receiverName || "Driver",
    });
  };

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === userId;
    const timeString = new Date(item.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.mineRow : styles.otherRow,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine ? styles.mineBubble : styles.otherBubble,
          ]}
        >
          <Text style={[styles.messageText, isMine && styles.mineText]}>
            {item.message}
          </Text>
          <View style={styles.bubbleFooter}>
            <Text style={[styles.time, isMine && styles.mineTime]}>
              {timeString}
            </Text>
            {isMine && (
              <Text style={styles.statusText}>
                {item.status === "delivered" ? "Delivered" : "Sent"}
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
        {/* Chat Header (Text-Only) */}
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
            <Text style={styles.headerStatus}>ONLINE • ACTIVE DRIVER</Text>
          </View>

          {/* Quick Header Text Action Buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerActionBtn, styles.headerTrackBtn]}
              onPress={openTracking}
              activeOpacity={0.7}
            >
              <Text style={styles.headerTrackBtnText}>TRACK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerActionBtn, styles.headerCallBtn]}
              onPress={openCall}
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
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Chat with Driver</Text>
              <Text style={styles.emptySub}>
                Coordinate pickup location or arrival status directly.
              </Text>
            </View>
          }
        />

        {/* Quick Reply Chips */}
        <View style={styles.quickRepliesContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={QUICK_REPLIES}
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

        {/* Input Composer (Text-Only) */}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message to driver..."
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
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
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
  backText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },
  headerStatus: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  headerTrackBtn: {
    backgroundColor: "#ECFDF5",
  },
  headerTrackBtnText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerCallBtn: {
    backgroundColor: "#EFF6FF",
  },
  headerCallBtnText: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexGrow: 1,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: "row",
  },
  mineRow: {
    justifyContent: "flex-end",
  },
  otherRow: {
    justifyContent: "flex-start",
  },
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
  mineBubble: {
    backgroundColor: "#2563EB",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  messageText: {
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 19,
  },
  mineText: {
    color: "#FFFFFF",
  },
  bubbleFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  time: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "500",
  },
  mineTime: {
    color: "#BFDBFE",
  },
  statusText: {
    color: "#BFDBFE",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
  },
  emptySub: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 240,
    lineHeight: 18,
  },
  quickRepliesContainer: {
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
  },
  quickRepliesList: {
    paddingHorizontal: 14,
    gap: 8,
  },
  quickChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  quickChipText: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "700",
  },
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
  sendButtonActive: {
    backgroundColor: "#2563EB",
  },
  sendText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
