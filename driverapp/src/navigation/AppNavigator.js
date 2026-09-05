import React, { useEffect, useRef } from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DriverLoginScreen from "../screens/DriverLoginScreen";
import DriverHomeScreen from "../screens/DriverHomeScreen";
import DriverChatsScreen from "../screens/DriverChatsScreen";
import DriverChatScreen from "../screens/DriverChatScreen";
import DriverTrackingScreen from "../screens/DriverTrackingScreen";
import IncomingCallScreen from "../screens/IncomingCallScreen";
import VoiceCallScreen from "../screens/VoiceCallScreen";
import DriverCallScreen from "../screens/DriverCallScreen";
import MapScreen from "../screens/MapScreen";

import NativeSocketService from "../services/NativeSocketService";
import SocketService from "../services/SocketService";
import { getDriverSession } from "../services/AuthSession";

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const isNavReadyRef = useRef(false);
  const lastProcessedNotificationKeyRef = useRef("");
  const lastProcessedTimeRef = useRef(0);

  const handleNotificationNavigation = async (data) => {
    if (!data || !navigationRef.isReady()) return;

    // Deduplicate duplicate events within 3 seconds
    const notificationKey = `${data.action || ""}_${data.callerId || data.senderId || ""}_${data.messageId || ""}`;
    const now = Date.now();
    if (
      notificationKey === lastProcessedNotificationKeyRef.current &&
      now - lastProcessedTimeRef.current < 3000
    ) {
      console.log("🔔 [GLOBAL DRIVER] Ignoring duplicate notification navigation:", notificationKey);
      return;
    }
    lastProcessedNotificationKeyRef.current = notificationKey;
    lastProcessedTimeRef.current = now;

    console.log("🔔 [GLOBAL DRIVER NOTIFICATION OPENED]:", data);

    // Immediately clear stored notification from native layer
    NativeSocketService.clearInitialNotification?.();

    try {
      const session = await getDriverSession();
      const driverId = session?.driverId || "driver_201";
      // Reconnect the JS signaling socket before an Answer action can be pressed.
      SocketService.connect(driverId);

      if (data.action === "INCOMING_CALL" || data.callerId) {
        let parsedOffer = null;
        if (data.offer) {
          try {
            parsedOffer =
              typeof data.offer === "string" ? JSON.parse(data.offer) : data.offer;
          } catch (e) {
            parsedOffer = data.offer;
          }
        }

        navigationRef.navigate("IncomingCall", {
          callerId: data.callerId || data.senderId,
          callerName: data.callerName || data.receiverName || "Customer",
          receiverId: driverId,
          offer: parsedOffer,
          autoAnswer: data.autoAnswer === true,
        });
      } else if (data.action === "OPEN_CHAT" || data.senderId) {
        navigationRef.navigate("DriverChat", {
          userId: driverId,
          receiverId: data.senderId,
          receiverName: data.receiverName || "Customer",
          messageId: data.messageId || "",
        });
      }
    } catch (err) {
      console.warn("Error handling global driver notification route:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = NativeSocketService.onNotificationOpened((data) => {
      if (isNavReadyRef.current) {
        handleNotificationNavigation(data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const onNavigationReady = async () => {
    isNavReadyRef.current = true;
    const initialNotification = await NativeSocketService.getInitialNotification?.();
    if (initialNotification) {
      handleNotificationNavigation(initialNotification);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
      <Stack.Navigator initialRouteName="DriverLogin">
        <Stack.Screen
          name="DriverLogin"
          component={DriverLoginScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="DriverHome"
          component={DriverHomeScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="DriverChats"
          component={DriverChatsScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="DriverChat"
          component={DriverChatScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="DriverTracking"
          component={DriverTrackingScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="IncomingCall"
          component={IncomingCallScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="VoiceCallScreen"
          component={VoiceCallScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="DriverCallScreen"
          component={DriverCallScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Map"
          component={MapScreen}
          options={{
            headerShown: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
