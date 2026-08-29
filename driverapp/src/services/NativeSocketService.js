import {
  AppState,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { WS_URL } from "../config/AppConfig";

const { NativeSocketModule } = NativeModules;
const socketEmitter =
  Platform.OS === "android" && NativeSocketModule
    ? new NativeEventEmitter(NativeSocketModule)
    : null;

class NativeSocketService {
  constructor() {
    this.isInitialized = false;
    this.currentUserId = null;
    this.currentUserType = "driver";
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
        console.warn("[NativeSocketService] Driver permission request error:", err);
      }
    }
    return true;
  }

  // Start the Native Android WebSocket Foreground Service and wait for registration
  async start(
    serverUrl = WS_URL,
    userId = "driver_201",
    userType = "driver",
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
          console.warn("[NativeSocketService] Driver socket registration timeout reached. Proceeding with service started.");
          resolve(false);
        }
      }, timeoutMs);

      const onRegistered = (data) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          cleanupRegistrationWait();
          console.log(`✅ [NativeSocketService] Driver native socket connected & registered for ${data?.userId || userId}`);
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
        console.log(`🚀 [NativeSocketService] Driver foreground service started for ${userId} (${userType}) at ${serverUrl}`);
      } catch (error) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          cleanupRegistrationWait();
          console.error("[NativeSocketService] Failed to start driver native service:", error);
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
      console.log("[NativeSocketService] Driver native socket service stopped");
    } catch (error) {
      console.error("[NativeSocketService] Failed to stop driver native service:", error);
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
        receiverType: messageData.receiverType || (this.currentUserType === "driver" ? "client" : "driver"),
        message: messageData.message || "",
        messageType: messageData.messageType || messageData.type || "text",
        timestamp: messageData.timestamp || Date.now(),
        conversationId: messageData.conversationId || "",
      });

      return await NativeSocketModule.sendMessage(payload);
    } catch (error) {
      console.error("[NativeSocketService] Driver sendMessage error:", error);
      return false;
    }
  }

  // Send GPS location update via native WebSocket
  async sendLocation(locationData) {
    if (Platform.OS !== "android" || !NativeSocketModule) return false;
    try {
      const payload = JSON.stringify({
        type: "sendLocation",
        driverId: this.currentUserId,
        ...locationData,
      });
      return await NativeSocketModule.sendMessage(payload);
    } catch (error) {
      console.error("[NativeSocketService] Driver sendLocation error:", error);
      return false;
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
      return await NativeSocketModule.getInitialNotification();
    } catch (e) {
      return null;
    }
  }

  // Sync AppState (Foreground vs Background) with Native Service
  setupAppStateListener() {
    AppState.addEventListener("change", (nextAppState) => {
      const isForeground = nextAppState === "active";
      if (NativeSocketModule?.setAppForegroundState) {
        NativeSocketModule.setAppForegroundState(isForeground);
      }
    });

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
      this.messageListeners.forEach((listener) => listener(data));
    } catch (e) {
      console.error("[NativeSocketService] Driver error parsing incoming message:", e);
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
}

export default new NativeSocketService();
