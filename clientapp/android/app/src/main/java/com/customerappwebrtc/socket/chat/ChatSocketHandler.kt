package com.customerappwebrtc.socket.chat

import android.util.Log
import com.customerappwebrtc.socket.notifications.ChatNotificationManager
import org.json.JSONObject

/**
 * ChatSocketHandler — Reusable Handler for chat messages, delivery events,
 * and intelligent active screen suppression in customer app.
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

        val senderId = json.optString("senderId", "Driver")
        val senderName = json.optString("senderName", senderId)
        val message = json.optString("message", "New message received")
        val conversationId = json.optString("conversationId", "")
        val userType = json.optString("senderType", "driver")
        val messageId = json.optString("messageId", json.optString("id", ""))

        // Check if customer is ALREADY on active chat screen with this driver
        val isViewingThisChat = isAppInForeground &&
            (currentActiveScreen == "CustomerChat" || currentActiveScreen == "DriverChat" || currentActiveScreen == "Chat") &&
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
            Log.d(TAG, "Suppressed chat notification: customer is actively in chat screen with $senderId")
        }

        return true
    }
}
