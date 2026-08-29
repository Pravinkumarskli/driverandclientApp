/**
 * AuthSession.js (DriverApp)
 * Persists driver login session using AsyncStorage.
 * Allows auto-login on app launch until user manually logs out.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "cab_driver_saved_session";

export async function saveDriverSession(sessionData) {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    console.log("[AuthSession] Driver session saved:", sessionData.driverId);
  } catch (error) {
    console.warn("[AuthSession] Error saving driver session:", error);
  }
}

export async function getDriverSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[AuthSession] Error reading driver session:", error);
    return null;
  }
}

export async function clearDriverSession() {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    console.log("[AuthSession] Driver session cleared (Logged out)");
  } catch (error) {
    console.warn("[AuthSession] Error clearing driver session:", error);
  }
}
