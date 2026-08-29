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

export default function CustomerIncomingCallScreen({ route, navigation }) {
  const { callerId, receiverId, receiverName, offer } = route.params;

  const [accepting, setAccepting] = useState(false);
  const [status, setStatus] = useState("Incoming voice call...");

  const [callStatus, setCallStatus] = useState("Incoming voice call...");
  const [connected, setConnected] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;

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

  // const acceptCall = () => {

  //     console.log(
  //         "CUSTOMER ACCEPT CALL FROM:",
  //         callerId
  //     );

  //     navigation.replace(
  //         "CustomerCallScreen",
  //         {
  //             userId: userId,
  //             receiverId: callerId,
  //             receiverName: callerName,
  //             incoming: true,
  //         }
  //     );
  // };

  // const declineCall = () => {

  //     console.log(
  //         "CUSTOMER DECLINE CALL"
  //     );

  //     try {

  //         if (
  //             typeof SocketService.rejectCall ===
  //             "function"
  //         ) {

  //             SocketService.rejectCall({
  //                 senderId: userId,
  //                 receiverId: callerId,
  //             });

  //         }

  //     } catch (error) {

  //         console.log(
  //             "DECLINE ERROR:",
  //             error
  //         );

  //     }

  //     navigation.goBack();
  // };

  const acceptCall = async () => {
    try {
      CallSoundService.stopAll();

      console.log("================================");
      console.log("DRIVER ACCEPT CALL");
      console.log("callerId:", callerId);
      console.log("offer:", JSON.stringify(offer));
      console.log("================================");

      setStatus("Connecting...");

      await WebRTCService.createPeerConnection(
        (candidate) => {
          console.log("CUSTOMER SEND ICE");

          SocketService.sendIceCandidate({
            senderId: callerId,

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

      // const offer =
      //     await WebRTCService
      //         .createOffer();

      console.log("CUSTOMER OFFER:", offer);

      const answer = await WebRTCService.createAnswer(offer);

      console.log("DRIVER ANSWER:", answer);

      SocketService.sendAnswer({
        senderId: receiverId,

        receiverId: callerId,

        answer: answer,
      });

      // // Driver creates ANSWER
      // const answer = await WebRTCService.createAnswer();

      // console.log(
      //     "DRIVER ANSWER:",
      //     JSON.stringify(answer)
      // );

      // // Send answer back to customer
      // SocketService.sendAnswer(
      //     receiverId,
      //     callerId,
      //     answer
      // );

      console.log("DRIVER ANSWER SENT");

      setStatus("Connected");

      navigation.replace("CustomerAnswerCallScreen", {
        callerId: callerId,
        callerName: receiverName,
      });
    } catch (error) {
      console.log("CUSTOMER ACCEPT CALL ERROR:", error);

      setStatus("Call failed");

      Alert.alert("Call Error", error?.message || "Unable to accept call");
    }
  };

  const rejectCall = () => {
    console.log("CUSTOMER DECLINE CALL");

    try {
      CallSoundService.stopAll();

      if (typeof SocketService.rejectCall === "function") {
        SocketService.rejectCall({
          senderId: receiverId,
          receiverId: callerId,
        });
      }
    } catch (error) {
      console.log("DECLINE ERROR:", error);
    }

    navigation.goBack();
  };

  useEffect(() => {
    CallSoundService.startIncomingRingtone();

    return () => {
      CallSoundService.stopAll();
    };
  }, []);

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
          <TouchableOpacity style={styles.accept} onPress={acceptCall}>
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
