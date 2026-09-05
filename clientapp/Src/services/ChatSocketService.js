import { NativeModules, Platform } from "react-native";
import { SOCKET_URL } from "../config/AppConfig";
import { loadMessages, saveMessage, updateMessageStatus } from "./ChatStorage";

const { NativeSocketModule } = NativeModules;

/**
 * ChatSocketService — Reusable standalone service for customer chat messaging,
 * history sync, and active screen suppression.
 */
class ChatSocketService {
  constructor() {
    this.messageListeners = new Set();
  }

  setActiveChatScreen(screenName = "CustomerChat", peerId = null, conversationId = null) {
    if (Platform.OS === "android" && NativeSocketModule?.setActiveScreen) {
      try {
        NativeSocketModule.setActiveScreen(screenName, peerId, conversationId);
      } catch (e) {
        console.warn("[ChatSocketService] setActiveChatScreen error:", e);
      }
    }
  }

  clearActiveChatScreen() {
    if (Platform.OS === "android" && NativeSocketModule?.setActiveScreen) {
      try {
        NativeSocketModule.setActiveScreen(null, null, null);
      } catch (e) {
        console.warn("[ChatSocketService] clearActiveChatScreen error:", e);
      }
    }
  }

  async sendMessage(messageData, currentUserId = "customer_101", currentUserType = "client") {
    if (Platform.OS !== "android" || !NativeSocketModule) return false;
    try {
      const messageId =
        messageData.messageId ||
        messageData.id ||
        `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      const payload = JSON.stringify({
        type: "sendMessage",
        messageId,
        id: messageId,
        senderId: messageData.senderId || currentUserId,
        receiverId: messageData.receiverId,
        senderType: messageData.senderType || currentUserType,
        receiverType: messageData.receiverType || (currentUserType === "client" ? "driver" : "client"),
        message: messageData.message || "",
        messageType: messageData.messageType || messageData.type || "text",
        timestamp: messageData.timestamp || Date.now(),
        conversationId: messageData.conversationId || "",
      });

      return await NativeSocketModule.sendMessage(payload);
    } catch (error) {
      console.error("[ChatSocketService] sendMessage error:", error);
      return false;
    }
  }

  async getMessages(userId, otherUserId, timeoutMs = 5000) {
    const uId = userId || "customer_101";

    try {
      const httpUrl = `${SOCKET_URL}/api/messages?userId=${encodeURIComponent(uId)}&otherUserId=${encodeURIComponent(otherUserId)}`;
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(httpUrl, { signal: controller.signal });
      clearTimeout(abortTimer);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.messages)) {
          console.log(`[ChatSocketService] HTTP fetched ${json.messages.length} messages`);
          return json.messages;
        }
      }
    } catch (httpErr) {
      console.log("[ChatSocketService] HTTP getMessages failed, trying WS fallback:", httpErr?.message);
    }

    return [];
  }

  handleIncomingMessage(data) {
    if (data?.type === "receiveMessage" || data?.type === "chat") {
      const convId =
        data.conversationId ||
        [data.senderId, data.receiverId].filter(Boolean).sort().join("_");
      if (convId) {
        saveMessage(convId, { ...data, status: "delivered" });
      }
    }
    this.messageListeners.forEach((listener) => listener(data));
  }

  onMessage(callback) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }
}

export default new ChatSocketService();
export { ChatSocketService };
