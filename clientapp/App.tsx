import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CustomerLoginScreen from "./Src/screens/CustomerLoginScreen";
import CustomerHomeScreen from "./Src/screens/CustomerHomeScreen";
import CustomerCallScreen from "./Src/screens/CustomerCallScreen";
import CustomerIncomingCallScreen from "./Src/screens/CustomerIncomingCallScreen";
import CustomerAnswerCallScreen from "./Src/screens/CustomerAnswerCallScreen";
import CustomerTrackingScreen from "./Src/screens/CustomerTrackingScreen";
import CustomerChatScreen from "./Src/screens/CustomerChatScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
