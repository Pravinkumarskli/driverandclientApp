import React, { useEffect, useRef, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Easing,
} from "react-native";

import WebRTCService from "../services/WebRTCService";
import SocketService from "../services/SocketService";
import CallSoundService from "../services/CallSoundService";
import NativeSocketService from "../services/NativeSocketService";

export default function CustomerIncomingCallScreen({ route, navigation }) {
  const {
    callerId = "driver_201",
    receiverId = "customer_101",
    receiverName = "Driver",
    offer = null,
  } = route.params || {};

  const [accepting, setAccepting] = useState(false);
  const [status, setStatus] = useState("Incoming voice call...");
  const autoRejectTimerRef = useRef(null);

  const AUTO_REJECT_TIMEOUT_MS = 40000; // 40 seconds auto-reject
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    NativeSocketService.setActiveScreen("CustomerIncomingCall", callerId, null);
    NativeSocketService.cancelCallNotification?.();
    NativeSocketService.clearInitialNotification?.();

    if (route.params?.autoAnswer === true) {
      console.log("⚡ [CLIENT] Auto-answering incoming call from notification action");
      acceptCall();
    }

    return () => {
      NativeSocketService.setActiveScreen(null, null, null);
    };
  }, [callerId]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, []);

  const acceptCall = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      NativeSocketService.cancelCallNotification?.();
      NativeSocketService.clearInitialNotification?.();

      // Clear auto-reject timer on accept
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
        autoRejectTimerRef.current = null;
      }
      CallSoundService.stopAll();

      console.log("================================");
      console.log("DRIVER ACCEPT CALL");
      console.log("callerId:", callerId);
      console.log("offer:", JSON.stringify(offer));
      console.log("================================");

      setStatus("Connecting...");

      // Notify the caller before negotiating media. The caller's UI listens for
      // this event and otherwise remains stuck on "Calling".
      SocketService.acceptCall({
        callerId,
        senderId: receiverId,
        receiverId: callerId,
      });

      await WebRTCService.createPeerConnection(
        (candidate) => {
          console.log("CUSTOMER SEND ICE");
          SocketService.sendIceCandidate({
            senderId: receiverId,
            receiverId: callerId,
            candidate: candidate,
          });
        },
        (remoteStream) => {
          console.log("CUSTOMER REMOTE AUDIO RECEIVED");
          setConnected(true);
          setCallStatus("Connected");
        },
      );

      setCallStatus("Opening microphone...");
      await WebRTCService.getLocalAudio();

      setCallStatus("Creating answer...");
      console.log("CUSTOMER OFFER:", offer);

      let parsedOffer = offer;
      if (typeof offer === "string" && offer.trim().length > 0) {
        try {
          parsedOffer = JSON.parse(offer);
        } catch (e) {
          parsedOffer = offer;
        }
      }

      const answer = await WebRTCService.createAnswer(parsedOffer);
      console.log("DRIVER ANSWER:", answer);

      SocketService.sendAnswer({
        senderId: receiverId,
        receiverId: callerId,
        answer: answer,
      });

      console.log("DRIVER ANSWER SENT");
      setStatus("Connected");

      navigation.replace("CustomerAnswerCallScreen", {
        callerId: callerId,
        callerName: receiverName,
        userId: receiverId,
      });
    } catch (error) {
      console.log("CUSTOMER ACCEPT CALL ERROR:", error);
      setStatus("Call failed");
      setAccepting(false);
      Alert.alert("Call Error", error?.message || "Unable to accept call");
    }
  };

  const rejectCall = () => {
    console.log("CUSTOMER DECLINE CALL");

    try {
      NativeSocketService.cancelCallNotification?.();
      NativeSocketService.clearInitialNotification?.();

      // Clear auto-reject timer on manual decline
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
        autoRejectTimerRef.current = null;
      }
      CallSoundService.stopAll();

      SocketService.rejectCall(callerId, receiverId);
      SocketService.endCall({
        senderId: receiverId,
        receiverId: callerId,
      });
    } catch (error) {
      console.log("DECLINE ERROR:", error);
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("CustomerHomeScreen");
    }
  };

  useEffect(() => {
    const safeGoBack = () => {
      NativeSocketService.cancelCallNotification?.();
      NativeSocketService.clearInitialNotification?.();

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("CustomerHomeScreen");
      }
    };

    CallSoundService.startIncomingRingtone();

    // If caller cancels or ends call while ringing
    const handleCallEnded = () => {
      console.log("🛑 Caller ended / cancelled incoming call");
      CallSoundService.stopAll();
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
        autoRejectTimerRef.current = null;
      }
      safeGoBack();
    };

    SocketService.onCallEnded(handleCallEnded);

    // Auto-reject after 40 seconds if not answered
    autoRejectTimerRef.current = setTimeout(() => {
      console.log("⏱️ [CLIENT] 40s incoming call timeout — auto-rejecting");
      try {
        CallSoundService.stopAll();
        SocketService.rejectCall(callerId, receiverId);
        SocketService.endCall({
          senderId: receiverId,
          receiverId: callerId,
        });
      } catch (error) {
        console.log("AUTO-REJECT ERROR:", error);
      }
      safeGoBack();
    }, AUTO_REJECT_TIMEOUT_MS);

    return () => {
      CallSoundService.stopAll();
      SocketService.off("callEnded", handleCallEnded);
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
        autoRejectTimerRef.current = null;
      }
    };
  }, [callerId, receiverId, navigation]);

  const firstLetter = receiverName ? receiverName.charAt(0).toUpperCase() : "D";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incoming Call</Text>

      <Text style={styles.subtitle}>Driver is calling you</Text>

      <View style={styles.avatarArea}>
        <Animated.View
          style={[
            styles.ring,
            {
              transform: [
                {
                  scale: pulse,
                },
              ],
            },
          ]}
        />

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstLetter}</Text>
        </View>
      </View>

      <Text style={styles.name}>{receiverName || "Driver"}</Text>

      <Text style={styles.id}>{callerId || ""}</Text>

      <Text style={styles.calling}>📞 Incoming voice call</Text>

      <View style={styles.buttons}>
        <View style={styles.buttonBox}>
          <TouchableOpacity style={styles.decline} onPress={rejectCall}>
            <Text style={styles.phone}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.buttonText}>Decline</Text>
        </View>

        <View style={styles.buttonBox}>
          <TouchableOpacity
            style={[styles.accept, accepting && styles.acceptDisabled]}
            onPress={acceptCall}
            disabled={accepting}
          >
            <Text style={styles.phone}>✓</Text>
          </TouchableOpacity>

          <Text style={styles.buttonText}>Accept</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    paddingTop: 70,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },

  subtitle: {
    color: "#aaa",
    fontSize: 15,
    marginTop: 8,
  },

  avatarArea: {
    width: 190,
    height: 190,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 55,
  },

  ring: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: "#777",
  },

  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#fff",
    fontSize: 55,
    fontWeight: "bold",
  },

  name: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
    marginTop: 25,
  },

  id: {
    color: "#999",
    fontSize: 14,
    marginTop: 8,
  },

  calling: {
    color: "#ccc",
    fontSize: 16,
    marginTop: 18,
  },

  buttons: {
    position: "absolute",
    bottom: 65,
    width: "70%",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  buttonBox: {
    alignItems: "center",
  },

  accept: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
  },

  acceptDisabled: {
    opacity: 0.55,
  },

  decline: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },

  phone: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },

  buttonText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 15,
  },
});
