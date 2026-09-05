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
import NativeSocketService from "../services/NativeSocketService";

export default function DriverCallScreen({ route, navigation }) {
  const {
    userId = "driver_201",
    receiverId = "customer_101",
    receiverName = "Customer",
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

  // Pulse animation while ringing
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

  const safeGoBack = () => {
    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("DriverHome");
    }
  };

  const handleCallRejectionOrEnd = (statusText, delayMs = 1000) => {
    WebRTCService.close();

    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    setCallStatus(statusText);

    setTimeout(() => {
      safeGoBack();
    }, delayMs);
  };

  useEffect(() => {
    let isMounted = true;

    const startCall = async () => {
      try {
        // =====================================================
        // 1. MICROPHONE PERMISSION
        // =====================================================

        setCallStatus('Requesting microphone...');

        const hasMic = await requestMicrophonePermission();

        if (!hasMic) {
          Alert.alert(
            'Permission Required',
            'Microphone access is needed for voice calls.',
          );

          safeGoBack();
          return;
        }

        // =====================================================
        // 2. CONNECTING
        // =====================================================

        setCallStatus(`Connecting to ${receiverName}...`);

        // =====================================================
        // 3. CREATE PEER CONNECTION
        // =====================================================

        await WebRTCService.createPeerConnection(
          // ICE Candidate
          (candidate) => {
            console.log(
              '📡 [DRIVER] Sending ICE Candidate to:',
              receiverId,
            );

            SocketService.sendIceCandidate({
              senderId: userId,
              receiverId: receiverId,
              candidate: candidate,
            });
          },

          // Remote Stream
          (remoteStream) => {
            console.log(
              '🎤 [DRIVER] Remote audio stream received!',
            );

            if (isMounted) {
              setConnected(true);
              setCallStatus('Connected');

              // Clear ringing timeout
              if (ringingTimeoutRef.current) {
                clearTimeout(ringingTimeoutRef.current);
                ringingTimeoutRef.current = null;
              }
            }
          },
        );

        // =====================================================
        // 4. GET LOCAL AUDIO
        // =====================================================

        await WebRTCService.getLocalAudio();

        // =====================================================
        // 5. CREATE OFFER
        // =====================================================

        const offer = await WebRTCService.createOffer();

        console.log('📤 [DRIVER] Offer created');

        // =====================================================
        // 6. SEND CALL TO CUSTOMER
        // =====================================================

        SocketService.callUser(
          userId,
          receiverId,
          'Driver',
          offer,
        );

        SocketService.sendOffer({
          senderId: userId,
          receiverId: receiverId,
          offer: offer,
        });

        if (isMounted) {
          setCallStatus('Ringing...');
        }

        // =====================================================
        // 7. 40 SECOND RINGING TIMEOUT
        // =====================================================

        ringingTimeoutRef.current = setTimeout(() => {
          if (!isMounted) {
            return;
          }

          if (!connected) {
            console.log(
              '⏱️ [DRIVER] 40s ringing timeout — auto-cutting call',
            );

            setCallStatus('No Answer');

            // Stop WebRTC
            WebRTCService.close();

            // Tell customer that call ended
            SocketService.endCall?.({
              senderId: userId,
              receiverId: receiverId,
            });

            setTimeout(() => {
              if (isMounted) {
                safeGoBack();
              }
            }, 1200);
          }
        }, RINGING_TIMEOUT_MS);

        // =====================================================
        // 8. REMOTE ANSWER
        // =====================================================

        SocketService.onAnswer(async (data) => {
          console.log(
            '📥 [DRIVER] Received answer from Customer:',
            data,
          );

          try {
            if (!data?.answer) {
              console.warn(
                '⚠️ [DRIVER] Answer not found',
              );
              return;
            }

            await WebRTCService.setRemoteAnswer(
              data.answer,
            );

            // Clear ringing timeout
            if (ringingTimeoutRef.current) {
              clearTimeout(ringingTimeoutRef.current);
              ringingTimeoutRef.current = null;
            }

            if (isMounted) {
              setConnected(true);
              setCallStatus('Connected');
            }
          } catch (error) {
            console.warn(
              '❌ Error setting remote answer:',
              error,
            );
          }
        });

        // =====================================================
        // 9. CALL ACCEPTED
        // =====================================================

        SocketService.onCallAccepted(() => {
          console.log(
            '✅ [DRIVER] Customer accepted call!',
          );

          if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
          }

          if (isMounted) {
            setConnected(true);
            setCallStatus('Connected');
          }
        });

        // =====================================================
        // 10. CALL REJECTED
        // =====================================================

        SocketService.onCallRejected(() => {
          console.log(
            '❌ [DRIVER] Customer declined call',
          );

          if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
          }

          handleCallRejectionOrEnd(
            'Call Declined',
            1200,
          );
        });

        // =====================================================
        // 11. CALL ENDED
        // =====================================================

        SocketService.onCallEnded(() => {
          console.log(
            '🛑 [DRIVER] Customer ended call',
          );

          if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
          }

          handleCallRejectionOrEnd(
            'Call Ended',
            800,
          );
        });

        // =====================================================
        // 12. ICE CANDIDATE
        // =====================================================

        SocketService.onIceCandidate(async (data) => {
          try {
            if (!data?.candidate) {
              return;
            }

            console.log(
              '📥 [DRIVER] Received ICE candidate',
            );

            await WebRTCService.addIceCandidate(
              data.candidate,
            );
          } catch (error) {
            console.warn(
              '❌ Error adding ICE candidate:',
              error,
            );
          }
        });
      } catch (err) {
        console.error(
          '❌ DRIVER CALL START ERROR:',
          err,
        );

        if (isMounted) {
          Alert.alert(
            'Call Error',
            err?.message || 'Failed to start call',
          );
        }

        safeGoBack();
      }
    };

    // =====================================================
    // START CALL
    // =====================================================

    startCall();

    // =====================================================
    // CLEANUP
    // =====================================================

    return () => {
      console.log(
        '🧹 [DRIVER] Call screen cleanup',
      );

      isMounted = false;

      // Clear 40 sec timer
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }

      // Close WebRTC
      WebRTCService.close();

      // Remove socket listeners
      SocketService.off('answer');
      SocketService.off('callAccepted');
      SocketService.off('callRejected');
      SocketService.off('callEnded');
      SocketService.off('iceCandidate');
    };
  }, [
    navigation,
    receiverId,
    receiverName,
    userId,
  ]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    WebRTCService.setMuted(next);
  };

  const handleToggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
  };

  const handleEndCall = () => {
    SocketService.endCall({
      senderId: userId,
      receiverId: receiverId,
    });
    WebRTCService.close();
    safeGoBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Top Header */}
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>CAB DRIVER VOICE</Text>
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
              {receiverName ? receiverName.charAt(0).toUpperCase() : "C"}
            </Text>
          </View>
        </Animated.View>

        <Text style={styles.receiverName}>{receiverName || "Customer"}</Text>
        <Text style={styles.receiverId}>Rider ID: {receiverId}</Text>

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
    backgroundColor: "rgba(14, 165, 233, 0.2)",
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
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#0284C7",
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
