import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
} from "react-native";

import SocketService from "../services/SocketService";

import WebRTCService from "../services/WebRTCService";

import CallSoundService from "../services/CallSoundService";

export default function CustomerCallScreen({ route, navigation }) {
  const { userId, receiverId, receiverName } = route.params || {};

  const [callStatus, setCallStatus] = useState("Starting...");

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    startCall();

    return () => {
      console.log("CUSTOMER CALL SCREEN CLEANUP");

      WebRTCService.close();
    };
  }, []);

  const requestMicrophonePermission = async () => {
    if (Platform.OS !== "android") {
      return true;
    }

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );

      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.log("MIC PERMISSION ERROR:", error);

      return false;
    }
  };

  const startCall = async () => {
    try {
      console.log("====================");

      console.log("CUSTOMER START CALL");

      console.log("USER:", userId);

      console.log("DRIVER:", receiverId);

      console.log("====================");
      console.log("========== FUNCTION CHECK ==========");

      console.log(
        "requestMicrophonePermission:",
        typeof requestMicrophonePermission,
      );

      console.log("WebRTCService:", WebRTCService);

      console.log(
        "createPeerConnection:",
        typeof WebRTCService?.createPeerConnection,
      );

      console.log("getLocalAudio:", typeof WebRTCService?.getLocalAudio);

      console.log("createOffer:", typeof WebRTCService?.createOffer);

      console.log("sendCall:", typeof SocketService?.sendCall);

      console.log("sendOffer:", typeof SocketService?.sendOffer);

      console.log("sendIceCandidate:", typeof SocketService?.sendIceCandidate);

      console.log("onAnswer:", typeof SocketService?.onAnswer);

      console.log("onIceCandidate:", typeof SocketService?.onIceCandidate);

      console.log("==================================");

      setCallStatus("Requesting microphone...");

      const permission = await requestMicrophonePermission();

      if (!permission) {
        Alert.alert(
          "Permission Required",
          "Microphone permission is required.",
        );

        setCallStatus("Microphone permission denied");

        return;
      }

      setCallStatus("Creating connection...");

      await WebRTCService.createPeerConnection(
        (candidate) => {
          console.log("CUSTOMER SEND ICE");

          SocketService.sendIceCandidate({
            senderId: userId,

            receiverId: receiverId,

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

      setCallStatus("Creating offer...");

      const offer = await WebRTCService.createOffer();

      console.log("CUSTOMER OFFER:", offer);

      SocketService.sendCall({
        senderId: userId,

        senderName: "Customer",

        receiverId: receiverId,

        offer: offer,
      });

      SocketService.sendOffer({
        senderId: userId,

        receiverId: receiverId,

        offer: offer,
      });
      CallSoundService.startOutgoingRingback();

      setCallStatus("Calling " + receiverName + "...");

      SocketService.onAnswer(handleAnswer);

      SocketService.onIceCandidate(handleIceCandidate);
    } catch (error) {
      CallSoundService.stopAll();
      console.log("CUSTOMER CALL ERROR:", error);

      console.log("ERROR MESSAGE:", error?.message);

      setCallStatus("Call failed");

      Alert.alert("Call Error", error?.message || "Unable to start call");
    }
  };

  const handleAnswer = async (data) => {
    try {
      console.log("CUSTOMER RECEIVED ANSWER:", data);

      if (data.senderId !== receiverId) {
        console.log("ANSWER FROM UNKNOWN USER");

        return;
      }

      CallSoundService.stopAll();
      await WebRTCService.setRemoteDescription(data.answer);

      setCallStatus("Connected");

      setConnected(true);
    } catch (error) {
      CallSoundService.stopAll();

      console.log("ANSWER ERROR:", error);

      setCallStatus("Answer processing failed");
    }
  };

  const handleIceCandidate = async (data) => {
    try {
      if (data.senderId !== receiverId) {
        return;
      }

      console.log("CUSTOMER RECEIVED ICE");

      await WebRTCService.addIceCandidate(data.candidate);
    } catch (error) {
      console.log("CUSTOMER ICE ERROR:", error);
    }
  };

  const endCall = () => {
    console.log("CUSTOMER END CALL");

    try {
      CallSoundService.stopAll();
      SocketService.endCall({
        senderId: userId,
        receiverId: receiverId,
      });
      WebRTCService.close();

      SocketService.off("answer", handleAnswer);
      SocketService.off("iceCandidate", handleIceCandidate);
    } catch (error) {
      CallSoundService.stopAll();
      console.log("END CALL CLEANUP ERROR:", error);
    }

    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {receiverName ? receiverName.charAt(0) : "D"}
        </Text>
      </View>

      <Text style={styles.name}>{receiverName || "Driver"}</Text>

      <Text style={styles.id}>{receiverId}</Text>

      <Text style={styles.status}>{callStatus}</Text>

      {connected && <Text style={styles.connected}>🎤 Voice Connected</Text>}

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.endButton} onPress={endCall}>
          <Text style={styles.endText}>END CALL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    alignItems: "center",

    backgroundColor: "#ffffff",

    paddingTop: 80,
  },

  avatar: {
    width: 110,

    height: 110,

    borderRadius: 55,

    backgroundColor: "#444444",

    justifyContent: "center",

    alignItems: "center",
  },

  avatarText: {
    color: "white",

    fontSize: 48,

    fontWeight: "bold",
  },

  name: {
    fontSize: 26,

    fontWeight: "bold",

    marginTop: 25,
  },

  id: {
    fontSize: 15,

    marginTop: 5,
  },

  status: {
    fontSize: 18,

    marginTop: 30,
  },

  connected: {
    fontSize: 18,

    marginTop: 15,
  },

  bottom: {
    position: "absolute",

    bottom: 60,
  },

  endButton: {
    width: 150,

    height: 55,

    borderRadius: 30,

    backgroundColor: "red",

    justifyContent: "center",

    alignItems: "center",
  },

  endText: {
    color: "white",

    fontWeight: "bold",

    fontSize: 16,
  },
});
