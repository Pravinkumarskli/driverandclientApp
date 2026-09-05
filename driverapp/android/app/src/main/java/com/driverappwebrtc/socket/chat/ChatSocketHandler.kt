package com.driverappwebrtc.socket.chat

import android.util.Log
import com.driverappwebrtc.socket.notifications.ChatNotificationManager
import org.json.JSONObject

/**
 * ChatSocketHandler — Reusable Handler for chat messages, delivery events,
 * and intelligent active screen suppression.
 */
class ChatSocketHandler(private val chatNotificationManager: ChatNotificationManager) {

    companion object {
        private const val TAG = "ChatSocketHandler"
    }

    fun handleIncomingMessage(
        json: JSONObject,
        isAppInForeground: Boolean,
        currentActiveScreen: String?,
        currentActivePeerId: String?,
        currentActiveConversationId: String?
    ): Boolean {
        val eventType = json.optString("type", "")
        if (eventType != "chat" && eventType != "receiveMessage") {
            return false
        }

        val senderId = json.optString("senderId", "Customer")
        val senderName = json.optString("senderName", senderId)
        val message = json.optString("message", "New customer message")
        val conversationId = json.optString("conversationId", "")
        val userType = json.optString("senderType", "client")
        val messageId = json.optString("messageId", json.optString("id", ""))

        // Suppress notification only if driver is actively in chat screen with this customer
        val isViewingThisChat = isAppInForeground &&
            (currentActiveScreen == "DriverChat" || currentActiveScreen == "CustomerChat" || currentActiveScreen == "Chat") &&
            (
                (!currentActiveConversationId.isNullOrEmpty() && currentActiveConversationId == conversationId) ||
                (!currentActivePeerId.isNullOrEmpty() && currentActivePeerId == senderId)
            )

        if (!isViewingThisChat) {
            chatNotificationManager.showMessageNotification(
                senderId = senderId,
                senderName = senderName,
                messageText = message,
                conversationId = conversationId,
                userType = userType,
                messageId = messageId
            )
        } else {
            Log.d(TAG, "Suppressed chat notification: driver is actively in chat screen with $senderId")
        }

        return true
    }
}
