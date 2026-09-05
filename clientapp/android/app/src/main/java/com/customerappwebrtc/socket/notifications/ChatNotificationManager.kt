package com.customerappwebrtc.socket.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import com.customerappwebrtc.MainActivity
import com.customerappwebrtc.R

/**
 * ChatNotificationManager — Reusable Notification Manager for incoming customer chat messages.
 */
class ChatNotificationManager(private val context: Context) {

    companion object {
        const val CHAT_CHANNEL_ID = "customer_chat_messages_channel"
        const val CHAT_CHANNEL_NAME = "Driver Messages"
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createChatChannel()
    }

    private fun createChatChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val chatChannel = NotificationChannel(
                CHAT_CHANNEL_ID,
                CHAT_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Instant notifications for messages from drivers"
                enableLights(true)
                lightColor = Color.RED
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 150, 250)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(chatChannel)
        }
    }

    fun showMessageNotification(
        senderId: String,
        senderName: String,
        messageText: String,
        conversationId: String,
        userType: String,
        messageId: String = ""
    ) {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = "com.customerappwebrtc.ACTION_OPEN_CHAT"
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("senderId", senderId)
            putExtra("receiverId", senderId)
            putExtra("receiverName", senderName)
            putExtra("conversationId", conversationId)
            putExtra("userType", userType)
            putExtra("messageId", messageId)
            putExtra("message", messageText)
            putExtra("action", "OPEN_CHAT")
        }

        val notificationId = senderId.hashCode()

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHAT_CHANNEL_ID)
            .setContentTitle(senderName)
            .setContentText(messageText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        notificationManager.notify(notificationId, notification)
    }

    fun cancelMessageNotification(senderId: String) {
        notificationManager.cancel(senderId.hashCode())
    }
}
