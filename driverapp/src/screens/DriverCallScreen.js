import React, { useEffect, useState } from "react";

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import SocketService from "../services/SocketService";

import WebRTCService from "../services/WebRTCService";

export default function DriverCallScreen({ route, navigation }) {
  const { userId, receiverId, receiverName } = route.params || {};

  const [callStatus, setCallStatus] = useState("Calling...");

  // ==========================
  // START CALL
  // ==========================

  useEffect(() => {
    SocketService.callUser(userId, receiverId);

    SocketService.on("callAccepted", () => {
      setCallStatus("Connected");
    });

    SocketService.on("callRejected", () => {
      setCallStatus("Call rejected");
    });

    SocketService.on("callFailed", () => {
      setCallStatus("Driver is offline");
    });

    return () => {
      SocketService.off("callAccepted");

      SocketService.off("callRejected");

      SocketService.off("callFailed");
    };
  }, []);

  // ==========================
  // END CALL
  // ==========================

  const endCall = () => {
    console.log("Driver ended call");
    SocketService.endCall(userId, receiverId);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* AVATAR */}

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {receiverName ? receiverName.charAt(0).toUpperCase() : "C"}
        </Text>
      </View>

      {/* CUSTOMER NAME */}

      <Text style={styles.name}>{receiverName || "Customer"}</Text>

      {/* CALL STATUS */}

      <Text style={styles.status}>{callStatus}</Text>

      {/* END BUTTON */}

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.endButton} onPress={endCall}>
          <Text style={styles.endText}>☎</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101820",
    alignItems: "center",
    paddingTop: 100,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#1677FF",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "white",
    fontSize: 50,
    fontWeight: "bold",
  },

  name: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 25,
  },

  status: {
    color: "#BBB",
    fontSize: 17,
    marginTop: 10,
  },

  bottom: {
    position: "absolute",
    bottom: 70,
  },

  endButton: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
  },

  endText: {
    color: "white",
    fontSize: 28,
    transform: [
      {
        rotate: "135deg",
      },
    ],
  },
});
