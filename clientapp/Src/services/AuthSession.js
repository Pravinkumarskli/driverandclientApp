/**
 * AuthSession.js (ClientApp)
 * Persists customer login session using AsyncStorage.
 * Allows auto-login on app launch until user manually logs out.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "cab_customer_saved_session";

export async function saveUserSession(sessionData) {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    console.log("[AuthSession] Customer session saved:", sessionData.userId);
  } catch (error) {
    console.warn("[AuthSession] Error saving customer session:", error);
  }
}

export async function getUserSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[AuthSession] Error reading customer session:", error);
    return null;
  }
}

export async function clearUserSession() {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    console.log("[AuthSession] Customer session cleared (Logged out)");
  } catch (error) {
    console.warn("[AuthSession] Error clearing customer session:", error);
  }
}
