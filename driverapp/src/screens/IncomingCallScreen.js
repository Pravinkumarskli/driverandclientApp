import React, { useEffect, useRef } from "react";
import {
  Animated,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import SocketService from "../services/SocketService";
import NativeSocketService from "../services/NativeSocketService";

export default function IncomingCallScreen({ route, navigation }) {
  const {
    callerId = "customer_101",
    callerName = "Customer",
    receiverId = "driver_201",
    offer = null,
    callType = "voice",
  } = route.params || {};

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const autoRejectTimerRef = useRef(null);

  const AUTO_REJECT_TIMEOUT_MS = 40000; // 40 seconds auto-reject

  useEffect(() => {
    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();

    if (route.params?.autoAnswer === true) {
      console.log("⚡ [DRIVER] Auto-answering incoming call from notification action");
      handleAccept();
    }
  }, []);

  useEffect(() => {
    // Pulsating animation for incoming ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    const safeGoBack = () => {
      NativeSocketService.cancelCallNotification?.();
      NativeSocketService.clearInitialNotification?.();

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("DriverHome");
      }
    };

    // If caller cancels or ends call while ringing
    const handleCallEnded = () => {
      console.log("🛑 Caller cancelled incoming call");
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
        autoRejectTimerRef.current = null;
      }
      safeGoBack();
    };

    SocketService.onCallEnded(handleCallEnded);

    autoRejectTimerRef.current = setTimeout(() => {
      console.log("⏱️ [DRIVER] 40s incoming call timeout — auto-rejecting");
      SocketService.rejectCall(callerId, receiverId);
      SocketService.endCall({
        senderId: receiverId,
        receiverId: callerId,
      });
      safeGoBack();
    }, AUTO_REJECT_TIMEOUT_MS);

    return () => {
      SocketService.off("callEnded", handleCallEnded);
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
        autoRejectTimerRef.current = null;
      }
    };
  }, [navigation, pulseAnim, callerId, receiverId]);

  const handleAccept = () => {
    console.log("📞 [DRIVER ACCEPT CALL] Accepting call from:", callerId);
    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();

    if (autoRejectTimerRef.current) {
      clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = null;
    }
    navigation.replace("VoiceCallScreen", {
      callerId,
      callerName,
      receiverId,
      offer,
      callType,
    });
  };

  const handleDecline = () => {
    console.log("❌ [DRIVER DECLINE CALL] Declining call from:", callerId);
    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();

    if (autoRejectTimerRef.current) {
      clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = null;
    }
    SocketService.rejectCall(callerId, receiverId);
    SocketService.endCall({
      senderId: receiverId,
      receiverId: callerId,
    });
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("DriverHome");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1D" />

      {/* Top Banner */}
      <View style={styles.topSection}>
        <Text style={styles.appTag}>CAB DISPATCH VOICE</Text>
        <Text style={styles.incomingLabel}>Incoming Voice Call...</Text>
      </View>

      {/* Center Caller Profile */}
      <View style={styles.centerSection}>
        <Animated.View
          style={[styles.avatarGlow, { transform: [{ scale: pulseAnim }] }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {callerName ? callerName.charAt(0).toUpperCase() : "C"}
            </Text>
          </View>
        </Animated.View>

        <Text style={styles.callerName}>{callerName || "Customer"}</Text>
        <Text style={styles.callerId}>Rider ID: {callerId}</Text>
        <Text style={styles.callTypeLabel}>WhatsApp-Style HD Audio</Text>
      </View>

      {/* WhatsApp Style Accept / Decline Buttons */}
      <View style={styles.bottomSection}>
        <View style={styles.buttonRow}>
          {/* Decline Button (Red) */}
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={handleDecline}
            activeOpacity={0.8}
          >
            <Text style={styles.btnIcon}>✕</Text>
            <Text style={styles.btnText}>Decline</Text>
          </TouchableOpacity>

          {/* Accept Button (Green) */}
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={handleAccept}
            activeOpacity={0.8}
          >
            <Text style={styles.btnIcon}>☎</Text>
            <Text style={styles.btnText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1D",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  topSection: {
    alignItems: "center",
    paddingTop: 36,
  },
  appTag: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  incomingLabel: {
    color: "#E2E8F0",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  centerSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGlow: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#22C55E",
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 52,
    fontWeight: "800",
  },
  callerName: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  callerId: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 4,
    fontFamily: "monospace",
  },
  callTypeLabel: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    letterSpacing: 0.5,
  },
  bottomSection: {
    paddingBottom: 54,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  declineBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#DC2626",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  acceptBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#16A34A",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  btnIcon: {
    color: "#FFFFFF",
    fontSize: 28,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
});
