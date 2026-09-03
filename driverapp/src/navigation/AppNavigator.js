import React from "react";
import { NavigationContainer } from "@react-navigation/native";
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

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
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