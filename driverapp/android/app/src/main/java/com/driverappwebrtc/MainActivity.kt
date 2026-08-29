package com.driverappwebrtc

import android.content.Intent
import android.os.Bundle
import com.driverappwebrtc.socket.NativeSocketModule
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "DriverAppWebRTC"

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
    if (intent?.getStringExtra("action") == "OPEN_CHAT") {
      val senderId = intent.getStringExtra("senderId") ?: return
      val receiverName = intent.getStringExtra("receiverName") ?: "Customer"
      val conversationId = intent.getStringExtra("conversationId") ?: ""
      val userType = intent.getStringExtra("userType") ?: "client"
      val messageId = intent.getStringExtra("messageId") ?: ""

      val params = Arguments.createMap().apply {
        putString("senderId", senderId)
        putString("receiverId", senderId)
        putString("receiverName", receiverName)
        putString("conversationId", conversationId)
        putString("userType", userType)
        putString("messageId", messageId)
        putString("action", "OPEN_CHAT")
      }

      NativeSocketModule.initialNotificationData = params

      reactInstanceManager?.currentReactContext?.let { context ->
        if (context.hasActiveReactInstance()) {
          context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onNotificationOpened", params)
        }
      }
    }
  }
}
