import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import SocketService from "../services/SocketService";
import WebRTCService from "../services/WebRTCService";
import NativeSocketService from "../services/NativeSocketService";

export default function VoiceCallScreen({ route, navigation }) {
  const {
    callerId = "customer_101",
    callerName = "Customer",
    receiverId = "driver_201",
    offer = null,
  } = route.params || {};

  const [callStatus, setCallStatus] = useState("Connecting...");
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  const timerRef = useRef(null);

  // Call duration timer
  useEffect(() => {
    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();

    if (connected) {
      timerRef.current = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connected]);

  const formatTimer = (totalSeconds) => {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const requestMicrophonePermission = async () => {
    if (Platform.OS !== "android") return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.warn("MIC PERMISSION ERROR:", error);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();

    const setupVoiceCall = async () => {
      try {
        setCallStatus("Opening microphone...");
        const hasMic = await requestMicrophonePermission();
        if (!hasMic) {
          Alert.alert("Permission Required", "Microphone access is required for calls.");
          navigation.goBack();
          return;
        }

        // 1. Create PeerConnection
        WebRTCService.createPeerConnection(
          (candidate) => {
            console.log("📡 [DRIVER] Sending ICE Candidate to:", callerId);
            SocketService.sendIceCandidate({
              senderId: receiverId,
              receiverId: callerId,
              candidate: candidate,
            });
          },
          (remoteStream) => {
            console.log("🎤 [DRIVER] Remote audio stream received!");
            if (isMounted) {
              setConnected(true);
              setCallStatus("Connected");
            }
          },
        );

        // 2. Add local audio
        await WebRTCService.getLocalAudio();

        // 3. Handle Offer & Send Answer
        const handleReceivedOffer = async (incomingOffer) => {
          try {
            console.log("📡 [DRIVER] Processing Offer from caller:", callerId);
            await WebRTCService.setRemoteOffer(incomingOffer);
            const answer = await WebRTCService.createAnswer();
            console.log("📡 [DRIVER] Sending Answer to caller:", callerId);
            SocketService.sendAnswer({
              senderId: receiverId,
              receiverId: callerId,
              answer: answer,
            });

            // Also emit acceptCall
            SocketService.acceptCall(callerId, receiverId);

            if (isMounted) {
              setConnected(true);
              setCallStatus("Connected");
            }
          } catch (e) {
            console.warn("[DRIVER] Error answering offer:", e);
          }
        };

        if (offer) {
          await handleReceivedOffer(offer);
        } else {
          // Listen for incoming offer if not in route params
          SocketService.onOffer(async (data) => {
            if (data?.offer) {
              await handleReceivedOffer(data.offer);
            }
          });
        }

        // 4. Listen for ICE candidates from Customer
        SocketService.onIceCandidate(async (data) => {
          if (data?.candidate) {
            await WebRTCService.addIceCandidate(data.candidate);
          }
        });

        const safeGoBack = () => {
          NativeSocketService.cancelCallNotification?.();
          NativeSocketService.clearInitialNotification?.();

          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate("DriverHome");
          }
        };

        // 5. Listen for Call Ended from Customer
        SocketService.onCallEnded(() => {
          console.log("🛑 [DRIVER] Customer ended call");
          if (isMounted) {
            setCallStatus("Call Ended");
            setTimeout(() => safeGoBack(), 800);
          }
        });
      } catch (err) {
        console.error("[DRIVER] VOICE CALL ERROR:", err);
        Alert.alert("Call Error", err?.message || "Failed to connect call");
        NativeSocketService.cancelCallNotification?.();
        NativeSocketService.clearInitialNotification?.();

        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate("DriverHome");
        }
      }
    };

    setupVoiceCall();

    return () => {
      isMounted = false;
      WebRTCService.close();
      SocketService.off("offer");
      SocketService.off("iceCandidate");
      SocketService.off("callEnded");
      NativeSocketService.cancelCallNotification?.();
      NativeSocketService.clearInitialNotification?.();
    };
  }, [callerId, navigation, offer, receiverId]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    WebRTCService.setMuted(next);
  };

  const handleToggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    // Future inCallManager or audio manager speaker toggle
  };

  const handleEndCall = () => {
    console.log("🛑 [DRIVER] Ending call");
    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();

    SocketService.endCall({
      senderId: receiverId,
      receiverId: callerId,
    });
    WebRTCService.close();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("DriverHome");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1D" />

      {/* Top Header */}
      <View style={styles.topSection}>
        <Text style={styles.appTag}>CAB DISPATCH ACTIVE CALL</Text>
        <Text style={styles.securityTag}>🔒 End-to-end encrypted voice</Text>
      </View>

      {/* Center Section */}
      <View style={styles.centerSection}>
        <View style={[styles.avatarGlow, connected && styles.avatarGlowConnected]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {callerName ? callerName.charAt(0).toUpperCase() : "C"}
            </Text>
          </View>
        </View>

        <Text style={styles.callerName}>{callerName || "Customer"}</Text>
        <Text style={styles.callerId}>Rider ID: {callerId}</Text>

        <View style={styles.statusBadge}>
          <Text style={[styles.statusText, connected && styles.statusTextConnected]}>
            {connected ? `🎤 ${formatTimer(callSeconds)}` : callStatus}
          </Text>
        </View>
      </View>

      {/* WhatsApp Style Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.controlsRow}>
          {/* Mute Button */}
          <TouchableOpacity
            style={[styles.actionBtn, isMuted && styles.actionBtnActive]}
            onPress={handleToggleMute}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>{isMuted ? "🔇" : "🎤"}</Text>
            <Text style={styles.actionLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
          </TouchableOpacity>

          {/* Speaker Button */}
          <TouchableOpacity
            style={[styles.actionBtn, isSpeaker && styles.actionBtnActive]}
            onPress={handleToggleSpeaker}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>{isSpeaker ? "🔊" : "🔈"}</Text>
            <Text style={styles.actionLabel}>{isSpeaker ? "Speaker" : "Ear"}</Text>
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={handleEndCall}
            activeOpacity={0.8}
          >
            <Text style={styles.endCallIcon}>☎</Text>
            <Text style={styles.endCallLabel}>End</Text>
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
  },
  topSection: {
    alignItems: "center",
    paddingTop: 24,
    gap: 4,
  },
  appTag: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  securityTag: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  centerSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  avatarGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  avatarGlowConnected: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#38BDF8",
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "800",
  },
  callerName: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },
  callerId: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  statusBadge: {
    marginTop: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  statusText: {
    color: "#FBBF24",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusTextConnected: {
    color: "#34D399",
  },
  bottomControls: {
    paddingBottom: 48,
    paddingHorizontal: 30,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnActive: {
    backgroundColor: "#0284C7",
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    color: "#E2E8F0",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#DC2626",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  endCallIcon: {
    color: "#FFFFFF",
    fontSize: 28,
    transform: [{ rotate: "135deg" }],
  },
  endCallLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
});
