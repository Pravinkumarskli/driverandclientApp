package com.driverappwebrtc.socket

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.driverappwebrtc.MainActivity
import com.driverappwebrtc.R

class NotificationHelper(private val context: Context) {

    companion object {
        const val FOREGROUND_CHANNEL_ID = "driver_socket_service_channel"
        const val FOREGROUND_CHANNEL_NAME = "Driver Connection Service"
        const val FOREGROUND_NOTIFICATION_ID = 3001

        const val CHAT_CHANNEL_ID = "driver_chat_messages_channel"
        const val CHAT_CHANNEL_NAME = "Customer Messages"

        const val CALL_CHANNEL_ID = "driver_incoming_calls_channel"
        const val CALL_CHANNEL_NAME = "Incoming Customer Calls"
        const val CALL_NOTIFICATION_ID = 4001
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
                description = "Keeps WebSocket connection active for live GPS dispatch & customer chat"
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
                description = "Instant notifications for incoming customer messages"
                enableLights(true)
                lightColor = Color.RED
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 150, 250)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            // 3. High-Priority Incoming Calls Channel with Ringtone & Vibration
            val defaultRingtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()

            val callChannel = NotificationChannel(
                CALL_CHANNEL_ID,
                CALL_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming voice calls from customers"
                enableLights(true)
                lightColor = Color.GREEN
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 500, 1000, 500, 1000)
                setSound(defaultRingtoneUri, audioAttributes)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            notificationManager.createNotificationChannel(serviceChannel)
            notificationManager.createNotificationChannel(chatChannel)
            notificationManager.createNotificationChannel(callChannel)
        }
    }

    fun buildForegroundNotification(statusText: String = "Driver active & ready for dispatch"): Notification {
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
            .setContentTitle("Cab Driver Online")
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
            action = "com.driverappwebrtc.ACTION_OPEN_CHAT"
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("senderId", senderId)
            putExtra("receiverId", senderId)
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

    fun showIncomingCallNotification(
        callerId: String,
        callerName: String,
        userType: String = "client",
        offerJson: String = ""
    ) {
        // 1. PendingIntent for clicking notification body (Opens IncomingCall screen)
        val intent = Intent(context, MainActivity::class.java).apply {
            action = "com.driverappwebrtc.ACTION_INCOMING_CALL"
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("callerId", callerId)
            putExtra("callerName", callerName)
            putExtra("senderId", callerId)
            putExtra("receiverName", callerName)
            putExtra("userType", userType)
            putExtra("offer", offerJson)
            putExtra("autoAnswer", false)
            putExtra("action", "INCOMING_CALL")
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            CALL_NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 2. PendingIntent for clicking "ANSWER" action button (Directly answers & opens call)
        val answerIntent = Intent(context, MainActivity::class.java).apply {
            action = "com.driverappwebrtc.ACTION_ANSWER_CALL"
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("callerId", callerId)
            putExtra("callerName", callerName)
            putExtra("senderId", callerId)
            putExtra("receiverName", callerName)
            putExtra("userType", userType)
            putExtra("offer", offerJson)
            putExtra("autoAnswer", true)
            putExtra("action", "INCOMING_CALL")
        }

        val answerPendingIntent = PendingIntent.getActivity(
            context,
            CALL_NOTIFICATION_ID + 1,
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CALL_CHANNEL_ID)
            .setContentTitle("📞 Incoming Call")
            .setContentText("$callerName is calling you...")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setAutoCancel(true)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(R.mipmap.ic_launcher, "ANSWER", answerPendingIntent)
            .build()

        notificationManager.notify(CALL_NOTIFICATION_ID, notification)
    }

    fun cancelCallNotification() {
        notificationManager.cancel(CALL_NOTIFICATION_ID)
    }

    fun updateForegroundNotification(statusText: String) {
        notificationManager.notify(
            FOREGROUND_NOTIFICATION_ID,
            buildForegroundNotification(statusText)
        )
    }
}
