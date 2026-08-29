import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";

class WebRTCService {
  constructor() {
    this.peerConnection = null;

    this.localStream = null;

    this.dataChannel = null;

    this.messageCallback = null;

    this.connectionCallback = null;

    this.remoteStreamCallback = null;
  }

  // =========================================================
  // CREATE PEER CONNECTION
  // =========================================================

  createPeerConnection(onIceCandidate = null, onRemoteStream = null) {
    console.log("WEBRTC: createPeerConnection START");

    if (this.peerConnection) {
      console.log("WEBRTC: PeerConnection already exists");

      return this.peerConnection;
    }

    // Save callbacks from CustomerCallScreen
    this.connectionCallback = this.connectionCallback || null;

    this.remoteStreamCallback = onRemoteStream || this.remoteStreamCallback;

    const configuration = {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },

        {
          urls: "stun:stun1.l.google.com:19302",
        },
      ],
    };

    console.log("WEBRTC: creating RTCPeerConnection");

    this.peerConnection = new RTCPeerConnection(configuration);

    console.log("WEBRTC: RTCPeerConnection created");

    // =====================================================
    // ICE CANDIDATE
    // =====================================================

    this.peerConnection.onicecandidate = (event) => {
      if (event && event.candidate) {
        console.log("WEBRTC: ICE candidate generated");

        if (onIceCandidate) {
          onIceCandidate(event.candidate);
        }
      }
    };

    // =====================================================
    // CONNECTION STATE
    // =====================================================

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) {
        return;
      }

      const state = this.peerConnection.connectionState;

      console.log("WEBRTC connection:", state);

      if (this.connectionCallback) {
        this.connectionCallback(state);
      }
    };

    // =====================================================
    // ICE CONNECTION STATE
    // =====================================================

    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) {
        return;
      }

      console.log("WEBRTC ICE:", this.peerConnection.iceConnectionState);
    };

    // =====================================================
    // REMOTE AUDIO
    // =====================================================

    this.peerConnection.ontrack = (event) => {
      console.log("WEBRTC: Remote track received");

      if (event && event.streams && event.streams.length > 0) {
        const remoteStream = event.streams[0];

        console.log("WEBRTC: Remote stream received");

        if (this.remoteStreamCallback) {
          this.remoteStreamCallback(remoteStream);
        }
      }
    };

    // =====================================================
    // DATA CHANNEL
    // =====================================================

    this.peerConnection.ondatachannel = (event) => {
      console.log("WEBRTC: Incoming DataChannel");

      if (event && event.channel) {
        this.setupDataChannel(event.channel);
      }
    };

    return this.peerConnection;
  }

  // =========================================================
  // MICROPHONE
  // =========================================================

  async getLocalAudio() {
    console.log("WEBRTC: getLocalAudio START");

    if (!mediaDevices) {
      throw new Error("react-native-webrtc mediaDevices is undefined");
    }

    if (!this.peerConnection) {
      throw new Error("PeerConnection is not created");
    }

    console.log("WEBRTC: requesting microphone");

    const stream = await mediaDevices.getUserMedia({
      audio: true,

      video: false,
    });

    console.log("WEBRTC: microphone stream received");

    this.localStream = stream;

    console.log("WEBRTC: localStream assigned");

    // -----------------------------------------------------
    // IMPORTANT
    // -----------------------------------------------------

    const audioTracks = stream.getAudioTracks();

    console.log("WEBRTC: audio track count:", audioTracks.length);

    for (const track of audioTracks) {
      console.log("WEBRTC: audio track:", track);

      console.log("WEBRTC: BEFORE addTrack");

      this.peerConnection.addTrack(track, stream);

      console.log("WEBRTC: AFTER addTrack");
    }

    console.log("WEBRTC: local audio added successfully");

    return stream;
  }

  // =========================================================
  // CREATE OFFER
  // =========================================================

  async createOffer() {
    console.log("WEBRTC: createOffer START");

    if (!this.peerConnection) {
      throw new Error("PeerConnection is null");
    }

    console.log("WEBRTC: createOffer:", typeof this.peerConnection.createOffer);

    const offer = await this.peerConnection.createOffer();

    console.log("WEBRTC: offer created");

    console.log("WEBRTC: offer type:", offer.type);
    console.log("WEBRTC: SDP length:", offer.sdp?.length);

    const sessionDescription = new RTCSessionDescription({
      type: offer.type,
      sdp: offer.sdp,
    });

    console.log("WEBRTC: RTCSessionDescription CREATED");

    console.log("WEBRTC: LOCAL DESCRIPTION SET");

    await this.peerConnection.setLocalDescription(offer);

    console.log("WEBRTC: local description set");

    await this.waitForIce();

    console.log("WEBRTC: ICE gathering complete");

    return this.peerConnection.localDescription;
    // return offer
  }

  // =========================================================
  // SET OFFER
  // =========================================================

  async setOffer(offer) {
    console.log("WEBRTC: setOffer");

    if (!this.peerConnection) {
      throw new Error("PeerConnection is null");
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer),
    );
  }

  // =========================================================
  // CREATE ANSWER
  // =========================================================

  async createAnswer() {
    console.log("WEBRTC: createAnswer");

    if (!this.peerConnection) {
      throw new Error("PeerConnection is null");
    }

    const answer = await this.peerConnection.createAnswer();

    await this.peerConnection.setLocalDescription(answer);

    await this.waitForIce();

    return this.peerConnection.localDescription;
  }

  async createAnswer(offer) {
    if (!this.peerConnection) {
      throw new Error("PeerConnection not created");
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer),
    );

    const answer = await this.peerConnection.createAnswer();

    await this.peerConnection.setLocalDescription(answer);

    console.log("ANSWER CREATED:", answer);

    return answer;
  }

  // =========================================================
  // SET ANSWER
  // =========================================================

  async setAnswer(answer) {
    console.log("WEBRTC: setAnswer");

    if (!this.peerConnection) {
      throw new Error("PeerConnection is null");
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer),
    );
  }

  // =========================================================
  // ICE CANDIDATE
  // =========================================================

  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      console.log("WEBRTC: PeerConnection not ready");

      return;
    }

    if (!candidate) {
      return;
    }

    console.log("WEBRTC: adding ICE candidate");

    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // =========================================================
  // DATA CHANNEL
  // =========================================================

  createDataChannel() {
    if (!this.peerConnection) {
      console.log("WEBRTC: PeerConnection not ready");

      return;
    }

    console.log("WEBRTC: creating DataChannel");

    const channel = this.peerConnection.createDataChannel("chat");

    this.setupDataChannel(channel);
  }

  setupDataChannel(channel) {
    if (!channel) {
      return;
    }

    this.dataChannel = channel;

    channel.onopen = () => {
      console.log("CHAT CONNECTED");
    };

    channel.onclose = () => {
      console.log("CHAT CLOSED");
    };

    channel.onerror = (error) => {
      console.log("CHAT ERROR", error);
    };

    channel.onmessage = (event) => {
      console.log("MESSAGE:", event.data);

      if (this.messageCallback) {
        this.messageCallback(event.data);
      }
    };
  }

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  sendMessage(message) {
    if (!this.dataChannel) {
      return false;
    }

    if (this.dataChannel.readyState !== "open") {
      return false;
    }

    this.dataChannel.send(message);

    return true;
  }

  // =========================================================
  // WAIT FOR ICE
  // =========================================================

  waitForIce() {
    return new Promise((resolve) => {
      if (!this.peerConnection) {
        resolve();

        return;
      }

      if (this.peerConnection.iceGatheringState === "complete") {
        resolve();

        return;
      }

      const timeout = setTimeout(resolve, 10000);

      const handler = () => {
        if (!this.peerConnection) {
          clearTimeout(timeout);

          resolve();

          return;
        }

        if (this.peerConnection.iceGatheringState === "complete") {
          clearTimeout(timeout);

          resolve();
        }
      };

      this.peerConnection.onicegatheringstatechange = handler;
    });
  }

  // =========================================================
  // CALLBACKS
  // =========================================================

  setMessageCallback(callback) {
    this.messageCallback = callback;
  }

  setConnectionCallback(callback) {
    this.connectionCallback = callback;
  }

  setRemoteStreamCallback(callback) {
    this.remoteStreamCallback = callback;
  }

  // ==========================================
  // SPEAKER
  // ==========================================

  setSpeaker(enabled) {
    console.log("Speaker:", enabled);

    InCallManager.setSpeakerphoneOn(enabled);
  }

  // =========================================================
  // MUTE
  // =========================================================

  mute(muted) {
    if (!this.localStream) {
      return;
    }

    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  // const toggleMute = () => {

  //     const newValue =
  //         !muted;

  //     setMuted(
  //         newValue
  //     );

  //     WebRTCService.toggleMute(
  //         newValue
  //     );
  // };

  // =========================================================
  // CLOSE
  // =========================================================

  close() {
    console.log("WEBRTC: closing");

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });

      this.localStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();

      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();

      this.peerConnection = null;
    }
  }
}

export default new WebRTCService();
