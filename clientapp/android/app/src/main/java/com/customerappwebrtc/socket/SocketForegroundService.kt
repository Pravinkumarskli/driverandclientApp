package com.customerappwebrtc.socket

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import org.json.JSONObject

class SocketForegroundService : Service(), NativeWebSocketManager.SocketEventListener {

    companion object {
        private const val TAG = "SocketService_Client"
        const val ACTION_START = "ACTION_START_SOCKET_SERVICE"
        const val ACTION_STOP = "ACTION_STOP_SOCKET_SERVICE"

        const val EXTRA_URL = "EXTRA_SERVER_URL"
        const val EXTRA_USER_ID = "EXTRA_USER_ID"
        const val EXTRA_USER_TYPE = "EXTRA_USER_TYPE"

        var isServiceRunning = false
            private set

        // Default false: notifications fire until JS explicitly reports foreground
        var isAppInForeground = false
    }

    private val binder = LocalBinder()
    private lateinit var notificationHelper: NotificationHelper
    private var webSocketManager: NativeWebSocketManager? = null
    private var wakeLock: PowerManager.WakeLock? = null

    var clientListener: NativeWebSocketManager.SocketEventListener? = null

    inner class LocalBinder : Binder() {
        fun getService(): SocketForegroundService = this@SocketForegroundService
    }

    override fun onCreate() {
        super.onCreate()
        try {
            notificationHelper = NotificationHelper(this)
            webSocketManager = NativeWebSocketManager(this, this)

            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CabCustomer:SocketWakeLock")
        } catch (e: Exception) {
            Log.e(TAG, "Error in onCreate: ${e.message}", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        if (action == ACTION_START) {
            val url = intent.getStringExtra(EXTRA_URL) ?: ""
            val userId = intent.getStringExtra(EXTRA_USER_ID) ?: ""
            val userType = intent.getStringExtra(EXTRA_USER_TYPE) ?: "client"

            try {
                val notification = notificationHelper.buildForegroundNotification("Connecting to driver service...")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    var foregroundType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                        // Android 14+
                        foregroundType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
                    }
                    startForeground(
                        NotificationHelper.FOREGROUND_NOTIFICATION_ID,
                        notification,
                        foregroundType
                    )
                } else {
                    startForeground(
                        NotificationHelper.FOREGROUND_NOTIFICATION_ID,
                        notification
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to startForeground: ${e.message}", e)
            }

            isServiceRunning = true
            webSocketManager?.start(url, userId, userType)
        } else if (action == ACTION_STOP) {
            stopServiceInternal()
        }

        return START_STICKY
    }

    private fun stopServiceInternal() {
        isServiceRunning = false
        webSocketManager?.stop()
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping service: ${e.message}", e)
        }
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onMessageReceived(messageJson: String) {
        // 1. Forward directly to React Native JavaScript layer
        clientListener?.onMessageReceived(messageJson)

        // 2. Show notification when app is backgrounded or JS runtime is detached
        if (!isAppInForeground || clientListener == null) {
            try {
                acquireWakeLock(10000)
                val json = JSONObject(messageJson)
                val eventType = json.optString("type", "")

                if (eventType == "chat" || eventType == "receiveMessage") {
                    val senderId = json.optString("senderId", "Driver")
                    val senderName = json.optString("senderName", senderId)
                    val message = json.optString("message", "New message received")
                    val conversationId = json.optString("conversationId", "")
                    val userType = json.optString("senderType", "driver")
                    val messageId = json.optString("messageId", json.optString("id", ""))

                    notificationHelper.showMessageNotification(
                        senderId = senderId,
                        senderName = senderName,
                        messageText = message,
                        conversationId = conversationId,
                        userType = userType,
                        messageId = messageId
                    )
                } else if (eventType == "incomingCall" || eventType == "callUser") {
                    val callerId = json.optString("callerId", json.optString("senderId", "Driver"))
                    val callerName = json.optString("callerName", json.optString("senderName", "Driver"))
                    val userType = json.optString("userType", json.optString("senderType", "driver"))
                    val offerJson = json.optString("offer", "")

                    notificationHelper.showIncomingCallNotification(
                        callerId = callerId,
                        callerName = callerName,
                        userType = userType,
                        offerJson = offerJson
                    )
                } else if (eventType == "endCall" || eventType == "callEnded" || eventType == "callRejected") {
                    notificationHelper.cancelCallNotification()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error displaying message/call notification: ${e.message}", e)
            }
        }
    }

    override fun onConnectionStateChanged(state: String) {
        val text = when (state) {
            "CONNECTED" -> "Connected to driver & tracking"
            "CONNECTING" -> "Connecting to driver service..."
            else -> "Disconnected - Reconnecting..."
        }
        try {
            notificationHelper.updateForegroundNotification(text)
        } catch (e: Exception) {
            // Ignored
        }
        clientListener?.onConnectionStateChanged(state)
    }

    override fun onSocketConnected() {
        clientListener?.onSocketConnected()
    }

    override fun onSocketRegistered(userId: String, userType: String) {
        try {
            notificationHelper.updateForegroundNotification("Connected & Online as $userId")
        } catch (e: Exception) {
            // Ignored
        }
        clientListener?.onSocketRegistered(userId, userType)
    }

    override fun onError(errorMessage: String) {
        clientListener?.onError(errorMessage)
    }

    fun sendMessage(messageJson: String): Boolean {
        return webSocketManager?.sendMessage(messageJson) ?: false
    }

    fun isConnected(): Boolean {
        return webSocketManager?.isConnected() ?: false
    }

    private fun acquireWakeLock(durationMs: Long) {
        try {
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(durationMs)
            }
        } catch (e: Exception) {
            Log.e(TAG, "WakeLock acquire error: ${e.message}", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        webSocketManager?.cleanup()
        if (wakeLock?.isHeld == true) {
            try {
                wakeLock?.release()
            } catch (e: Exception) {
                // Ignored
            }
        }
    }
}
