import {
  AppState,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { SOCKET_URL, WS_URL } from "../config/AppConfig";
import ChatSocketService from "./ChatSocketService";
import CallSocketService from "./CallSocketService";
import TrackingSocketService from "./TrackingSocketService";

const { NativeSocketModule } = NativeModules;
const socketEmitter =
  Platform.OS === "android" && NativeSocketModule
    ? new NativeEventEmitter(NativeSocketModule)
    : null;

/**
 * NativeSocketService — Unified Facade coordinating ChatSocketService,
 * CallSocketService, and TrackingSocketService.
 */
class NativeSocketService {
  constructor() {
    this.isInitialized = false;
    this.currentUserId = null;
    this.currentUserType = "driver";
    this.currentServerUrl = WS_URL;
    this.connectionState = "DISCONNECTED";

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

  // Standalone Sub-Services
  get chat() {
    return ChatSocketService;
  }

  get call() {
    return CallSocketService;
  }

  get tracking() {
    return TrackingSocketService;
  }

  // Request all necessary Android Location Permissions
  async requestLocationPermissions() {
    if (Platform.OS !== "android") return true;

    try {
      const permissionsToRequest = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];

      if (Platform.Version >= 33) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }

      const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
      const fineGranted =
        results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED;

      if (fineGranted && Platform.Version >= 29 && PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION) {
        try {
          const bgCheck = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
          );
          if (!bgCheck) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              {
                title: "Background Location Permission",
                message:
                  "App needs background location access so customers can track your cab even when the app is minimized or closed.",
                buttonPositive: "Allow All The Time",
              }
            );
          }
        } catch (bgErr) {
          console.warn("[NativeSocketService] Background location request error:", bgErr);
        }
      }

      return fineGranted;
    } catch (err) {
      console.warn("[NativeSocketService] Location permissions request error:", err);
      return false;
    }
  }

  // Request Android 13+ Notification Permission
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

  // Start the Native Android WebSocket Foreground Service
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
          console.warn("[NativeSocketService] Driver socket registration timeout reached.");
          resolve(false);
        }
      }, timeoutMs);

      const onRegistered = (data) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          cleanupRegistrationWait();
          console.log(`✅ [NativeSocketService] Connected & registered for ${data?.userId || userId}`);
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
    } catch (error) {
      console.error("[NativeSocketService] Failed to stop native service:", error);
    }
  }

  // ─── CHAT DELEGATION ───────────────────────────────────────────
  sendMessage(messageData) {
    return ChatSocketService.sendMessage(messageData, this.currentUserId, this.currentUserType);
  }

  getMessages(userId, otherUserId, timeoutMs = 5000) {
    return ChatSocketService.getMessages(userId || this.currentUserId, otherUserId, timeoutMs);
  }

  onMessage(callback) {
    return ChatSocketService.onMessage(callback);
  }

  // ─── TRACKING DELEGATION ───────────────────────────────────────
  sendLocation(locationData) {
    return TrackingSocketService.sendLocation(locationData, this.currentUserId);
  }

  triggerLocationUpdate() {
    TrackingSocketService.triggerLocationUpdate();
  }

  onLocationUpdate(callback) {
    return TrackingSocketService.onLocationUpdate(callback);
  }

  // ─── CALL DELEGATION ───────────────────────────────────────────
  cancelCallNotification() {
    return CallSocketService.cancelCallNotification();
  }

  // ─── ACTIVE SCREEN TRACKING ────────────────────────────────────
  setActiveScreen(screenName, peerId = null, conversationId = null) {
    if (Platform.OS === "android" && NativeSocketModule?.setActiveScreen) {
      try {
        NativeSocketModule.setActiveScreen(screenName, peerId, conversationId);
      } catch (e) {
        console.warn("[NativeSocketService] setActiveScreen error:", e);
      }
    }
  }

  // ─── NOTIFICATION INTENT HELPERS ──────────────────────────────
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

  async getInitialNotification() {
    return this.getInitialNotificationData();
  }

  async clearInitialNotification() {
    return this.clearInitialNotificationData();
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

  // Sync AppState with Native Service
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

    socketEmitter.addListener("onLocationUpdate", (locData) => {
      TrackingSocketService.handleLocationUpdate(locData);
    });

    socketEmitter.addListener("driverLocation", (locData) => {
      TrackingSocketService.handleLocationUpdate(locData);
    });

    socketEmitter.addListener("onNotificationOpened", (data) => {
      this.notificationListeners.forEach((listener) => listener(data));
    });
  }

  handleIncomingRawMessage(rawJson) {
    try {
      const data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
      ChatSocketService.handleIncomingMessage(data);
    } catch (e) {
      console.error("[NativeSocketService] Error parsing incoming message:", e);
    }
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
export { NativeSocketService, ChatSocketService, CallSocketService, TrackingSocketService };
