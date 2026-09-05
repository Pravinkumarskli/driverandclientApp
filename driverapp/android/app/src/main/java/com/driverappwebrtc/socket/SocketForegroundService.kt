package com.driverappwebrtc.socket

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import com.driverappwebrtc.socket.call.CallSocketHandler
import com.driverappwebrtc.socket.chat.ChatSocketHandler
import com.driverappwebrtc.socket.notifications.NotificationHelper
import com.driverappwebrtc.socket.tracking.LocationTrackingManager
import org.json.JSONObject

/**
 * SocketForegroundService — Main Android Foreground Service coordinator.
 * Orchestrates NativeWebSocketManager, LocationTrackingManager, ChatSocketHandler, and CallSocketHandler.
 */
class SocketForegroundService : Service(), NativeWebSocketManager.SocketEventListener {

    companion object {
        private const val TAG = "SocketService_Driver"
        const val ACTION_START = "ACTION_START_SOCKET_SERVICE"
        const val ACTION_STOP = "ACTION_STOP_SOCKET_SERVICE"

        const val EXTRA_URL = "EXTRA_SERVER_URL"
        const val EXTRA_USER_ID = "EXTRA_USER_ID"
        const val EXTRA_USER_TYPE = "EXTRA_USER_TYPE"

        private const val PREFS_NAME = "DriverSocketServicePrefs"
        private const val KEY_URL = "saved_server_url"
        private const val KEY_USER_ID = "saved_user_id"
        private const val KEY_USER_TYPE = "saved_user_type"

        var isServiceRunning = false
            private set

        // Default false: notifications will fire until JS runtime explicitly reports foreground
        var isAppInForeground = false

        // Track currently active screen and conversation to suppress notifications when user is actively looking at it
        var currentActiveScreen: String? = null
        var currentActivePeerId: String? = null
        var currentActiveConversationId: String? = null
    }

    private val binder = LocalBinder()
    private lateinit var notificationHelper: NotificationHelper
    private lateinit var chatSocketHandler: ChatSocketHandler
    private lateinit var callSocketHandler: CallSocketHandler
    private lateinit var locationTrackingManager: LocationTrackingManager
    private var webSocketManager: NativeWebSocketManager? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private var currentUserId: String = "driver_201"
    private var currentUserType: String = "driver"
    private var currentServerUrl: String = ""

    var clientListener: NativeWebSocketManager.SocketEventListener? = null

    inner class LocalBinder : Binder() {
        fun getService(): SocketForegroundService = this@SocketForegroundService
    }

