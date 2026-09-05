package com.driverappwebrtc.socket

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class NativeSocketModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), NativeWebSocketManager.SocketEventListener {

    companion object {
        const val MODULE_NAME = "NativeSocketModule"
        private const val TAG = "NativeSocketModule_Driver"
        private const val NOTIFICATION_PREFS = "CabDriverNotificationPrefs"
        private const val PENDING_NOTIFICATION_KEY = "pendingNotification"
        var pendingNotificationMap: Map<String, Any?>? = null
        var instance: NativeSocketModule? = null

        fun savePendingNotification(context: Context, data: Map<String, Any?>) {
            try {
                val json = org.json.JSONObject()
                data.forEach { (key, value) -> json.put(key, value) }
                context.getSharedPreferences(NOTIFICATION_PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(PENDING_NOTIFICATION_KEY, json.toString())
                    .apply()
                Log.d(TAG, "💾 Saved pending notification to disk: $json")
            } catch (e: Exception) {
                Log.w(TAG, "Unable to persist notification intent: ${e.message}")
            }
        }

        fun dispatchNotificationIntent(context: Context, paramsMap: Map<String, Any?>) {
            Log.d(TAG, "🔔 dispatchNotificationIntent called with action=${paramsMap["action"]}")
            pendingNotificationMap = paramsMap
            savePendingNotification(context, paramsMap)
            instance?.let { module ->
                try {
                    val map = Arguments.createMap().apply {
                        paramsMap.forEach { (k, v) ->
                            when (v) {
                                is String -> putString(k, v)
                                is Boolean -> putBoolean(k, v)
                                is Int -> putInt(k, v)
                                is Double -> putDouble(k, v)
                                else -> putString(k, v?.toString() ?: "")
                            }
                        }
                    }
                    module.sendEvent("onNotificationOpened", map)
                    Log.d(TAG, "🔔 Dispatched onNotificationOpened event to active React context")
                } catch (e: Exception) {
                    Log.w(TAG, "Error emitting onNotificationOpened event: ${e.message}")
                }
            }
        }
    }

    init {
        instance = this
    }

    private var service: SocketForegroundService? = null
    private var isBound = false
    private var pendingStartPromise: Promise? = null
    private var lastUserId: String = ""
    private var lastUserType: String = "driver"
    private var lastServerUrl: String = ""

    override fun getName(): String = MODULE_NAME

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            Log.d(TAG, "✅ Foreground service BOUND to NativeModule")
            val localBinder = binder as? SocketForegroundService.LocalBinder
            service = localBinder?.getService()
            service?.clientListener = this@NativeSocketModule
            isBound = true

            // Resolve any pending start promise now that service is bound
            pendingStartPromise?.let {
                Log.d(TAG, "Resolving pending startService promise (service is now bound)")
                it.resolve(true)
                pendingStartPromise = null
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.w(TAG, "⚠️ Foreground service UNBOUND from NativeModule")
            service?.clientListener = null
            service = null
            isBound = false
        }
    }

    @ReactMethod
    fun startService(serverUrl: String, userId: String, userType: String, promise: Promise) {
        try {
            // If already bound to same user, don't restart — just resolve
            if (isBound && service != null && lastUserId == userId && service!!.isConnected()) {
                Log.d(TAG, "Service already bound & connected for $userId. Skipping restart.")
                promise.resolve(true)
                return
            }

            Log.d(TAG, "startService called with url=$serverUrl, userId=$userId, userType=$userType")
            lastUserId = userId
            lastUserType = userType
            lastServerUrl = serverUrl

            val intent = Intent(reactContext, SocketForegroundService::class.java).apply {
                action = SocketForegroundService.ACTION_START
                putExtra(SocketForegroundService.EXTRA_URL, serverUrl)
                putExtra(SocketForegroundService.EXTRA_USER_ID, userId)
                putExtra(SocketForegroundService.EXTRA_USER_TYPE, userType)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            // Store promise to resolve when serviceConnection fires
            pendingStartPromise = promise

            if (!isBound) {
                reactContext.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            } else {
                // Already bound, resolve immediately
                pendingStartPromise = null
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start driver socket service: ${e.message}", e)
            pendingStartPromise = null
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            if (isBound) {
                try {
                    reactContext.unbindService(serviceConnection)
                } catch (e: Exception) {
                    Log.w(TAG, "unbindService error (ignored): ${e.message}")
                }
                isBound = false
            }
            val intent = Intent(reactContext, SocketForegroundService::class.java).apply {
                action = SocketForegroundService.ACTION_STOP
            }
            reactContext.stopService(intent)
            service = null
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop driver socket service: ${e.message}", e)
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun sendMessage(messageJsonString: String, promise: Promise) {
        val currentService = service
        if (currentService != null) {
            val success = currentService.sendMessage(messageJsonString)
            Log.d(TAG, "sendMessage result: $success | service bound: $isBound | connected: ${currentService.isConnected()}")
            promise.resolve(success)
        } else {
            Log.e(TAG, "sendMessage FAILED: service is null! isBound=$isBound")
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setAppForegroundState(isForeground: Boolean) {
        Log.d(TAG, "setAppForegroundState: $isForeground")
        SocketForegroundService.isAppInForeground = isForeground
        if (!isForeground) {
            // When app moves to background, clear active screen so all notifications show
            SocketForegroundService.currentActiveScreen = null
            SocketForegroundService.currentActivePeerId = null
            SocketForegroundService.currentActiveConversationId = null
        }
    }

    @ReactMethod
    fun setActiveScreen(screenName: String?, peerId: String?, conversationId: String?) {
        Log.d(TAG, "setActiveScreen: screen=$screenName, peerId=$peerId, conversationId=$conversationId")
        SocketForegroundService.currentActiveScreen = screenName
        SocketForegroundService.currentActivePeerId = peerId
        SocketForegroundService.currentActiveConversationId = conversationId
    }

    @ReactMethod
    fun getConnectionStatus(promise: Promise) {
        val isConnected = service?.isConnected() ?: false
        promise.resolve(isConnected)
    }

    private fun readPendingNotification(): Map<String, Any?>? {
        pendingNotificationMap?.let { return it }
        return try {
            val raw = reactContext.getSharedPreferences(NOTIFICATION_PREFS, Context.MODE_PRIVATE)
                .getString(PENDING_NOTIFICATION_KEY, null) ?: return null
            val json = org.json.JSONObject(raw)
            buildMap {
                val keys = json.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    put(key, json.get(key))
                }
            }.also { pendingNotificationMap = it }
        } catch (e: Exception) {
            Log.w(TAG, "Unable to read pending notification intent: ${e.message}")
            null
        }
    }

    @ReactMethod
    fun getInitialNotification(promise: Promise) {
        val data = readPendingNotification()
        Log.d(TAG, "🔔 getInitialNotification called, returning: $data")
        if (data != null) {
            val map = Arguments.createMap().apply {
                data.forEach { (k, v) ->
                    when (v) {
                        is String -> putString(k, v)
                        is Boolean -> putBoolean(k, v)
                        is Int -> putInt(k, v)
                        is Double -> putDouble(k, v)
                        else -> putString(k, v?.toString() ?: "")
                    }
                }
            }
            promise.resolve(map)
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun clearInitialNotification(promise: Promise) {
        Log.d(TAG, "🔔 clearInitialNotification called")
        pendingNotificationMap = null
        reactContext.getSharedPreferences(NOTIFICATION_PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(PENDING_NOTIFICATION_KEY)
            .apply()
        promise.resolve(true)
    }

    @ReactMethod
    fun cancelCallNotification(promise: Promise) {
        try {
            val notificationManager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.cancel(NotificationHelper.CALL_NOTIFICATION_ID)
            Log.d(TAG, "🔔 cancelCallNotification dismissed notification ${NotificationHelper.CALL_NOTIFICATION_ID}")
            pendingNotificationMap = null
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w(TAG, "Error in cancelCallNotification: ${e.message}")
            promise.resolve(false)
        }
    }

    private fun sendEvent(eventName: String, params: Any?) {
        try {
            if (reactContext.hasActiveReactInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, params)
            }
        } catch (e: Exception) {
            Log.e(TAG, "sendEvent($eventName) error: ${e.message}")
        }
    }

    override fun onMessageReceived(messageJson: String) {
        Log.d(TAG, "onMessageReceived: ${messageJson.take(100)}")
        sendEvent("receiveMessage", messageJson)
        sendEvent("onMessageReceived", messageJson)
    }

    override fun onConnectionStateChanged(state: String) {
        Log.d(TAG, "onConnectionStateChanged: $state")
        sendEvent("connectionStatus", state)
        sendEvent("onConnectionStateChanged", state)
    }

    override fun onSocketConnected() {
        Log.d(TAG, "onSocketConnected")
        sendEvent("socketConnected", true)
    }

    override fun onSocketRegistered(userId: String, userType: String) {
        Log.d(TAG, "onSocketRegistered: $userId ($userType)")
        val map = Arguments.createMap().apply {
            putString("userId", userId)
            putString("userType", userType)
        }
        sendEvent("socketRegistered", map)
    }

    override fun onError(errorMessage: String) {
        Log.e(TAG, "onError: $errorMessage")
        sendEvent("socketError", errorMessage)
        sendEvent("onError", errorMessage)
    }

    @ReactMethod
    fun triggerLocationUpdate() {
        service?.triggerLocationUpdate()
    }

    override fun onLocationUpdate(latitude: Double, longitude: Double, speed: Float, heading: Float, accuracy: Float, timestamp: Long) {
        val map = Arguments.createMap().apply {
            putDouble("latitude", latitude)
            putDouble("longitude", longitude)
            putDouble("speed", speed.toDouble())
            putDouble("heading", heading.toDouble())
            putDouble("accuracy", accuracy.toDouble())
            putDouble("timestamp", timestamp.toDouble())
        }
        sendEvent("onLocationUpdate", map)
        sendEvent("driverLocation", map)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep React Native event emitter happy
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep React Native event emitter happy
    }
}
