import React, { useEffect, useRef } from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CustomerLoginScreen from "./Src/screens/CustomerLoginScreen";
import CustomerHomeScreen from "./Src/screens/CustomerHomeScreen";
import CustomerCallScreen from "./Src/screens/CustomerCallScreen";
import CustomerIncomingCallScreen from "./Src/screens/CustomerIncomingCallScreen";
import CustomerAnswerCallScreen from "./Src/screens/CustomerAnswerCallScreen";
import CustomerTrackingScreen from "./Src/screens/CustomerTrackingScreen";
import CustomerChatScreen from "./Src/screens/CustomerChatScreen";
import MapScreen from "./Src/screens/MapScreen";

import NativeSocketService from "./Src/services/NativeSocketService";
import SocketService from "./Src/services/SocketService";
import { getUserSession } from "./Src/services/AuthSession";

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();

export default function App() {
  const isNavReadyRef = useRef(false);
  const lastProcessedNotificationKeyRef = useRef("");
  const lastProcessedTimeRef = useRef(0);

  const handleNotificationNavigation = async (data: any) => {
    if (!data || !navigationRef.isReady()) return;

    // Deduplicate duplicate events within 3 seconds
    const notificationKey = `${data.action || ""}_${data.callerId || data.senderId || ""}_${data.messageId || ""}`;
    const now = Date.now();
    if (
      notificationKey === lastProcessedNotificationKeyRef.current &&
      now - lastProcessedTimeRef.current < 3000
    ) {
      console.log("🔔 [GLOBAL CLIENT] Ignoring duplicate notification navigation:", notificationKey);
      return;
    }
    lastProcessedNotificationKeyRef.current = notificationKey;
    lastProcessedTimeRef.current = now;

    console.log("🔔 [GLOBAL CLIENT NOTIFICATION OPENED]:", data);

    // There must be one owner for notification routing.  In particular, do not
    // let CustomerLogin's auto-login replace this route with the home screen.
    await NativeSocketService.clearInitialNotificationData?.();

    try {
      const session = await getUserSession();
      const customerId = session?.userId || "customer_101";
      // The native service receives the notification while React Native is stopped.
      // Recreate Socket.IO before opening the call so Answer/Reject is buffered until connected.
      SocketService.connect(customerId);

      if (data.action === "INCOMING_CALL" || data.callerId) {
        let parsedOffer = null;
        if (data.offer) {
          try {
            parsedOffer =
              typeof data.offer === "string" ? JSON.parse(data.offer) : data.offer;
          } catch {
            parsedOffer = data.offer;
          }
        }

        (navigationRef as any).navigate("CustomerIncomingCall", {
          callerId: data.callerId || data.senderId,
          callerName: data.callerName || data.receiverName || "Driver",
          receiverId: customerId,
          receiverName: session?.userName || "Customer",
          offer: parsedOffer,
          autoAnswer: data.autoAnswer === true,
        });
      } else if (data.action === "OPEN_CHAT" || data.senderId) {
        (navigationRef as any).navigate("CustomerChat", {
          userId: customerId,
          receiverId: data.senderId,
          receiverName: data.receiverName || "Driver",
          messageId: data.messageId || "",
          message: data.message || "",
        });
      }
    } catch (err) {
      console.warn("Error handling global client notification route:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = NativeSocketService.onNotificationOpened((data: any) => {
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
    // Check if app was opened from cold start via notification
    const initialNotification = await NativeSocketService.getInitialNotification?.();
    if (initialNotification) {
      handleNotificationNavigation(initialNotification);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
      <Stack.Navigator initialRouteName="CustomerLogin">
        <Stack.Screen
          name="CustomerLogin"
          component={CustomerLoginScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="CustomerHomeScreen"
          component={CustomerHomeScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="CustomerCallScreen"
          component={CustomerCallScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="CustomerIncomingCall"
          component={CustomerIncomingCallScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="CustomerAnswerCallScreen"
          component={CustomerAnswerCallScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="CustomerTracking"
          component={CustomerTrackingScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="CustomerChat"
          component={CustomerChatScreen}
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
