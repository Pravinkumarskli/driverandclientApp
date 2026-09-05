package com.driverappwebrtc.socket

import android.Manifest
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Binder
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONObject

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

        const val LOCATION_UPDATE_INTERVAL_MS = 3000L
        const val LOCATION_MIN_DISTANCE_M = 0f

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
    private var webSocketManager: NativeWebSocketManager? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var locationManager: LocationManager? = null
    private var isLocationTrackingStarted = false

    private var currentUserId: String = "driver_201"
    private var currentUserType: String = "driver"
    private var currentServerUrl: String = ""

    var clientListener: NativeWebSocketManager.SocketEventListener? = null

    inner class LocalBinder : Binder() {
        fun getService(): SocketForegroundService = this@SocketForegroundService
    }

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            handleLocationUpdate(location)
        }

        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {
            Log.d(TAG, "Location provider enabled: $provider")
        }
        override fun onProviderDisabled(provider: String) {
            Log.w(TAG, "Location provider disabled: $provider")
        }
    }

    override fun onCreate() {
        super.onCreate()
        try {
            notificationHelper = NotificationHelper(this)
            webSocketManager = NativeWebSocketManager(this, this)
            locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager

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
            // Restore from SharedPreferences if killed/restarted by Android OS
            url = prefs.getString(KEY_URL, "") ?: ""
            userId = prefs.getString(KEY_USER_ID, "driver_201") ?: "driver_201"
            userType = prefs.getString(KEY_USER_TYPE, "driver") ?: "driver"
            Log.d(TAG, "Restored state from SharedPreferences: url=$url, userId=$userId, userType=$userType")
        } else {
            // Save to SharedPreferences for future sticky restarts
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
                    // Android 14+
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

        startLocationTracking()

        return START_STICKY
    }

    private fun startLocationTracking() {
        if (isLocationTrackingStarted) return

        val fineGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted && !coarseGranted) {
            Log.w(TAG, "⚠️ Location permissions not granted yet. Cannot start native GPS updates.")
            return
        }

        val lm = locationManager ?: return

        try {
            var requestedAny = false

            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    LOCATION_UPDATE_INTERVAL_MS,
                    LOCATION_MIN_DISTANCE_M,
                    locationListener
                )
                requestedAny = true
                Log.d(TAG, "🛰️ GPS_PROVIDER requested (every ${LOCATION_UPDATE_INTERVAL_MS}ms)")
            }

            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    LOCATION_UPDATE_INTERVAL_MS,
                    LOCATION_MIN_DISTANCE_M,
                    locationListener
                )
                requestedAny = true
                Log.d(TAG, "📶 NETWORK_PROVIDER requested (every ${LOCATION_UPDATE_INTERVAL_MS}ms)")
            }

            if (requestedAny) {
                isLocationTrackingStarted = true
                // Fetch last known location immediately
                val lastGps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                val lastNet = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                val lastLoc = lastGps ?: lastNet
                if (lastLoc != null) {
                    handleLocationUpdate(lastLoc)
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting location updates: ${e.message}", e)
        } catch (e: Exception) {
            Log.e(TAG, "Exception starting location updates: ${e.message}", e)
        }
    }

    private fun stopLocationTracking() {
        if (!isLocationTrackingStarted) return
        try {
            locationManager?.removeUpdates(locationListener)
            isLocationTrackingStarted = false
            Log.d(TAG, "Location updates stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error removing location updates: ${e.message}", e)
        }
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
        stopLocationTracking()
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

        // 2. Display notification for chat messages and incoming calls
        try {
            acquireWakeLock(15000)
            val json = JSONObject(messageJson)
            val eventType = json.optString("type", "")

            if (eventType == "chat" || eventType == "receiveMessage") {
                val senderId = json.optString("senderId", "Customer")
                val senderName = json.optString("senderName", senderId)
                val message = json.optString("message", "New customer message")
                val conversationId = json.optString("conversationId", "")
                val userType = json.optString("senderType", "client")
                val messageId = json.optString("messageId", json.optString("id", ""))

                // Check if driver is ALREADY on active chat screen with this customer
                val isViewingThisChat = isAppInForeground &&
                    (currentActiveScreen == "DriverChat" || currentActiveScreen == "CustomerChat" || currentActiveScreen == "Chat") &&
                    (
                        (!currentActiveConversationId.isNullOrEmpty() && currentActiveConversationId == conversationId) ||
                        (!currentActivePeerId.isNullOrEmpty() && currentActivePeerId == senderId)
                    )

                if (!isViewingThisChat) {
                    notificationHelper.showMessageNotification(
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
            } else if (eventType == "incomingCall" || eventType == "callUser") {
                val callerId = json.optString("callerId", json.optString("senderId", "Customer"))
                val callerName = json.optString("callerName", json.optString("senderName", "Customer"))
                val userType = json.optString("userType", json.optString("senderType", "client"))
                val offerObj = json.opt("offer")
                val offerJson = if (offerObj != null && offerObj != JSONObject.NULL) offerObj.toString() else ""

                // Always show incoming call notification (even when app is open), only suppress if already on connected call
                val isAlreadyInConnectedCall = isAppInForeground && (
                    currentActiveScreen == "VoiceCallScreen" ||
                    currentActiveScreen == "CustomerAnswerCallScreen"
                )

                if (!isAlreadyInConnectedCall) {
                    notificationHelper.showIncomingCallNotification(
                        callerId = callerId,
                        callerName = callerName,
                        userType = userType,
                        offerJson = offerJson
                    )
                } else {
                    Log.d(TAG, "Suppressed incoming call notification: driver is already on connected call ($currentActiveScreen)")
                }
            } else if (eventType == "endCall" || eventType == "callEnded" || eventType == "callRejected") {
                notificationHelper.cancelCallNotification()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error displaying message/call notification: ${e.message}", e)
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
        // Ensure location updates are running
        startLocationTracking()
    }

    override fun onSocketRegistered(userId: String, userType: String) {
        try {
            notificationHelper.updateForegroundNotification("Online as $userId - Ready for dispatch")
        } catch (e: Exception) {
            // Ignored
        }
        clientListener?.onSocketRegistered(userId, userType)
        // Ensure location updates are running
        startLocationTracking()
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
        startLocationTracking()
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
        stopLocationTracking()
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
