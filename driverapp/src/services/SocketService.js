import { io } from "socket.io-client";

// Configured for local Wi-Fi / physical devices & emulator
const SERVER_URL = "http://192.168.1.104:3000";

class SocketService {
  socket = null;
  currentUserId = null;

  connect(userId) {
    this.currentUserId = userId;

    if (this.socket) {
      if (this.socket.connected && userId) {
        this.socket.emit("register", userId);
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
        this.socket.emit("register", this.currentUserId);
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
  // CALLING & WEBRTC
  // ------------------------------------------
  callUser(callerId, receiverId, callerName = "Driver") {
    this.socket?.emit("callUser", {
      callerId,
      senderId: callerId,
      receiverId,
      callerName,
      senderName: callerName,
    });
  }

  acceptCall(callerId, receiverId) {
    this.socket?.emit("acceptCall", {
      callerId,
      receiverId,
    });
  }

  rejectCall(callerId, receiverId) {
    this.socket?.emit("rejectCall", {
      callerId,
      receiverId,
    });
  }

  endCall(callerId, receiverId) {
    this.socket?.emit("endCall", {
      callerId,
      receiverId,
    });
  }

  sendOffer(callerId, receiverId, offer) {
    this.socket?.emit("webrtcOffer", {
      callerId,
      receiverId,
      offer,
    });
  }

  sendAnswer(callerId, receiverId, answer) {
    this.socket?.emit("webrtcAnswer", {
      callerId,
      receiverId,
      answer,
    });
  }

  sendIceCandidate(callerId, receiverId, candidate) {
    this.socket?.emit("webrtcIceCandidate", {
      callerId,
      receiverId,
      candidate,
    });
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
