package com.customerappwebrtc.socket.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.customerappwebrtc.MainActivity
import com.customerappwebrtc.R

/**
 * ServiceNotificationManager — Reusable Notification Manager for ongoing sticky Foreground Service in clientapp.
 */
class ServiceNotificationManager(private val context: Context) {

    companion object {
        const val FOREGROUND_CHANNEL_ID = "customer_socket_service_channel"
        const val FOREGROUND_CHANNEL_NAME = "Customer Connection Service"
        const val FOREGROUND_NOTIFICATION_ID = 3001
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createServiceChannel()
    }

    private fun createServiceChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                FOREGROUND_CHANNEL_ID,
                FOREGROUND_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps WebSocket connection active for live dispatch & chat"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            notificationManager.createNotificationChannel(serviceChannel)
        }
    }

    fun buildForegroundNotification(statusText: String = "Connected to driver & live tracking"): Notification {
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
            .setContentTitle("Cab Customer Online")
            .setContentText(statusText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    fun updateForegroundNotification(statusText: String) {
        notificationManager.notify(
            FOREGROUND_NOTIFICATION_ID,
            buildForegroundNotification(statusText)
        )
    }
}
