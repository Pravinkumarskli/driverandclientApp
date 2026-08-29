import React, {
    useEffect,
    useState
} from "react";

import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView
} from "react-native";

import SocketService
    from "../services/SocketService";


const CUSTOMER_ID =
    "customer_101";

  const drivers = [
    {
        id: "driver_201",
        name: "Arun",
        vehicle: "Swift Dzire",
        rating: 4.8,
        online: true
    },
    {
        id: "driver_202",
        name: "Kumar",
        vehicle: "Toyota Etios",
        rating: 4.7,
        online: true
    },
    {
        id: "driver_203",
        name: "Ravi",
        vehicle: "Hyundai Aura",
        rating: 4.9,
        online: true
    }
];


export default function CustomerHomeScreen({
    navigation
}) {

    // const [drivers, setDrivers] =
    //     useState([]);


   useEffect(() => {

        SocketService.connect(
            CUSTOMER_ID
        );


        // SocketService.on(
        //     "driverList",
        //     (list) => {
        //     console.log(
        //         "DRIVER LIST RECEIVED:",
        //         list
        //     );
        //         setDrivers(list);

        //     }
        // );


        // SocketService.getDrivers();


        // return () => {

        //     SocketService.off(
        //         "driverList"
        //     );

        // };

    }, []);

useEffect(() => {

    const handleIncomingCall = (data) => {

        console.log(
            "📞 INCOMING CALL:",
            data
        );

        navigation.navigate(
            "IncomingCall",
            {
                callerId: data.callerId,
                receiverId: data.receiverId
            }
        );

    };

    SocketService.on(
        "incomingCall",
        handleIncomingCall
    );

    return () => {

        SocketService.off(
            "incomingCall",
            handleIncomingCall
        );

    };

}, [navigation]);

    const openChat = (driver) => {

        navigation.navigate(
            "CustomerChat",
            {
                userId:
                    CUSTOMER_ID,

                receiverId:
                    driver.id,

                receiverName:
                    driver.name
            }
        );

    };


    const callDriver = (driver) => {

        navigation.navigate(
            "CustomerCall",
            {
                userId:
                    CUSTOMER_ID,

                receiverId:
                    driver.id,

                receiverName:
                    driver.name
            }
        );

    };


    const renderDriver = ({
        item
    }) => {

        return (

            <View style={styles.card}>

                <View style={styles.avatar}>

                    <Text
                        style={
                            styles.avatarText
                        }
                    >
                        {item.name[0]}
                    </Text>

                </View>


                <View style={styles.info}>

                    <Text style={styles.name}>
                        {item.name}
                    </Text>

                    <Text style={styles.vehicle}>
                        {item.vehicle}
                    </Text>

                    <Text style={styles.rating}>
                        ⭐ {item.rating}
                    </Text>


                    <Text
                        style={[
                            styles.status,
                            {
                                color:
                                    item.online
                                        ? "green"
                                        : "gray"
                            }
                        ]}
                    >
                        {item.online
                            ? "● Online"
                            : "○ Offline"}
                    </Text>

                </View>


                <View>

                    <TouchableOpacity
                        style={
                            styles.chatButton
                        }
                        onPress={() =>
                            openChat(item)
                        }
                    >

                        <Text
                            style={
                                styles.buttonText
                            }
                        >
                            Chat
                        </Text>

                    </TouchableOpacity>


                    <TouchableOpacity
                        style={
                            styles.callButton
                        }
                        onPress={() =>
                            callDriver(item)
                        }
                    >

                        <Text
                            style={
                                styles.callText
                            }
                        >
                            ☎
                        </Text>

                    </TouchableOpacity>

                </View>

            </View>

        );

    };


    return (

        <SafeAreaView
            style={styles.container}
        >

            <Text style={styles.title}>
                Available Drivers
            </Text>


            <FlatList
                data={drivers}
                renderItem={
                    renderDriver
                }
                keyExtractor={
                    item => item.id
                }
                contentContainerStyle={{
                    padding: 15
                }}
            />

        </SafeAreaView>

    );

}


const styles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: "#F5F6F8"
    },

    title: {
        fontSize: 25,
        fontWeight: "bold",
        padding: 20
    },

    card: {
        backgroundColor: "white",
        borderRadius: 15,
        padding: 15,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        elevation: 3
    },

    avatar: {
        width: 55,
        height: 55,
        borderRadius: 28,
        backgroundColor: "#1677FF",
        justifyContent: "center",
        alignItems: "center"
    },

    avatarText: {
        color: "white",
        fontSize: 23,
        fontWeight: "bold"
    },

    info: {
        flex: 1,
        marginLeft: 12
    },

    name: {
        fontSize: 18,
        fontWeight: "bold"
    },

    vehicle: {
        color: "#777",
        marginTop: 3
    },

    rating: {
        marginTop: 3
    },

    status: {
        marginTop: 4,
        fontWeight: "600"
    },

    chatButton: {
        backgroundColor: "#1677FF",
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 10,
        marginBottom: 8
    },

    callButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#20B957",
        justifyContent: "center",
        alignItems: "center"
    },

    buttonText: {
        color: "white",
        fontWeight: "bold"
    },

    callText: {
        color: "white",
        fontSize: 20
    }

});