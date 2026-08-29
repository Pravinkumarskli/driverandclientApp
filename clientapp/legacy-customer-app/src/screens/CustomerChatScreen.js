import React, {
    useEffect,
    useState
} from "react";

import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    SafeAreaView
} from "react-native";

import SocketService
    from "../services/SocketService";


export default function CustomerChatScreen({
    route
}) {

    const {
        userId,
        receiverId,
        receiverName
    } = route.params;


    const [
        message,
        setMessage
    ] = useState("");


    const [
        messages,
        setMessages
    ] = useState([]);


    const conversationId =
        [userId, receiverId]
            .sort()
            .join("_");


    useEffect(() => {

        const receiveMessage =
            (data) => {

                if (
                    data.conversationId
                    === conversationId
                ) {

                    setMessages(
                        previous => [
                            ...previous,
                            data
                        ]
                    );

                }

            };


        SocketService.on(
            "receiveMessage",
            receiveMessage
        );


        return () => {

            SocketService.off(
                "receiveMessage"
            );

        };

    }, []);


    const sendMessage = () => {

        if (!message.trim()) {
            return;
        }


        const data = {

            id:
                Date.now().toString(),

            conversationId,

            senderId:
                userId,

            receiverId,

            message:
                message.trim(),

            type:
                "text",

            timestamp:
                Date.now(),

            status:
                "sent"

        };


        SocketService.sendMessage(
            data
        );


        setMessages(
            previous => [
                ...previous,
                data
            ]
        );


        setMessage("");

    };


    return (

        <SafeAreaView
            style={styles.container}
        >

            {/* HEADER */}

            <View style={styles.header}>

                <View style={styles.avatar}>

                    <Text
                        style={
                            styles.avatarText
                        }
                    >
                        {receiverName[0]}
                    </Text>

                </View>


                <View>

                    <Text style={styles.name}>
                        {receiverName}
                    </Text>

                    <Text style={styles.online}>
                        Online
                    </Text>

                </View>

            </View>


            {/* MESSAGES */}

            <FlatList
                data={messages}
                keyExtractor={
                    item => item.id
                }
                contentContainerStyle={{
                    padding: 15
                }}
                renderItem={({
                    item
                }) => {

                    const isMe =
                        item.senderId
                        === userId;


                    return (

                        <View
                            style={[
                                styles.row,
                                isMe
                                    ? styles.myRow
                                    : styles.otherRow
                            ]}
                        >

                            <View
                                style={[
                                    styles.bubble,
                                    isMe
                                        ? styles.myBubble
                                        : styles.otherBubble
                                ]}
                            >

                                <Text
                                    style={[
                                        styles.message,
                                        {
                                            color:
                                                isMe
                                                    ? "white"
                                                    : "black"
                                        }
                                    ]}
                                >
                                    {item.message}
                                </Text>

                                <Text
                                    style={[
                                        styles.time,
                                        {
                                            color:
                                                isMe
                                                    ? "#DDE8FF"
                                                    : "#777"
                                        }
                                    ]}
                                >
                                    {new Date(
                                        item.timestamp
                                    ).toLocaleTimeString(
                                        [],
                                        {
                                            hour:
                                                "2-digit",
                                            minute:
                                                "2-digit"
                                        }
                                    )}
                                </Text>

                            </View>

                        </View>

                    );

                }}

            />


            {/* INPUT */}

            <View
                style={
                    styles.inputContainer
                }
            >

                <TextInput
                    value={message}
                    onChangeText={
                        setMessage
                    }
                    placeholder="Message..."
                    style={styles.input}
                />


                <TouchableOpacity
                    style={
                        styles.sendButton
                    }
                    onPress={
                        sendMessage
                    }
                >

                    <Text
                        style={
                            styles.sendText
                        }
                    >
                        ➤
                    </Text>

                </TouchableOpacity>

            </View>

        </SafeAreaView>

    );

}


const styles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: "#EFEFEF"
    },

    header: {
        height: 65,
        backgroundColor: "white",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        elevation: 3
    },

    avatar: {
        width: 45,
        height: 45,
        borderRadius: 23,
        backgroundColor: "#1677FF",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10
    },

    avatarText: {
        color: "white",
        fontSize: 20,
        fontWeight: "bold"
    },

    name: {
        fontSize: 18,
        fontWeight: "bold"
    },

    online: {
        color: "green",
        marginTop: 2
    },

    row: {
        marginVertical: 4
    },

    myRow: {
        alignItems: "flex-end"
    },

    otherRow: {
        alignItems: "flex-start"
    },

    bubble: {
        maxWidth: "75%",
        padding: 10,
        borderRadius: 15
    },

    myBubble: {
        backgroundColor: "#1677FF"
    },

    otherBubble: {
        backgroundColor: "white"
    },

    message: {
        fontSize: 16
    },

    time: {
        fontSize: 10,
        textAlign: "right",
        marginTop: 3
    },

    inputContainer: {
        flexDirection: "row",
        backgroundColor: "white",
        padding: 8,
        alignItems: "center"
    },

    input: {
        flex: 1,
        backgroundColor: "#F1F1F1",
        borderRadius: 23,
        height: 46,
        paddingHorizontal: 15
    },

    sendButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#1677FF",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 7
    },

    sendText: {
        color: "white",
        fontSize: 22
    }

});