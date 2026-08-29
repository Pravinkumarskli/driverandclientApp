package com.customerappwebrtc.socket

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.*
import org.json.JSONObject
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random

class NativeWebSocketManager(
    private val context: Context,
    private val listener: SocketEventListener
) : NetworkMonitor.NetworkStatusListener {

    companion object {
        private const val TAG = "NativeWSManager_Client"
        private const val PING_INTERVAL_MS = 25000L
        private const val BASE_RECONNECT_DELAY_MS = 1000L
        private const val MAX_RECONNECT_DELAY_MS = 30000L
        private const val DEDUPLICATION_CACHE_SIZE = 500
    }

    interface SocketEventListener {
        fun onMessageReceived(messageJson: String)
        fun onConnectionStateChanged(state: String)
        fun onSocketConnected()
        fun onSocketRegistered(userId: String, userType: String)
        fun onError(errorMessage: String)
    }

    private var client: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(PING_INTERVAL_MS, TimeUnit.MILLISECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private var webSocket: WebSocket? = null
    private var serverUrl: String = ""
    private var userId: String = ""
    private var userType: String = "client"

    private var isManualDisconnect = false
    private var isConnected = false
    private var isRegistered = false
    private var reconnectAttempts = 0

    private val mainHandler = Handler(Looper.getMainLooper())
    private val outgoingQueue = ConcurrentLinkedQueue<String>()
    private val processedMessageIds = Collections.newSetFromMap(ConcurrentHashMap<String, Boolean>())
    private val networkMonitor = NetworkMonitor(context, this)

    init {
        networkMonitor.startMonitoring()
    }

    fun start(url: String, uid: String, type: String) {
        this.serverUrl = url
        this.userId = uid
        this.userType = type
        this.isManualDisconnect = false
        this.reconnectAttempts = 0
        connect()
    }

    fun stop() {
        isManualDisconnect = true
        isRegistered = false
        isConnected = false
        mainHandler.removeCallbacksAndMessages(null)
        try {
            webSocket?.close(1000, "Client explicit disconnect")
        } catch (e: Exception) {
            Log.e(TAG, "Error closing websocket: ${e.message}")
        }
        webSocket = null
        listener.onConnectionStateChanged("DISCONNECTED")
    }

    @Synchronized
    private fun connect() {
        if (isConnected || serverUrl.isEmpty() || isManualDisconnect) return

        listener.onConnectionStateChanged("CONNECTING")

        val request = try {
            Request.Builder().url(serverUrl).build()
        } catch (e: Exception) {
            Log.e(TAG, "Invalid server URL: $serverUrl", e)
            listener.onError("Invalid server URL: ${e.message}")
            listener.onConnectionStateChanged("DISCONNECTED")
            return
        }

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.d(TAG, "⚡ Native WebSocket Opened with server. Registering userId: $userId ($userType)")
                isConnected = true
                reconnectAttempts = 0

                mainHandler.post {
                    listener.onSocketConnected()
                    listener.onConnectionStateChanged("CONNECTED")
                }

                // Send authentication / registration payload immediately
                val authPayload = JSONObject().apply {
                    put("type", "register")
                    put("userId", userId)
                    put("userType", userType)
                    put("timestamp", System.currentTimeMillis())
                }
                ws.send(authPayload.toString())
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closing code: $code, reason: $reason")
                ws.close(1000, null)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket Closed: $code / $reason")
                isConnected = false
                isRegistered = false
                mainHandler.post {
                    listener.onConnectionStateChanged("DISCONNECTED")
                    if (!isManualDisconnect) {
                        scheduleReconnect()
                    }
                }
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket Failure: ${t.message}", t)
                isConnected = false
                isRegistered = false
                mainHandler.post {
                    listener.onError(t.message ?: "Connection error")
                    listener.onConnectionStateChanged("DISCONNECTED")
                    if (!isManualDisconnect) {
                        scheduleReconnect()
                    }
                }
            }
        })
    }

    private fun handleIncomingMessage(rawJson: String) {
        try {
            val json = JSONObject(rawJson)
            val eventType = json.optString("type", "")

            // 1. Heartbeat Ping / Pong
            if (eventType == "ping") {
                val pong = JSONObject().apply {
                    put("type", "pong")
                    put("timestamp", System.currentTimeMillis())
                }
                webSocket?.send(pong.toString())
                return
            }

            // 2. Registration Confirmation
            if (eventType == "registerSuccess") {
                val registeredUid = json.optString("userId", userId)
                val registeredType = json.optString("userType", userType)
                Log.d(TAG, "👤 Registration confirmed by server for $registeredUid ($registeredType)")
                isRegistered = true

                mainHandler.post {
                    listener.onSocketRegistered(registeredUid, registeredType)
                }

                // Flush queued outgoing messages now that we are registered
                flushOutgoingQueue()
                return
            }

            // 3. Duplicate Message Prevention
            val messageId = json.optString("messageId", json.optString("id", ""))
            if (messageId.isNotEmpty()) {
                if (processedMessageIds.contains(messageId)) {
                    Log.d(TAG, "Duplicate message ignored: $messageId")
                    return
                }
                if (processedMessageIds.size > DEDUPLICATION_CACHE_SIZE) {
                    processedMessageIds.clear()
                }
                processedMessageIds.add(messageId)
            }

            // 4. Deliver message to listener
            mainHandler.post {
                listener.onMessageReceived(rawJson)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing incoming message JSON: ${e.message}", e)
        }
    }

    fun sendMessage(messageJsonString: String): Boolean {
        if (!isConnected || !isRegistered || webSocket == null) {
            Log.w(TAG, "WebSocket is not yet connected/registered. Queuing message for delivery.")
            outgoingQueue.add(messageJsonString)
            return false
        }
        return try {
            val sent = webSocket?.send(messageJsonString) ?: false
            if (!sent) {
                outgoingQueue.add(messageJsonString)
            }
            sent
        } catch (e: Exception) {
            Log.e(TAG, "Send message error: ${e.message}", e)
            outgoingQueue.add(messageJsonString)
            false
        }
    }

    private fun flushOutgoingQueue() {
        if (!isConnected || !isRegistered || webSocket == null) return
        while (!outgoingQueue.isEmpty()) {
            val nextMsg = outgoingQueue.poll() ?: break
            Log.d(TAG, "Flushing queued message: $nextMsg")
            try {
                webSocket?.send(nextMsg)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to flush message from queue: ${e.message}", e)
                outgoingQueue.add(nextMsg)
                break
            }
        }
    }

    fun isConnected(): Boolean = isConnected && isRegistered

    private fun scheduleReconnect() {
        if (isManualDisconnect) return

        reconnectAttempts++
        val exponentialDelay = (BASE_RECONNECT_DELAY_MS * (2.0.pow(min(reconnectAttempts, 6).toDouble()))).toLong()
        val jitter = Random.nextLong(100, 1000)
        val delay = min(exponentialDelay + jitter, MAX_RECONNECT_DELAY_MS)

        Log.d(TAG, "Scheduling reconnect attempt #$reconnectAttempts in ${delay}ms")
        mainHandler.removeCallbacksAndMessages(null)
        mainHandler.postDelayed({
            if (!isManualDisconnect && !isConnected) {
                reconnect()
            }
        }, delay)
    }

    private fun reconnect() {
        if (isConnected) return
        try {
            webSocket?.cancel()
        } catch (e: Exception) {
            // Ignored
        }
        webSocket = null
        connect()
    }

    // NetworkMonitor Callbacks
    override fun onNetworkAvailable() {
        Log.d(TAG, "🌐 Network available. Checking socket status (connected: $isConnected)")
        if (!isConnected && !isManualDisconnect && serverUrl.isNotEmpty()) {
            mainHandler.post { reconnect() }
        }
    }

    override fun onNetworkLost() {
        Log.w(TAG, "⚠️ Network lost. Marking socket as disconnected.")
        isConnected = false
        isRegistered = false
        listener.onConnectionStateChanged("DISCONNECTED")
    }

    fun cleanup() {
        networkMonitor.stopMonitoring()
        stop()
    }
}
