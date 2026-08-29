import {
    RTCPeerConnection,
    RTCSessionDescription,
    RTCIceCandidate,
    mediaDevices
} from "react-native-webrtc";


class WebRTCService {

    peerConnection = null;

    localStream = null;


    // ==========================
    // CREATE CONNECTION
    // ==========================

    createPeerConnection(
        onIceCandidate,
        onRemoteStream
    ) {

        this.peerConnection =
            new RTCPeerConnection({

                iceServers: [
                    {
                        urls:
                            "stun:stun.l.google.com:19302"
                    }
                ]

            });


        this.peerConnection.onicecandidate =
            (event) => {

                if (
                    event.candidate &&
                    onIceCandidate
                ) {

                    onIceCandidate(
                        event.candidate
                    );

                }

            };


        this.peerConnection.ontrack =
            (event) => {

                if (
                    event.streams &&
                    event.streams[0]
                ) {

                    if (onRemoteStream) {

                        onRemoteStream(
                            event.streams[0]
                        );

                    }

                }

            };


        return this.peerConnection;

    }


    // ==========================
    // MICROPHONE
    // ==========================

    async getLocalAudio() {

        this.localStream =
            await mediaDevices.getUserMedia({

                audio: true,

                video: false

            });


        if (
            this.peerConnection &&
            this.localStream
        ) {

            this.localStream
                .getTracks()
                .forEach(track => {

                    this.peerConnection.addTrack(
                        track,
                        this.localStream
                    );

                });

        }


        return this.localStream;

    }


    // ==========================
    // CREATE OFFER
    // ==========================

    async createOffer() {

        const offer =
            await this.peerConnection
                .createOffer();


        await this.peerConnection
            .setLocalDescription(
                offer
            );


        return offer;

    }


    // ==========================
    // SET OFFER
    // ==========================

    async setRemoteOffer(
        offer
    ) {

        await this.peerConnection
            .setRemoteDescription(
                new RTCSessionDescription(
                    offer
                )
            );

    }


    // ==========================
    // CREATE ANSWER
    // ==========================

    async createAnswer() {

        const answer =
            await this.peerConnection
                .createAnswer();


        await this.peerConnection
            .setLocalDescription(
                answer
            );


        return answer;

    }


    // ==========================
    // SET ANSWER
    // ==========================

    async setRemoteAnswer(
        answer
    ) {

        await this.peerConnection
            .setRemoteDescription(
                new RTCSessionDescription(
                    answer
                )
            );

    }


    // ==========================
    // ICE
    // ==========================

    async addIceCandidate(
        candidate
    ) {

        if (
            !this.peerConnection
        ) {
            return;
        }


        await this.peerConnection
            .addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );

    }


    // ==========================
    // MUTE
    // ==========================

    setMuted(
        muted
    ) {

        if (!this.localStream) {
            return;
        }


        this.localStream
            .getAudioTracks()
            .forEach(track => {

                track.enabled =
                    !muted;

            });

    }


    // ==========================
    // END
    // ==========================

    close() {

        if (this.localStream) {

            this.localStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

            this.localStream = null;

        }


        if (
            this.peerConnection
        ) {

            this.peerConnection.close();

            this.peerConnection =
                null;

        }

    }

}


export default new WebRTCService();