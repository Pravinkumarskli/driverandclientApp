import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import CallSoundService from "../services/CallSoundService";
import NativeSocketService from "../services/NativeSocketService";

export default function CustomerCallScreen({ route, navigation }) {
  const {
    userId = "customer_101",
    receiverId = "driver_201",
    receiverName = "Driver",
  } = route.params || {};

  const [callStatus, setCallStatus] = useState("Calling...");
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const ringingTimeoutRef = useRef(null);

  const RINGING_TIMEOUT_MS = 40000; // 40 seconds auto-cut

  useEffect(() => {
    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();
  }, []);

  // Pulse animation for avatar while ringing
  useEffect(() => {
    if (!connected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [connected, pulseAnim]);

  // Call timer once connected
  useEffect(() => {
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

    const startCall = async () => {
      try {
        setCallStatus("Requesting microphone...");
        const hasMic = await requestMicrophonePermission();
        if (!hasMic) {
          Alert.alert("Permission Required", "Microphone access is needed for voice calls.");
          navigation.goBack();
          return;
        }

        setCallStatus("Connecting to " + receiverName + "...");

        // 1. Create WebRTC PeerConnection
        await WebRTCService.createPeerConnection(
          (candidate) => {
            console.log("📡 [CUSTOMER] Sending ICE Candidate to:", receiverId);
            SocketService.sendIceCandidate({
              senderId: userId,
              receiverId: receiverId,
              candidate: candidate,
            });
          },
          (remoteStream) => {
            console.log("🎤 [CUSTOMER] Remote audio stream received!");
            if (isMounted) {
              setConnected(true);
              setCallStatus("Connected");
            }
          },
        );

        // 2. Get local audio
        await WebRTCService.getLocalAudio();

        // 3. Create Offer
        const offer = await WebRTCService.createOffer();

        // 4. Send Call Signaling to Driver
        SocketService.callUser(userId, receiverId, "Customer", offer);
        SocketService.sendOffer({
          senderId: userId,
          receiverId: receiverId,
          offer: offer,
        });

        // 5. Start Outgoing Ringback Tone
        try {
          CallSoundService.startOutgoingRingback();
        } catch (_) {}

        setCallStatus("Ringing...");

        // ── 40s Auto-Cut Timer ──────────────────────────────────
        ringingTimeoutRef.current = setTimeout(() => {
          if (isMounted && !connected) {
            console.log("⏱️ [CUSTOMER] 40s ringing timeout — auto-cutting call");
            CallSoundService.stopAll();
            setCallStatus("No Answer");
            SocketService.endCall({
              senderId: userId,
              receiverId: receiverId,
            });
            WebRTCService.close();
            setTimeout(() => {
              if (isMounted) navigation.goBack();
            }, 1500);
          }
        }, RINGING_TIMEOUT_MS);

        // 6. Listen for WebRTC Answer from Driver
        SocketService.onAnswer(async (data) => {
          console.log("✅ [CUSTOMER] Received Answer from Driver:", data?.senderId);
          try {
            CallSoundService.stopAll();
            if (ringingTimeoutRef.current) {
              clearTimeout(ringingTimeoutRef.current);
              ringingTimeoutRef.current = null;
            }
            if (data?.answer) {
              await WebRTCService.setRemoteDescription(data.answer);
            }
            if (isMounted) {
              setConnected(true);
              setCallStatus("Connected");
            }
          } catch (e) {
            console.warn("Error setting remote answer:", e);
          }
        });

        // 7. Listen for Call Accepted
        SocketService.onCallAccepted((data) => {
          console.log("✅ [CUSTOMER] Driver accepted call!");
          CallSoundService.stopAll();
          if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
          }
          if (isMounted) {
            setConnected(true);
            setCallStatus("Connected");
          }
        });

        const safeGoBack = () => {
          NativeSocketService.cancelCallNotification?.();
          NativeSocketService.clearInitialNotification?.();

          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate("CustomerHomeScreen");
          }
        };

        // 8. Listen for Call Rejected / Declined
        SocketService.onCallRejected(() => {
          console.log("❌ [CUSTOMER] Driver declined call");
          CallSoundService.stopAll();
          if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
          }
          if (isMounted) {
            setCallStatus("Call Declined");
            setTimeout(() => safeGoBack(), 1200);
          }
        });

        // 9. Listen for Call Ended
        SocketService.onCallEnded(() => {
          console.log("🛑 [CUSTOMER] Driver ended call");
          CallSoundService.stopAll();
          if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
          }
          if (isMounted) {
            setCallStatus("Call Ended");
            setTimeout(() => safeGoBack(), 800);
          }
        });

        // 10. Listen for ICE candidates
        SocketService.onIceCandidate(async (data) => {
          if (data?.candidate) {
            await WebRTCService.addIceCandidate(data.candidate);
          }
        });
      } catch (err) {
        console.error("CUSTOMER CALL START ERROR:", err);
        CallSoundService.stopAll();
        Alert.alert("Call Error", err?.message || "Failed to start call");
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate("CustomerHomeScreen");
        }
      }
    };

    startCall();

    return () => {
      isMounted = false;
      CallSoundService.stopAll();
      WebRTCService.close();
      SocketService.off("answer");
      SocketService.off("callAccepted");
      SocketService.off("callRejected");
      SocketService.off("callEnded");
      SocketService.off("iceCandidate");
    };
  }, [navigation, receiverId, receiverName, userId]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    WebRTCService.mute(next);
  };

  const handleToggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    WebRTCService.setSpeaker(next);
  };

  const handleEndCall = () => {
    CallSoundService.stopAll();
    SocketService.endCall({
      senderId: userId,
      receiverId: receiverId,
    });
    WebRTCService.close();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("CustomerHomeScreen");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Top Header */}
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>CAB CONNECT VOICE</Text>
        <Text style={styles.securityTag}>🔒 End-to-end encrypted</Text>
      </View>

      {/* Center Caller Info */}
      <View style={styles.centerSection}>
        <Animated.View
          style={[
            styles.avatarGlow,
            { transform: [{ scale: pulseAnim }] },
            connected && styles.avatarGlowConnected,
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {receiverName ? receiverName.charAt(0).toUpperCase() : "D"}
            </Text>
          </View>
        </Animated.View>

        <Text style={styles.receiverName}>{receiverName || "Driver"}</Text>
        <Text style={styles.receiverId}>Driver ID: {receiverId}</Text>

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
    backgroundColor: "#0B132B",
    justifyContent: "space-between",
  },
  topBar: {
    alignItems: "center",
    paddingTop: 24,
    gap: 4,
  },
  appTitle: {
    color: "#60A5FA",
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
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  avatarGlowConnected: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#3B82F6",
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "800",
  },
  receiverName: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },
  receiverId: {
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
    backgroundColor: "#3B82F6",
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
