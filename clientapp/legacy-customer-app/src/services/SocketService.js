import { io } from "socket.io-client";

const SERVER_URL = "http://10.0.2.2:3000";

class SocketService {

    socket = null;

    connect(userId, onConnected) {

        if (this.socket) {

            if (this.socket.connected) {

                onConnected?.();

            }

            return;
        }


        this.socket = io(
            SERVER_URL,
            {
                transports: ["websocket"],
                reconnection: true
            }
        );


        this.socket.on(
            "connect",
            () => {

                console.log(
                    "SOCKET CONNECTED:",
                    this.socket.id
                );


                this.socket.emit(
                    "register",
                    userId
                );


                if (onConnected) {
                    onConnected();
                }

            }
        );


        this.socket.on(
            "connect_error",
            (error) => {

                console.log(
                    "SOCKET ERROR:",
                    error.message
                );

            }
        );


        this.socket.on(
            "disconnect",
            () => {

                console.log(
                    "SOCKET DISCONNECTED"
                );

            }
        );

    }


    getDrivers() {

        if (
            this.socket &&
            this.socket.connected
        ) {

            console.log(
                "Requesting drivers..."
            );

            this.socket.emit(
                "getDrivers"
            );

        } else {

            console.log(
                "Socket not connected"
            );

        }

    }


    sendMessage(data) {

        this.socket?.emit(
            "sendMessage",
            data
        );

    }


    callUser(
        callerId,
        receiverId
    ) {

        this.socket?.emit(
            "callUser",
            {
                callerId,
                receiverId
            }
        );

    }

     acceptCall(
        callerId,
        receiverId
    ) {

        this.socket.emit(
            "acceptCall",
            {
                callerId,
                receiverId
            }
        );
    }

    rejectCall(
        callerId,
        receiverId
    ) {

        this.socket.emit(
            "rejectCall",
            {
                callerId,
                receiverId
            }
        );
    }

    // =====================================
    // WEBRTC OFFER
    // =====================================

    sendOffer(
        callerId,
        receiverId,
        offer
    ) {

        console.log(
            "SEND WEBRTC OFFER"
        );


        this.socket?.emit(
            "webrtcOffer",
            {
                callerId,
                receiverId,
                offer
            }
        );

    }

    // =====================================
    // WEBRTC ANSWER
    // =====================================

    sendAnswer(
        callerId,
        receiverId,
        answer
    ) {

        console.log(
            "SEND WEBRTC ANSWER"
        );


        this.socket?.emit(
            "webrtcAnswer",
            {
                callerId,
                receiverId,
                answer
            }
        );

    }

    // =====================================
    // ICE
    // =====================================

    sendIceCandidate(
        callerId,
        receiverId,
        candidate
    ) {

        console.log(
            "SEND ICE CANDIDATE"
        );


        this.socket?.emit(
            "webrtcIceCandidate",
            {
                callerId,
                receiverId,
                candidate
            }
        );

    }



    on(event, callback) {

        this.socket?.on(
            event,
            callback
        );

    }


    off(event) {

        this.socket?.off(event);

    }

}

export default new SocketService();