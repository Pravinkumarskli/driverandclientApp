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

    console.log("SOCKET CONNECTING:", userId, "to", SERVER_URL);

    this.socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("SOCKET CONNECTED:", this.socket.id);
      if (this.currentUserId) {
        this.socket.emit("register", this.currentUserId);
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log("SOCKET DISCONNECTED:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.log("SOCKET CONNECT ERROR:", error?.message);
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
      callback?.({ success: false, message: "Socket is not connected" });
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
  // DRIVER LIST & CALL EVENTS
  // ------------------------------------------
  onDriverList(callback) {
    this.on("driverList", callback);
  }

  onIncomingCall(callback) {
    this.on("incomingCall", callback);
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

  sendCall(data) {
    this.socket?.emit("callUser", data);
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

  endCall(data) {
    this.socket?.emit("endCall", data);
  }

  rejectCall(data) {
    this.socket?.emit("rejectCall", data);
  }

  // ------------------------------------------
  // GPS TRACKING
  // ------------------------------------------
  startTracking(customerId, driverId) {
    if (!this.socket) {
      console.log("TRACKING: Socket not initialized");
      return;
    }

    console.log("START DRIVER TRACKING:", customerId, "->", driverId);
    this.socket.emit("startTracking", { customerId, driverId });
  }

  stopTracking(customerId) {
    if (!this.socket) return;
    console.log("STOP DRIVER TRACKING:", customerId);
    this.socket.emit("stopTracking", { customerId });
  }

  onDriverLocation(callback) {
    this.on("driverLocationUpdate", callback);
  }

  removeDriverLocationListener() {
    this.off("driverLocationUpdate");
  }

  // ------------------------------------------
  // GENERIC EVENT LISTENERS
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
