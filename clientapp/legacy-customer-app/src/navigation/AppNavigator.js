import React from "react";

import {
    NavigationContainer
} from "@react-navigation/native";

import {
    createNativeStackNavigator
} from "@react-navigation/native-stack";


import CustomerHomeScreen
    from "../screens/CustomerHomeScreen";

import CustomerChatScreen
    from "../screens/CustomerChatScreen";

import CustomerCallScreen
    from "../screens/CustomerCallScreen";

import IncomingCallScreen
    from "../screens/IncomingCallScreen";

import VoiceCallScreen
    from "../screens/VoiceCallScreen";    


const Stack =
    createNativeStackNavigator();


export default function AppNavigator() {

    return (

        <NavigationContainer>

            <Stack.Navigator>

                <Stack.Screen
                    name="CustomerHome"
                    component={
                        CustomerHomeScreen
                    }
                    options={{
                        title: "Cab Drivers"
                    }}
                />

                <Stack.Screen
                    name="CustomerChat"
                    component={
                        CustomerChatScreen
                    }
                    options={{
                        headerShown: false
                    }}
                />

                <Stack.Screen
                    name="CustomerCall"
                    component={
                        CustomerCallScreen
                    }
                    options={{
                        headerShown: false
                    }}
                />

                 <Stack.Screen
                    name="IncomingCall"
                    component={IncomingCallScreen}
                    options={{
                        headerShown: false
                    }}
                />

                <Stack.Screen
                  name="VoiceCallScreen"
                  component={VoiceCallScreen}
                  options={{
                     headerShown: false
                  }}
                />

            </Stack.Navigator>

        </NavigationContainer>

    );

}