import {
  AppState,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { SOCKET_URL, WS_URL } from "../config/AppConfig";
import { saveMessage } from "./ChatStorage";

const { NativeSocketModule } = NativeModules;
const socketEmitter =
  Platform.OS === "android" && NativeSocketModule
    ? new NativeEventEmitter(NativeSocketModule)
    : null;

class NativeSocketService {
  constructor() {
    this.isInitialized = false;
    this.currentUserId = null;
    this.currentUserType = "client";
    this.currentServerUrl = WS_URL;
    this.connectionState = "DISCONNECTED";

    this.messageListeners = new Set();
    this.connectionListeners = new Set();
    this.connectedListeners = new Set();
    this.registeredListeners = new Set();
    this.errorListeners = new Set();
    this.notificationListeners = new Set();

    if (Platform.OS === "android" && NativeSocketModule) {
      this.setupAppStateListener();
      this.setupEventListeners();
    }
  }

  // Request Android 13+ (API 33+) Notification Permission
  async requestNotificationPermission() {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      try {
        const checkGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (checkGranted) return true;

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn("[NativeSocketService] Permission request error:", err);
      }
    }
    return true;
  }

  // tt the Native Android WebSocket Foreground Service and wait for registration
  async start(
    serverUrl = WS_URL,
    userId = "customer_101",
    userType = "client",
    timeoutMs = 10000,
  ) {
    if (Platform.OS !== "android" || !NativeSocketModule) {
      console.warn("[NativeSocketService] NativeSocketModule is only available on Android");
      return false;
    }

    this.currentUserId = userId;
    this.currentUserType = userType;
    this.currentServerUrl = serverUrl;

    await this.requestNotificationPermission();

    return new Promise(async (resolve, reject) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          cleanupRegistrationWait();
          console.warn("[NativeSocketService] Socket registration timeout reached. Proceeding with service started.");
          resolve(false);
        }
      }, timeoutMs);

      const onRegistered = (data) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          cleanupRegistrationWait();
          console.log(`✅ [NativeSocketService] Native socket connected & registered for ${data?.userId || userId}`);
          resolve(true);
        }
      };

      const unsubRegistered = this.onSocketRegistered(onRegistered);

      const cleanupRegistrationWait = () => {
        if (unsubRegistered) unsubRegistered();
      };

      try {
        await NativeSocketModule.startService(serverUrl, userId, userType);
        this.isInitialized = true;
        console.log(`🚀 [NativeSocketService] Foreground service started for ${userId} (${userType}) at ${serverUrl}`);
      } catch (error) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          cleanupRegistrationWait();
          console.error("[NativeSocketService] Failed to start native service:", error);
          reject(error);
        }
      }
    });
  }

  // Stop the Native Service
  async stop() {
    if (Platform.OS !== "android" || !NativeSocketModule) return;
    try {
      await NativeSocketModule.stopService();
      this.isInitialized = false;
      this.connectionState = "DISCONNECTED";
      console.log("[NativeSocketService] Native socket service stopped");
    } catch (error) {
      console.error("[NativeSocketService] Failed to stop native service:", error);
    }
  }

  // Send message via native WebSocket
  async sendMessage(messageData) {
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
        senderId: messageData.senderId || this.currentUserId,
        receiverId: messageData.receiverId,
        senderType: messageData.senderType || this.currentUserType,
        receiverType: messageData.receiverType || (this.currentUserType === "client" ? "driver" : "client"),
        message: messageData.message || "",
        messageType: messageData.messageType || messageData.type || "text",
        timestamp: messageData.timestamp || Date.now(),
        conversationId: messageData.conversationId || "",
      });

      return await NativeSocketModule.sendMessage(payload);
    } catch (error) {
      console.error("[NativeSocketService] sendMessage error:", error);
      return false;
    }
  }

  // Publish the passenger's live home/pickup coordinate to the assigned driver.
  async sendCustomerLocation(locationData) {
    if (Platform.OS !== "android" || !NativeSocketModule) return false;
    try {
      return await NativeSocketModule.sendMessage(JSON.stringify({
        type: "customerLocation",
        customerId: this.currentUserId,
        ...locationData,
      }));
    } catch (error) {
      console.error("[NativeSocketService] sendCustomerLocation error:", error);
      return false;
    }
  }

  // Fetch message history from server (HTTP first for instant speed, WS as fallback)
  async getMessages(userId, otherUserId, timeoutMs = 5000) {
    const uId = userId || this.currentUserId;
    const convId = [uId, otherUserId].sort().join("_");

    // 1. Try fast HTTP REST endpoint first
    try {
      const httpUrl = `${SOCKET_URL}/api/messages?userId=${encodeURIComponent(uId)}&otherUserId=${encodeURIComponent(otherUserId)}`;
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(httpUrl, { signal: controller.signal });
      clearTimeout(abortTimer);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.messages)) {
          console.log(`[NativeSocketService] Client HTTP fetched ${json.messages.length} messages`);
          return json.messages;
        }
      }
    } catch (httpErr) {
      console.log("[NativeSocketService] Client HTTP getMessages failed, trying WS fallback:", httpErr?.message);
    }

    // 2. Native WebSocket fallback
    if (Platform.OS !== "android" || !NativeSocketModule) return [];
    try {
      const payload = JSON.stringify({
        type: "getMessages",
        userId: uId,
        otherUserId,
        receiverId: otherUserId,
      });

      return new Promise((resolve) => {
        let isSettled = false;

        const timer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            unsub();
            console.warn("[NativeSocketService] Client WS getMessages timeout");
            resolve([]);
          }
        }, timeoutMs);

        const unsub = this.onMessage((data) => {
          if (data?.type === "getMessagesResponse" && !isSettled) {
            isSettled = true;
            clearTimeout(timer);
            unsub();
            console.log(`[NativeSocketService] Client WS getMessages received ${data?.messages?.length || 0} messages`);
            resolve(data?.messages || []);
          }
        });

        NativeSocketModule.sendMessage(payload).catch((err) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            unsub();
            console.error("[NativeSocketService] Client WS getMessages send error:", err);
            resolve([]);
          }
        });
      });
    } catch (error) {
      console.error("[NativeSocketService] Client getMessages error:", error);
      return [];
    }
  }

  // Check connection status
  async getConnectionStatus() {
    if (Platform.OS !== "android" || !NativeSocketModule) return false;
    try {
      return await NativeSocketModule.getConnectionStatus();
    } catch (e) {
      return false;
    }
  }

  // Check if app was opened by tapping a notification
  async getInitialNotificationData() {
    if (Platform.OS !== "android" || !NativeSocketModule) return null;
    try {
      if (this.cachedInitialNotification) {
        return this.cachedInitialNotification;
      }
      const data = await NativeSocketModule.getInitialNotification();
      if (data) {
        this.cachedInitialNotification = data;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  async clearInitialNotificationData() {
    this.cachedInitialNotification = null;
    if (Platform.OS === "android" && NativeSocketModule?.clearInitialNotification) {
      try {
        await NativeSocketModule.clearInitialNotification();
      } catch (_) {}
    }
  }

  // Set active screen for conditional notification suppression
  setActiveScreen(screenName, peerId = null, conversationId = null) {
    if (Platform.OS === "android" && NativeSocketModule?.setActiveScreen) {
      try {
        NativeSocketModule.setActiveScreen(screenName, peerId, conversationId);
      } catch (e) {
        console.warn("[NativeSocketService] setActiveScreen error:", e);
      }
    }
  }

  // Sync AppState (Foreground vs Background) with Native Service
  setupAppStateListener() {
    AppState.addEventListener("change", (nextAppState) => {
      const isForeground = nextAppState === "active";
      if (NativeSocketModule?.setAppForegroundState) {
        NativeSocketModule.setAppForegroundState(isForeground);
      }
      if (!isForeground) {
        this.setActiveScreen(null, null, null);
      }
    });

    // Initialize with current state
    if (NativeSocketModule?.setAppForegroundState) {
      NativeSocketModule.setAppForegroundState(AppState.currentState === "active");
    }
  }

  setupEventListeners() {
    if (!socketEmitter) return;

    socketEmitter.addListener("receiveMessage", (rawJson) => {
      this.handleIncomingRawMessage(rawJson);
    });

    socketEmitter.addListener("onMessageReceived", (rawJson) => {
      this.handleIncomingRawMessage(rawJson);
    });

    socketEmitter.addListener("connectionStatus", (status) => {
      this.connectionState = status;
      this.connectionListeners.forEach((listener) => listener(status));
    });

    socketEmitter.addListener("onConnectionStateChanged", (status) => {
      this.connectionState = status;
      this.connectionListeners.forEach((listener) => listener(status));
    });

    socketEmitter.addListener("socketConnected", () => {
      this.connectedListeners.forEach((listener) => listener());
    });

    socketEmitter.addListener("socketRegistered", (data) => {
      this.registeredListeners.forEach((listener) => listener(data));
    });

    socketEmitter.addListener("socketError", (err) => {
      this.errorListeners.forEach((listener) => listener(err));
    });

    socketEmitter.addListener("onError", (err) => {
      this.errorListeners.forEach((listener) => listener(err));
    });

    socketEmitter.addListener("onNotificationOpened", (data) => {
      this.notificationListeners.forEach((listener) => listener(data));
    });
  }

  handleIncomingRawMessage(rawJson) {
    try {
      const data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;

      // ── Auto-persist incoming messages to ChatStorage immediately ──
      if (data?.type === "receiveMessage" || data?.type === "chat") {
        const convId =
          data.conversationId ||
          [data.senderId, data.receiverId].filter(Boolean).sort().join("_");
        if (convId) {
          saveMessage(convId, { ...data, status: "delivered" });
        }
      }

      this.messageListeners.forEach((listener) => listener(data));
    } catch (e) {
      console.error("[NativeSocketService] Error parsing incoming message:", e);
    }
  }

  onMessage(callback) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  onConnectionState(callback) {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  onSocketConnected(callback) {
    this.connectedListeners.add(callback);
    return () => this.connectedListeners.delete(callback);
  }

  onSocketRegistered(callback) {
    this.registeredListeners.add(callback);
    return () => this.registeredListeners.delete(callback);
  }

  onSocketError(callback) {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  onNotificationOpened(callback) {
    this.notificationListeners.add(callback);
    return () => this.notificationListeners.delete(callback);
  }

  async getInitialNotification() {
    try {
      if (NativeSocketModule?.getInitialNotification) {
        return await NativeSocketModule.getInitialNotification();
      }
    } catch (e) {
      console.warn("[NativeSocketService] getInitialNotification error:", e);
    }
    return null;
  }

  async clearInitialNotification() {
    try {
      if (NativeSocketModule?.clearInitialNotification) {
        await NativeSocketModule.clearInitialNotification();
      }
    } catch (e) {
      console.warn("[NativeSocketService] clearInitialNotification error:", e);
    }
  }

  async cancelCallNotification() {
    try {
      if (NativeSocketModule?.cancelCallNotification) {
        await NativeSocketModule.cancelCallNotification();
      }
    } catch (e) {
      console.warn("[NativeSocketService] cancelCallNotification error:", e);
    }
  }
}

export default new NativeSocketService();
