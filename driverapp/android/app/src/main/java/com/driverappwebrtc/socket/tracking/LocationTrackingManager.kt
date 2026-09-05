package com.driverappwebrtc.socket.tracking

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * LocationTrackingManager — Reusable Android GPS & Network Location Tracker.
 * Manages periodic updates, permissions, and callbacks.
 */
class LocationTrackingManager(
    private val context: Context,
    private val onLocationChangedCallback: (Location) -> Unit
) {

    companion object {
        private const val TAG = "LocationTrackingManager"
        const val LOCATION_UPDATE_INTERVAL_MS = 3000L
        const val LOCATION_MIN_DISTANCE_M = 0f
    }

    private var locationManager: LocationManager? =
        context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    var isTrackingStarted: Boolean = false
        private set

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            onLocationChangedCallback(location)
        }

        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {
            Log.d(TAG, "Location provider enabled: $provider")
        }
        override fun onProviderDisabled(provider: String) {
            Log.w(TAG, "Location provider disabled: $provider")
        }
    }

    fun startTracking(): Boolean {
        if (isTrackingStarted) return true

        val fineGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted && !coarseGranted) {
            Log.w(TAG, "⚠️ Location permissions not granted yet.")
            return false
        }

        val lm = locationManager ?: return false

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
                Log.d(TAG, "🛰️ GPS_PROVIDER requested")
            }

            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    LOCATION_UPDATE_INTERVAL_MS,
                    LOCATION_MIN_DISTANCE_M,
                    locationListener
                )
                requestedAny = true
                Log.d(TAG, "📶 NETWORK_PROVIDER requested")
            }

            if (requestedAny) {
                isTrackingStarted = true
                val lastGps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                val lastNet = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                val lastLoc = lastGps ?: lastNet
                if (lastLoc != null) {
                    onLocationChangedCallback(lastLoc)
                }
            }
            return requestedAny
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting location updates: ${e.message}", e)
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Exception starting location updates: ${e.message}", e)
            return false
        }
    }

    fun stopTracking() {
        if (!isTrackingStarted) return
        try {
            locationManager?.removeUpdates(locationListener)
            isTrackingStarted = false
            Log.d(TAG, "Location tracking stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping location tracking: ${e.message}", e)
        }
    }
}