    override fun onCreate() {
        super.onCreate()
        try {
            notificationHelper = NotificationHelper(this)
            chatSocketHandler = ChatSocketHandler(notificationHelper.chatNotificationManager)
            callSocketHandler = CallSocketHandler(notificationHelper.callNotificationManager)
            webSocketManager = NativeWebSocketManager(this, this)

            locationTrackingManager = LocationTrackingManager(this) { location ->
                handleLocationUpdate(location)
            }

            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CabDriver:SocketWakeLock")
        } catch (e: Exception) {
            Log.e(TAG, "Error in onCreate: ${e.message}", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        if (action == ACTION_STOP) {
            stopServiceInternal()
            return START_NOT_STICKY
        }

        // Handle start or sticky restart
        var url = intent?.getStringExtra(EXTRA_URL)
        var userId = intent?.getStringExtra(EXTRA_USER_ID)
        var userType = intent?.getStringExtra(EXTRA_USER_TYPE)

        if (url.isNullOrEmpty() || userId.isNullOrEmpty()) {
            url = prefs.getString(KEY_URL, "") ?: ""
            userId = prefs.getString(KEY_USER_ID, "driver_201") ?: "driver_201"
            userType = prefs.getString(KEY_USER_TYPE, "driver") ?: "driver"
            Log.d(TAG, "Restored state from SharedPreferences: url=$url, userId=$userId, userType=$userType")
        } else {
            prefs.edit()
                .putString(KEY_URL, url)
                .putString(KEY_USER_ID, userId)
                .putString(KEY_USER_TYPE, userType)
                .apply()
        }

        currentUserId = userId
        currentUserType = userType ?: "driver"
        currentServerUrl = url

        try {
            val notification = notificationHelper.buildForegroundNotification("Driver Active | Background Tracking & Dispatch Online")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                var foregroundType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    foregroundType = foregroundType or ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
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

        if (url.isNotEmpty()) {
            webSocketManager?.start(url, userId, currentUserType)
        }

        locationTrackingManager.startTracking()

        return START_STICKY
    }

    private fun handleLocationUpdate(location: Location) {
        val lat = location.latitude
        val lng = location.longitude
        val speed = location.speed
        val bearing = location.bearing
        val accuracy = location.accuracy
        val time = location.time

        Log.d(TAG, "📍 Native GPS Location: lat=$lat, lng=$lng, speed=$speed, acc=$accuracy")

        // 1. Send via Native WebSocket to Backend Server
        val payload = JSONObject().apply {
            put("type", "driverLocation")
            put("driverId", currentUserId)
            put("latitude", lat)
            put("longitude", lng)
            put("accuracy", accuracy.toDouble())
            put("speed", speed.toDouble())
            put("heading", bearing.toDouble())
            put("timestamp", time)
        }

        val sent = webSocketManager?.sendMessage(payload.toString()) ?: false
        Log.d(TAG, "📍 Location sent to backend Native WS (success: $sent)")

        // 2. Update status bar persistent notification
        try {
            val notifText = "📍 $currentUserId Active | Lat: ${String.format("%.4f", lat)}, Lng: ${String.format("%.4f", lng)}"
            notificationHelper.updateForegroundNotification(notifText)
        } catch (e: Exception) {
            // Ignored
        }

        // 3. Notify JS client listener if React Native runtime is active
        clientListener?.onLocationUpdate(lat, lng, speed, bearing, accuracy, time)
    }

    private fun stopServiceInternal() {
        isServiceRunning = false
        locationTrackingManager.stopTracking()
        webSocketManager?.stop()
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping service: ${e.message}", e)
        }
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d(TAG, "DriverApp task removed (swiped away). Keeping background service active.")
        isAppInForeground = false
        clientListener = null
    }

    override fun onMessageReceived(messageJson: String) {
        Log.d(TAG, "📩 onMessageReceived: ${messageJson.take(120)}")
        // 1. Forward directly to React Native JavaScript layer
        clientListener?.onMessageReceived(messageJson)

        // 2. Delegate to specialized Chat & Call Handlers
        try {
            acquireWakeLock(15000)
            val json = JSONObject(messageJson)

            val isChat = chatSocketHandler.handleIncomingMessage(
                json = json,
                isAppInForeground = isAppInForeground,
                currentActiveScreen = currentActiveScreen,
                currentActivePeerId = currentActivePeerId,
                currentActiveConversationId = currentActiveConversationId
            )

            if (!isChat) {
                callSocketHandler.handleIncomingCallEvent(
                    json = json,
                    isAppInForeground = isAppInForeground,
                    currentActiveScreen = currentActiveScreen
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing incoming message event: ${e.message}", e)
        }
    }

    override fun onConnectionStateChanged(state: String) {
        val text = when (state) {
            "CONNECTED" -> "Connected to dispatch - Syncing..."
            "CONNECTING" -> "Connecting to dispatch server..."
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
        locationTrackingManager.startTracking()
    }

    override fun onSocketRegistered(userId: String, userType: String) {
        try {
            notificationHelper.updateForegroundNotification("Online as $userId - Ready for dispatch")
        } catch (e: Exception) {
            // Ignored
        }
        clientListener?.onSocketRegistered(userId, userType)
        locationTrackingManager.startTracking()
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

    fun triggerLocationUpdate() {
        locationTrackingManager.startTracking()
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
        locationTrackingManager.stopTracking()
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
