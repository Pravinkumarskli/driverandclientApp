package com.customerappwebrtc

import android.content.Intent
import android.os.Bundle
import com.customerappwebrtc.socket.NativeSocketModule
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "CustomerAppWebRTC"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleNotificationIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleNotificationIntent(intent)
  }

  private fun handleNotificationIntent(intent: Intent?) {
    if (intent == null) return
    val action = intent.getStringExtra("action") ?: intent.action ?: return
    android.util.Log.d("MainActivity", "🔔 handleNotificationIntent: action=$action")

    if (action == "OPEN_CHAT" || action.contains("OPEN_CHAT")) {
      val senderId = intent.getStringExtra("senderId") ?: return
      val receiverName = intent.getStringExtra("receiverName") ?: "Driver"
      val conversationId = intent.getStringExtra("conversationId") ?: ""
      val userType = intent.getStringExtra("userType") ?: "driver"
      val messageId = intent.getStringExtra("messageId") ?: ""
      val message = intent.getStringExtra("message") ?: ""

      val map = mapOf(
        "senderId" to senderId,
        "receiverId" to senderId,
        "receiverName" to receiverName,
        "conversationId" to conversationId,
        "userType" to userType,
        "messageId" to messageId,
        "message" to message,
        "action" to "OPEN_CHAT"
      )

      NativeSocketModule.dispatchNotificationIntent(this, map)

      // Consume intent extras to prevent duplicate handling on app reopen
      intent.removeExtra("action")
      intent.removeExtra("senderId")
      intent.removeExtra("receiverId")
      intent.removeExtra("receiverName")
      intent.removeExtra("conversationId")
      intent.removeExtra("messageId")
      intent.removeExtra("message")
      intent.action = null
    } else if (action == "INCOMING_CALL" || action.contains("INCOMING_CALL") || action.contains("ANSWER_CALL")) {
      val callerId = intent.getStringExtra("callerId") ?: intent.getStringExtra("senderId") ?: "Driver"
      val callerName = intent.getStringExtra("callerName") ?: intent.getStringExtra("receiverName") ?: "Driver"
      val userType = intent.getStringExtra("userType") ?: "driver"
      val offer = intent.getStringExtra("offer") ?: ""
      val autoAnswer = intent.getBooleanExtra("autoAnswer", false) || action.contains("ANSWER_CALL")

      val map = mapOf(
        "callerId" to callerId,
        "senderId" to callerId,
        "callerName" to callerName,
        "receiverName" to callerName,
        "userType" to userType,
        "offer" to offer,
        "autoAnswer" to autoAnswer,
        "action" to "INCOMING_CALL"
      )

      NativeSocketModule.dispatchNotificationIntent(this, map)

      // Consume intent extras to prevent duplicate handling on app reopen
      intent.removeExtra("action")
      intent.removeExtra("callerId")
      intent.removeExtra("senderId")
      intent.removeExtra("callerName")
      intent.removeExtra("receiverName")
      intent.removeExtra("offer")
      intent.removeExtra("autoAnswer")
      intent.action = null
    }
  }
}
