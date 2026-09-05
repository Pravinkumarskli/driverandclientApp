import { NativeModules, Platform } from "react-native";

const { NativeSocketModule } = NativeModules;

/**
 * CallSocketService — Reusable standalone service for WebRTC call signaling,
 * notification dismissal, and active call screen tracking.
 */
class CallSocketService {
  // Set currently active call screen so native layer suppresses call notifications
  setActiveCallScreen(screenName = "DriverCallScreen", peerId = null) {
    if (Platform.OS === "android" && NativeSocketModule?.setActiveScreen) {
      try {
        NativeSocketModule.setActiveScreen(screenName, peerId, null);
      } catch (e) {
        console.warn("[CallSocketService] setActiveCallScreen error:", e);
      }
    }
  }

  // Clear active call screen when leaving screen
  clearActiveCallScreen() {
    if (Platform.OS === "android" && NativeSocketModule?.setActiveScreen) {
      try {
        NativeSocketModule.setActiveScreen(null, null, null);
      } catch (e) {
        console.warn("[CallSocketService] clearActiveCallScreen error:", e);
      }
    }
  }

  // Cancel incoming call notification from Android notification tray
  async cancelCallNotification() {
    try {
      if (Platform.OS === "android" && NativeSocketModule?.cancelCallNotification) {
        return await NativeSocketModule.cancelCallNotification();
      }
    } catch (e) {
      console.warn("[CallSocketService] cancelCallNotification error:", e);
    }
    return false;
  }
}

export default new CallSocketService();
export { CallSocketService };
