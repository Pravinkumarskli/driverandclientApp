import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";

import WebRTCService from "../services/WebRTCService";
import SocketService from "../services/SocketService";

const CustomerAnswerCallScreen = ({ route, navigation }) => {
  const { callerId, callerName, userId = "customer_101" } = route.params || {};

  const [status, setStatus] = useState("Connected");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  // -----------------------------
  // CALL TIMER
  // -----------------------------

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    const handleCallEnded = () => {
      console.log("🛑 Call ended by remote party");
      WebRTCService.close();
      navigation.goBack();
    };

    SocketService.onCallEnded(handleCallEnded);

    return () => {
      clearInterval(timer);
      SocketService.off("callEnded", handleCallEnded);
    };
  }, [navigation]);

  // -----------------------------
  // FORMAT DURATION
  // -----------------------------

  const formatDuration = () => {
    const minutes = Math.floor(seconds / 60);

    const secs = seconds % 60;

    return (
      String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0")
    );
  };

  // -----------------------------
  // MUTE
  // -----------------------------

  const toggleMute = () => {
    const newMuted = !muted;

    setMuted(newMuted);

    if (WebRTCService && WebRTCService.toggleMute) {
      WebRTCService.toggleMute(newMuted);
    }

    console.log("MIC MUTED:", newMuted);
  };

  // -----------------------------
  // SPEAKER
  // -----------------------------

  const toggleSpeaker = () => {
    const newSpeaker = !speaker;

    setSpeaker(newSpeaker);

    if (WebRTCService && WebRTCService.setSpeaker) {
      WebRTCService.setSpeaker(newSpeaker);
    }

    console.log("SPEAKER:", newSpeaker);
  };

  // -----------------------------
  // END CALL
  // -----------------------------

  const endCall = () => {
    Alert.alert("End Call", "Do you want to end this call?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "End",
        style: "destructive",
        onPress: async () => {
          try {
            SocketService.endCall({
              senderId: userId || SocketService.currentUserId || "customer_101",
              receiverId: callerId,
            });

            await WebRTCService.close();
          } catch (error) {
            console.log("END CALL ERROR:", error);
          }

          navigation.goBack();
        },
      },
    ]);
  };

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.title}>Voice Call</Text>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {callerName ? callerName.charAt(0).toUpperCase() : "C"}
          </Text>
        </View>

        <Text style={styles.name}>{callerName || callerId}</Text>

        <Text style={styles.status}>{status}</Text>

        <Text style={styles.duration}>{formatDuration()}</Text>
      </View>

      <View style={styles.controls}>
        {/* MUTE */}

        <TouchableOpacity
          style={[styles.controlButton, muted && styles.activeButton]}
          onPress={toggleMute}
        >
          <Text style={styles.icon}>{muted ? "🔇" : "🎙️"}</Text>

          <Text style={styles.controlText}>{muted ? "Unmute" : "Mute"}</Text>
        </TouchableOpacity>

        {/* SPEAKER */}

        <TouchableOpacity
          style={[styles.controlButton, speaker && styles.activeButton]}
          onPress={toggleSpeaker}
        >
          <Text style={styles.icon}>{speaker ? "🔊" : "🔈"}</Text>

          <Text style={styles.controlText}>Speaker</Text>
        </TouchableOpacity>
      </View>

      {/* END CALL */}

      <TouchableOpacity style={styles.endButton} onPress={endCall}>
        <Text style={styles.endIcon}>📞</Text>

        <Text style={styles.endText}>End Call</Text>
      </TouchableOpacity>
    </View>
  );
};

export default CustomerAnswerCallScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101114",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 60,
  },

  topSection: {
    alignItems: "center",
  },

  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 40,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "bold",
  },

  name: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "600",
  },

  status: {
    color: "#aaaaaa",
    fontSize: 16,
    marginTop: 10,
  },

  duration: {
    color: "#ffffff",
    fontSize: 22,
    marginTop: 10,
    fontWeight: "500",
  },

  controls: {
    flexDirection: "row",
    gap: 30,
  },

  controlButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#292b30",
    justifyContent: "center",
    alignItems: "center",
  },

  activeButton: {
    backgroundColor: "#55585f",
  },

  icon: {
    fontSize: 28,
  },

  controlText: {
    color: "#ffffff",
    fontSize: 12,
    marginTop: 5,
  },

  endButton: {
    width: 160,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#d32f2f",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  endIcon: {
    fontSize: 20,
  },

  endText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 2,
  },
});
