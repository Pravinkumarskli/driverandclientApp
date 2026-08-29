import React, { useEffect } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";

import SocketService from "../services/SocketService";

export default function IncomingCallScreen({ route, navigation }) {
  const {
    callerId,
    callerName,
    receiverId,
    callType = "voice",
  } = route.params || {};

  useEffect(() => {
    console.log("📞 Incoming call");

    console.log("Caller:", callerId);

    console.log("Receiver:", receiverId);

    return () => {
      console.log("IncomingCallScreen cleanup");
    };
  }, [callerId, receiverId]);

  // =========================
  // ACCEPT
  // =========================

  const acceptCall = () => {
    console.log("📞 Call accepted:", callerId, "->", receiverId);

    SocketService.acceptCall(callerId, receiverId);

    navigation.replace("VoiceCallScreen", {
      callerId,
      callerName,
      receiverId,
      callType,
    });
  };

  // =========================
  // REJECT
  // =========================

  const rejectCall = () => {
    console.log("❌ Call rejected:", callerId, "->", receiverId);

    SocketService.rejectCall(callerId, receiverId);

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* AVATAR */}

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {callerName ? callerName.charAt(0) : "C"}
          </Text>
        </View>

        {/* TITLE */}

        <Text style={styles.incoming}>Incoming Call</Text>

        {/* CALLER */}

        <Text style={styles.name}>{callerName || "Customer"}</Text>

        {/* CALL TYPE */}

        <Text style={styles.callType}>
          {callType === "video" ? "Video Call" : "Voice Call"}
        </Text>

        {/* BUTTONS */}

        <View style={styles.buttons}>
          {/* REJECT */}

          <TouchableOpacity style={styles.rejectButton} onPress={rejectCall}>
            <Text style={styles.buttonIcon}>✕</Text>

            <Text style={styles.buttonText}>Decline</Text>
          </TouchableOpacity>

          {/* ACCEPT */}

          <TouchableOpacity style={styles.acceptButton} onPress={acceptCall}>
            <Text style={styles.buttonIcon}>☎</Text>

            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1677FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
  },

  avatarText: {
    fontSize: 48,
    color: "#FFFFFF",
    fontWeight: "bold",
  },

  incoming: {
    fontSize: 18,
    color: "#777777",
    marginBottom: 10,
  },

  name: {
    fontSize: 30,
    fontWeight: "bold",
  },

  callType: {
    fontSize: 16,
    color: "#777777",
    marginTop: 8,
  },

  buttons: {
    flexDirection: "row",
    marginTop: 70,
    gap: 40,
  },

  rejectButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E53935",
    justifyContent: "center",
    alignItems: "center",
  },

  acceptButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#20B957",
    justifyContent: "center",
    alignItems: "center",
  },

  buttonIcon: {
    color: "#FFFFFF",
    fontSize: 28,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginTop: 5,
  },
});
