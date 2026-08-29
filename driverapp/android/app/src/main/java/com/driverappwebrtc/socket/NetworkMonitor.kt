package com.driverappwebrtc.socket

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper
import android.util.Log

class NetworkMonitor(
    private val context: Context,
    private val listener: NetworkStatusListener
) {
    companion object {
        private const val TAG = "NetworkMonitor_Driver"
    }

    interface NetworkStatusListener {
        fun onNetworkAvailable()
        fun onNetworkLost()
    }

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private var isRegistered = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            Log.d(TAG, "🌐 Network is available with active internet capability")
            mainHandler.post {
                listener.onNetworkAvailable()
            }
        }

        override fun onLost(network: Network) {
            Log.w(TAG, "⚠️ Network connection lost")
            mainHandler.post {
                listener.onNetworkLost()
            }
        }
    }

    fun startMonitoring() {
        if (isRegistered || connectivityManager == null) return
        try {
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            connectivityManager.registerNetworkCallback(request, networkCallback)
            isRegistered = true
            Log.d(TAG, "Driver network monitoring started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register driver network callback: ${e.message}", e)
        }
    }

    fun stopMonitoring() {
        if (!isRegistered || connectivityManager == null) return
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
            isRegistered = false
            Log.d(TAG, "Driver network monitoring stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unregister driver network callback: ${e.message}", e)
        }
    }

    fun isOnline(): Boolean {
        return try {
            val activeNetwork = connectivityManager?.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (e: Exception) {
            false
        }
    }
}
