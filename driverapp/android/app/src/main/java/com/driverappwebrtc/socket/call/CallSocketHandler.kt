package com.driverappwebrtc.socket.call

import android.util.Log
import com.driverappwebrtc.socket.notifications.CallNotificationManager
import org.json.JSONObject

/**
 * CallSocketHandler — Reusable Handler for WebRTC voice calling signals,
 * ringtone notifications, and ongoing call suppression.
 */
class CallSocketHandler(private val callNotificationManager: CallNotificationManager) {

    companion object {
        private const val TAG = "CallSocketHandler"
    }

    fun handleIncomingCallEvent(
        json: JSONObject,
        isAppInForeground: Boolean,
        currentActiveScreen: String?
    ): Boolean {
        val eventType = json.optString("type", "")

        if (eventType == "incomingCall" || eventType == "callUser") {
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
                callNotificationManager.showIncomingCallNotification(
                    callerId = callerId,
                    callerName = callerName,
                    userType = userType,
                    offerJson = offerJson
                )
            } else {
                Log.d(TAG, "Suppressed incoming call notification: driver is already on connected call ($currentActiveScreen)")
            }
            return true
        } else if (eventType == "endCall" || eventType == "callEnded" || eventType == "callRejected") {
            callNotificationManager.cancelCallNotification()
            return true
        }

        return false
    }

    fun cancelCallNotification() {
        callNotificationManager.cancelCallNotification()
    }
}
