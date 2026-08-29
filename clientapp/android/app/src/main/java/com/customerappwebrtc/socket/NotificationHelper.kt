package com.customerappwebrtc.socket

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

class NotificationHelper(private val context: Context) {

    companion object {
        const val FOREGROUND_CHANNEL_ID = "customer_socket_service_channel"
        const val FOREGROUND_CHANNEL_NAME = "Customer Connection Service"
        const val FOREGROUND_NOTIFICATION_ID = 2001

        const val CHAT_CHANNEL_ID = "customer_chat_messages_channel"
        const val CHAT_CHANNEL_NAME = "Driver Messages"
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // 1. Silent Ongoing Service Channel
            val serviceChannel = NotificationChannel(
                FOREGROUND_CHANNEL_ID,
                FOREGROUND_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps WebSocket connection active for live driver tracking & chat"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }

            // 2. High-Importance Chat Messages Channel
            val chatChannel = NotificationChannel(
                CHAT_CHANNEL_ID,
                CHAT_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Instant notifications for incoming driver messages"
                enableLights(true)
                lightColor = Color.BLUE
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 150, 250)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            notificationManager.createNotificationChannel(serviceChannel)
            notificationManager.createNotificationChannel(chatChannel)
        }
    }

    fun buildForegroundNotification(statusText: String = "Connected to cab driver service"): Notification {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(context, FOREGROUND_CHANNEL_ID)
            .setContentTitle("Cab Customer Connected")
            .setContentText(statusText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
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
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("senderId", senderId)
            putExtra("receiverName", senderName)
            putExtra("conversationId", conversationId)
            putExtra("userType", userType)
            putExtra("messageId", messageId)
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

    fun updateForegroundNotification(statusText: String) {
        notificationManager.notify(
            FOREGROUND_NOTIFICATION_ID,
            buildForegroundNotification(statusText)
        )
    }
}
