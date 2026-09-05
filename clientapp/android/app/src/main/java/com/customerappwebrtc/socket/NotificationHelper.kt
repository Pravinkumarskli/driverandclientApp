package com.customerappwebrtc.socket

import android.app.Notification
import android.content.Context
import com.customerappwebrtc.socket.notifications.CallNotificationManager
import com.customerappwebrtc.socket.notifications.ChatNotificationManager
import com.customerappwebrtc.socket.notifications.ServiceNotificationManager

/**
 * NotificationHelper — Unified Facade for clientapp aggregating ChatNotificationManager,
 * CallNotificationManager, and ServiceNotificationManager.
 */
class NotificationHelper(context: Context) {

    companion object {
        const val FOREGROUND_CHANNEL_ID = ServiceNotificationManager.FOREGROUND_CHANNEL_ID
        const val FOREGROUND_CHANNEL_NAME = ServiceNotificationManager.FOREGROUND_CHANNEL_NAME
        const val FOREGROUND_NOTIFICATION_ID = ServiceNotificationManager.FOREGROUND_NOTIFICATION_ID

        const val CHAT_CHANNEL_ID = ChatNotificationManager.CHAT_CHANNEL_ID
        const val CHAT_CHANNEL_NAME = ChatNotificationManager.CHAT_CHANNEL_NAME

        const val CALL_CHANNEL_ID = CallNotificationManager.CALL_CHANNEL_ID
        const val CALL_CHANNEL_NAME = CallNotificationManager.CALL_CHANNEL_NAME
        const val CALL_NOTIFICATION_ID = CallNotificationManager.CALL_NOTIFICATION_ID
    }

    val chatNotificationManager = ChatNotificationManager(context)
    val callNotificationManager = CallNotificationManager(context)
    val serviceNotificationManager = ServiceNotificationManager(context)

    fun buildForegroundNotification(statusText: String = "Connected to driver & live tracking"): Notification {
        return serviceNotificationManager.buildForegroundNotification(statusText)
    }

    fun updateForegroundNotification(statusText: String) {
        serviceNotificationManager.updateForegroundNotification(statusText)
    }

    fun showMessageNotification(
        senderId: String,
        senderName: String,
        messageText: String,
        conversationId: String,
        userType: String,
        messageId: String = ""
    ) {
        chatNotificationManager.showMessageNotification(
            senderId = senderId,
            senderName = senderName,
            messageText = messageText,
            conversationId = conversationId,
            userType = userType,
            messageId = messageId
        )
    }

    fun showIncomingCallNotification(
        callerId: String,
        callerName: String,
        userType: String = "driver",
        offerJson: String = ""
    ) {
        callNotificationManager.showIncomingCallNotification(
            callerId = callerId,
            callerName = callerName,
            userType = userType,
            offerJson = offerJson
        )
    }

    fun cancelCallNotification() {
        callNotificationManager.cancelCallNotification()
    }
}
