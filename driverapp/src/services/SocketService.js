import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/AppConfig";

const SERVER_URL = SOCKET_URL;

class SocketService {
  socket = null;
  currentUserId = null;

  connect(userId) {
    this.currentUserId = userId;

    if (this.socket) {
      if (this.socket.connected && userId) {
        this.socket.emit("register", { userId, userType: "driver" });
      }
      return;
    }

    console.log("DRIVER SOCKET CONNECTING:", userId, "to", SERVER_URL);

    this.socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("DRIVER SOCKET CONNECTED:", this.socket.id);
      if (this.currentUserId) {
        this.socket.emit("register", {
          userId: this.currentUserId,
          userType: "driver",
        });
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log("DRIVER SOCKET DISCONNECTED:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.log("DRIVER SOCKET CONNECT ERROR:", error?.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ------------------------------------------
  // CHAT / MESSAGING
  // ------------------------------------------
  sendMessage(data, callback) {
    if (!this.socket) {
      console.log("SEND MSG ERROR: Socket not connected");
      callback?.({ success: false, message: "Socket not connected" });
      return;
    }

    this.socket.emit("sendMessage", data, (response) => {
      callback?.(response);
    });
  }

  getMessages(userId, receiverId, callback) {
    if (!this.socket) {
      callback?.({ success: false, messages: [] });
      return;
    }

    this.socket.emit("getMessages", { userId, receiverId }, (response) => {
      callback?.(response);
    });
  }

  // ------------------------------------------
  // GPS BROADCAST
  // ------------------------------------------
  sendLocation(locationData) {
    if (!this.socket) return;
    this.socket.emit("driverLocation", locationData);
  }

  // ------------------------------------------
  // CALLING & WEBRTC VOICE
  // ------------------------------------------
  sendCall(data) {
    this.socket?.emit("callUser", data);
  }

  callUser(callerId, receiverId, callerName = "Driver", offer = null) {
    this.socket?.emit("callUser", {
      callerId,
      senderId: callerId,
      receiverId,
      callerName,
      senderName: callerName,
      offer,
    });
  }

  acceptCall(callerId, receiverId) {
    this.socket?.emit("acceptCall", {
      callerId,
      receiverId,
      senderId: this.currentUserId,
    });
  }

  rejectCall(callerId, receiverId) {
    this.socket?.emit("rejectCall", {
      callerId,
      receiverId,
      senderId: this.currentUserId,
    });
  }

  endCall(data) {
    if (typeof data === "object") {
      this.socket?.emit("endCall", data);
    } else {
      this.socket?.emit("endCall", {
        senderId: this.currentUserId,
        receiverId: data,
      });
    }
  }

  sendOffer(data) {
    this.socket?.emit("offer", data);
  }

  sendAnswer(data) {
    this.socket?.emit("answer", data);
  }

  sendIceCandidate(data) {
    this.socket?.emit("iceCandidate", data);
  }

  onIncomingCall(callback) {
    this.on("incomingCall", callback);
  }

  onCallAccepted(callback) {
    this.on("callAccepted", callback);
  }

  onCallRejected(callback) {
    this.on("callRejected", callback);
  }

  onCallEnded(callback) {
    this.on("callEnded", callback);
  }

  onOffer(callback) {
    this.on("offer", callback);
  }

  onAnswer(callback) {
    this.on("answer", callback);
  }

  onIceCandidate(callback) {
    this.on("iceCandidate", callback);
  }

  // ------------------------------------------
  // GENERIC LISTENERS
  // ------------------------------------------
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export default new SocketService();
