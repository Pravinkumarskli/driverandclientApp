import { NativeModules, Platform } from "react-native";

const { NativeSocketModule } = NativeModules;

/**
 * TrackingSocketService — Reusable standalone service for driver GPS location tracking & broadcast.
 */
class TrackingSocketService {
  constructor() {
    this.locationListeners = new Set();
  }

  // Send GPS location update via native WebSocket
  async sendLocation(locationData, driverId = "driver_201") {
    if (Platform.OS !== "android" || !NativeSocketModule) return false;
    try {
      const payload = JSON.stringify({
        type: "sendLocation",
        driverId: locationData.driverId || driverId,
        ...locationData,
      });
      return await NativeSocketModule.sendMessage(payload);
    } catch (error) {
      console.error("[TrackingSocketService] sendLocation error:", error);
      return false;
    }
  }

  // Trigger immediate native GPS fix update
  triggerLocationUpdate() {
    if (Platform.OS === "android" && NativeSocketModule?.triggerLocationUpdate) {
      NativeSocketModule.triggerLocationUpdate();
    }
  }

  handleLocationUpdate(locData) {
    this.locationListeners.forEach((listener) => listener(locData));
  }

  onLocationUpdate(callback) {
    this.locationListeners.add(callback);
    return () => this.locationListeners.delete(callback);
  }
}

export default new TrackingSocketService();
export { TrackingSocketService };
