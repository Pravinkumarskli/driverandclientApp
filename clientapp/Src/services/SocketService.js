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
        this.socket.emit("register", { userId, userType: "client" });
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
        this.socket.emit("register", {
          userId: this.currentUserId,
          userType: "client",
        });
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

  sendCall(data) {
    this.socket?.emit("callUser", data);
  }

  callUser(callerId, receiverId, callerName = "Customer", offer = null) {
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
    if (typeof callerId === "object" && callerId !== null) {
      const cId = callerId.callerId || callerId.receiverId;
      const sId = callerId.senderId || this.currentUserId;
      this.socket?.emit("acceptCall", {
        ...callerId,
        callerId: cId,
        receiverId: cId,
        senderId: sId,
      });
    } else {
      this.socket?.emit("acceptCall", {
        callerId,
        receiverId: receiverId || callerId,
        senderId: this.currentUserId,
      });
    }
  }

  rejectCall(callerId, receiverId) {
    if (typeof callerId === "object" && callerId !== null) {
      const cId = callerId.callerId || callerId.receiverId;
      const sId = callerId.senderId || this.currentUserId;
      this.socket?.emit("rejectCall", {
        ...callerId,
        callerId: cId,
        receiverId: cId,
        senderId: sId,
      });
    } else {
      this.socket?.emit("rejectCall", {
        callerId,
        receiverId: receiverId || callerId,
        senderId: this.currentUserId,
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

  endCall(data) {
    if (typeof data === "object" && data !== null) {
      const recId = data.receiverId || data.callerId || data.target;
      const sendId = data.senderId || this.currentUserId;
      this.socket?.emit("endCall", {
        ...data,
        senderId: sendId,
        receiverId: recId,
      });
    } else {
      this.socket?.emit("endCall", {
        senderId: this.currentUserId,
        receiverId: data,
      });
    }
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

  sendCustomerLocation(locationData) {
    this.socket?.emit("customerLocation", {
      customerId: this.currentUserId,
      ...locationData,
    });
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
