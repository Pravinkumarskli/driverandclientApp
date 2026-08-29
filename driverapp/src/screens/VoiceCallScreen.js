import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";

import SocketService from "../services/SocketService";

export default function VoiceCallScreen({ route, navigation }) {
  const { callerId, receiverId, callerName } = route.params || {};

  const [callStatus, setCallStatus] = useState("Connecting...");

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    console.log("Voice call screen");

    console.log("Caller:", callerId);

    console.log("Receiver:", receiverId);

    setCallStatus("Connecting...");

    // Customer receives this
    // after Driver accepts

    const handleCallAccepted = (data) => {
      console.log("Call accepted:", data);

      setCallStatus("Connected");
    };

    // Customer receives this
    // when Driver rejects

    const handleCallRejected = (data) => {
      console.log("Call rejected:", data);

      setCallStatus("Call declined");

      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    };

    SocketService.on("callAccepted", handleCallAccepted);

    SocketService.on("callRejected", handleCallRejected);

    return () => {
      SocketService.off("callAccepted", handleCallAccepted);

      SocketService.off("callRejected", handleCallRejected);
    };
  }, []);

  // =========================
  // MUTE
  // =========================

  const toggleMute = () => {
    setIsMuted((previous) => !previous);

    console.log("Microphone:", isMuted ? "ON" : "OFF");

    // Later:
    // WebRTC audio track
    // will be enabled/disabled here
  };

  // =========================
  // END CALL
  // =========================

  const endCall = () => {
    console.log("Ending call");

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* TOP */}

      <View style={styles.top}>
        <Text style={styles.title}>Voice Call</Text>

        <Text style={styles.status}>{callStatus}</Text>
      </View>

      {/* CENTER */}

      <View style={styles.center}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {callerName ? callerName.charAt(0).toUpperCase() : "C"}
          </Text>
        </View>

        <Text style={styles.name}>{callerName || callerId || "Customer"}</Text>

        <Text style={styles.callStatus}>{callStatus}</Text>
      </View>

      {/* CONTROLS */}

      <View style={styles.controls}>
        {/* MUTE */}

        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.activeButton]}
          onPress={toggleMute}
        >
          <Text style={styles.controlIcon}>{isMuted ? "🔇" : "🎤"}</Text>

          <Text style={styles.controlText}>{isMuted ? "Unmute" : "Mute"}</Text>
        </TouchableOpacity>

        {/* SPEAKER */}

        <TouchableOpacity style={styles.controlButton}>
          <Text style={styles.controlIcon}>🔊</Text>

          <Text style={styles.controlText}>Speaker</Text>
        </TouchableOpacity>
      </View>

      {/* END CALL */}

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
          <Text style={styles.endCallIcon}>☎</Text>
        </TouchableOpacity>

        <Text style={styles.endCallText}>End Call</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },

  top: {
    alignItems: "center",
    paddingTop: 25,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },

  status: {
    color: "#9CA3AF",
    fontSize: 15,
    marginTop: 8,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#1677FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 60,
    fontWeight: "bold",
  },

  name: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "bold",
  },

  callStatus: {
    color: "#9CA3AF",
    fontSize: 17,
    marginTop: 10,
  },

  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 35,
    marginBottom: 45,
  },

  controlButton: {
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },

  activeButton: {
    backgroundColor: "#6B7280",
  },

  controlIcon: {
    fontSize: 25,
  },

  controlText: {
    color: "#FFFFFF",
    fontSize: 11,
    marginTop: 4,
  },

  bottom: {
    alignItems: "center",
    paddingBottom: 35,
  },

  endCallButton: {
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },

  endCallIcon: {
    color: "#FFFFFF",
    fontSize: 32,
    transform: [
      {
        rotate: "135deg",
      },
    ],
  },

  endCallText: {
    color: "#FFFFFF",
    fontSize: 13,
    marginTop: 8,
  },
});
