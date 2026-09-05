package com.customerappwebrtc.socket.notifications

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
import com.customerappwebrtc.MainActivity
import com.customerappwebrtc.R

/**
 * CallNotificationManager — Reusable Notification Manager for customer incoming calls.
 */
class CallNotificationManager(private val context: Context) {

    companion object {
        const val CALL_CHANNEL_ID = "customer_incoming_calls_channel"
        const val CALL_CHANNEL_NAME = "Incoming Driver Calls"
        const val CALL_NOTIFICATION_ID = 4001
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createCallChannel()
    }

    private fun createCallChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
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
                description = "Incoming voice calls from drivers"
                enableLights(true)
                lightColor = Color.GREEN
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 500, 1000, 500, 1000)
                setSound(defaultRingtoneUri, audioAttributes)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(callChannel)
        }
    }

    fun showIncomingCallNotification(
        callerId: String,
        callerName: String,
        userType: String = "driver",
        offerJson: String = ""
    ) {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = "com.customerappwebrtc.ACTION_INCOMING_CALL"
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

        val answerIntent = Intent(context, MainActivity::class.java).apply {
            action = "com.customerappwebrtc.ACTION_ANSWER_CALL"
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
}
