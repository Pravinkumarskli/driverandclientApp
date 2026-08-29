/**
 * ChatStorage.js — Async persistent chat history using AsyncStorage.
 * Key pattern: `chat_messages_<conversationId>`
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "chat_messages_";
const MAX_STORED_MESSAGES = 200;

function getKey(conversationId) {
  return `${KEY_PREFIX}${conversationId}`;
}

export async function loadMessages(conversationId) {
  try {
    const raw = await AsyncStorage.getItem(getKey(conversationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("[ChatStorage] loadMessages error:", e);
    return [];
  }
}

export async function saveMessage(conversationId, message) {
  try {
    const key = getKey(conversationId);
    const raw = await AsyncStorage.getItem(key);
    let existing = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        existing = Array.isArray(parsed) ? parsed : [];
      } catch (_) {}
    }

    const msgId = message.messageId || message.id;
    const alreadyExists = existing.some(
      (m) => (m.messageId && m.messageId === msgId) || (m.id && m.id === msgId),
    );

    if (alreadyExists) {
      const updated = existing.map((m) =>
        (m.messageId === msgId || m.id === msgId) ? { ...m, ...message } : m,
      );
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return;
    }

    const merged = [...existing, message];
    const trimmed = merged.slice(-MAX_STORED_MESSAGES);
    await AsyncStorage.setItem(key, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("[ChatStorage] saveMessage error:", e);
  }
}

export async function updateMessageStatus(conversationId, messageId, status) {
  try {
    const key = getKey(conversationId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const existing = JSON.parse(raw);
    if (!Array.isArray(existing)) return;
    const updated = existing.map((m) =>
      m.messageId === messageId || m.id === messageId ? { ...m, status } : m,
    );
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn("[ChatStorage] updateMessageStatus error:", e);
  }
}

export async function clearMessages(conversationId) {
  try {
    await AsyncStorage.removeItem(getKey(conversationId));
  } catch (e) {
    console.warn("[ChatStorage] clearMessages error:", e);
  }
}
