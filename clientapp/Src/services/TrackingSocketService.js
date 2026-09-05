import { NativeModules, Platform } from "react-native";

const { NativeSocketModule } = NativeModules;

/**
 * TrackingSocketService — Reusable standalone service for customer location publishing & driver tracking.
 */
class TrackingSocketService {
  async sendCustomerLocation(locationData, customerId = "customer_101") {
    if (Platform.OS !== "android" || !NativeSocketModule) return false;
    try {
      return await NativeSocketModule.sendMessage(
        JSON.stringify({
          type: "customerLocation",
          customerId: locationData.customerId || customerId,
          ...locationData,
        })
      );
    } catch (error) {
      console.error("[TrackingSocketService] sendCustomerLocation error:", error);
      return false;
    }
  }
}

export default new TrackingSocketService();
export { TrackingSocketService };
