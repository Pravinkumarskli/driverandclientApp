const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const customers = [
  {
    id: "customer_101",
    name: "Customer 101",
    phone: "+91 98765 43210",
  },
  {
    id: "customer_102",
    name: "Customer 102",
    phone: "+91 98765 43211",
  },
];

const drivers = [
  {
    id: "driver_201",
    name: "Arun",
    car: "Prime Sedan (TN 01 AB 1234)",
    phone: "+91 98765 11201",
    rating: 4.8,
  },
  {
    id: "driver_202",
    name: "Kumar",
    car: "Mini Hatchback (TN 01 CD 5678)",
    phone: "+91 98765 11202",
    rating: 4.7,
  },
  {
    id: "driver_203",
    name: "Ravi",
    car: "Auto Rickshaw (TN 01 EF 9012)",
    phone: "+91 98765 11203",
    rating: 4.9,
  },
];

// Map of userId -> Set of socket.id
const connectedUsers = new Map();

function addUserSocket(userId, socketId) {
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socketId);
}

function removeUserSocket(userId, socketId) {
  if (connectedUsers.has(userId)) {
    const set = connectedUsers.get(userId);
    set.delete(socketId);
    if (set.size === 0) {
      connectedUsers.delete(userId);
    }
  }
}

function emitToUser(userId, event, data) {
  if (connectedUsers.has(userId)) {
    const socketIds = connectedUsers.get(userId);
    for (const socketId of socketIds) {
      io.to(socketId).emit(event, data);
    }
    return true;
  }
  return false;
}

function isUserOnline(userId) {
  return connectedUsers.has(userId) && connectedUsers.get(userId).size > 0;
}

// Map of driverId -> last known location
const driverLocations = new Map();

driverLocations.set("driver_201", {
  driverId: "driver_201",
  latitude: 12.0125,
  longitude: 79.855,
  accuracy: 5,
  speed: 35,
  heading: 90,
  timestamp: Date.now(),
});

// Map of customerId -> driverId tracking relationship
const activeTracking = new Map();

// In-memory conversation store: conversationId -> array of messages
const conversations = new Map();

const getConversationId = (firstUserId, secondUserId) =>
  [firstUserId, secondUserId].sort().join("_");

function broadcastUserLists() {
  const driverList = drivers.map((driver) => ({
    ...driver,
    online: isUserOnline(driver.id),
  }));

  const customerList = customers.map((customer) => ({
    ...customer,
    online: isUserOnline(customer.id),
  }));

  io.emit("driverList", driverList);
  io.emit("customerList", customerList);
}

// REST endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    connectedUsersCount: connectedUsers.size,
    activeTrackingCount: activeTracking.size,
  });
});

app.get("/api/driver/:driverId/location", (req, res) => {
  const { driverId } = req.params;
  const location = driverLocations.get(driverId);

  if (!location) {
    return res.status(404).json({
      success: false,
      message: "Driver location not available",
    });
  }

  res.json({
    success: true,
    driverId,
    location,
  });
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("🔌 SOCKET CONNECTED:", socket.id);

  // ------------------------------------------
  // REGISTRATION
  // ------------------------------------------
  socket.on("register", (userId, ack) => {
    if (!userId) return;

    addUserSocket(userId, socket.id);
    socket.userId = userId;

    console.log(`👤 USER REGISTERED: ${userId} (Socket: ${socket.id})`);
    broadcastUserLists();
    ack?.({ success: true, userId, socketId: socket.id });
  });

  // ------------------------------------------
  // CHAT / MESSAGING (DRIVER <-> CLIENT)
  // ------------------------------------------
  socket.on("sendMessage", (data, acknowledge) => {
    console.log("💬 SEND MESSAGE:", data);

    const senderId = data?.senderId || socket.userId;
    const receiverId = data?.receiverId;
    const text = typeof data?.message === "string" ? data.message.trim() : "";

    if (!senderId || !receiverId || !text) {
      console.log("❌ INVALID MESSAGE DATA:", data);
      acknowledge?.({ success: false, message: "Invalid message parameters" });
      return;
    }

    if (!socket.userId) {
      socket.userId = senderId;
      addUserSocket(senderId, socket.id);
    }

    const conversationId = getConversationId(senderId, receiverId);
    const messageObj = {
      id: data.id || `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      conversationId,
      senderId,
      receiverId,
      message: text,
      type: data.type || "text",
      timestamp: data.timestamp || Date.now(),
      status: "sent",
    };

    const history = conversations.get(conversationId) || [];
    history.push(messageObj);
    conversations.set(conversationId, history);

    // Deliver to all active sockets of receiver
    const delivered = emitToUser(receiverId, "receiveMessage", messageObj);
    if (delivered) {
      console.log(`📨 DELIVERED MESSAGE TO ${receiverId}`);
      messageObj.status = "delivered";
    } else {
      console.log(`⚠️ RECEIVER OFFLINE: ${receiverId}`);
    }

    // Also broadcast to other active sockets of sender (e.g. multi-device sync)
    if (connectedUsers.has(senderId)) {
      for (const sId of connectedUsers.get(senderId)) {
        if (sId !== socket.id) {
          io.to(sId).emit("receiveMessage", messageObj);
        }
      }
    }

    socket.emit("messageDelivered", messageObj);
    acknowledge?.({ success: true, message: messageObj });
  });

  socket.on("getMessages", (data, acknowledge) => {
    const { userId, receiverId } = data || {};
    const sender = userId || socket.userId;

    if (!sender || !receiverId) {
      acknowledge?.({ success: false, messages: [] });
      return;
    }

    const conversationId = getConversationId(sender, receiverId);
    const messages = conversations.get(conversationId) || [];
    console.log(
      `📜 GET MESSAGES for ${conversationId}: ${messages.length} messages`,
    );

    acknowledge?.({
      success: true,
      conversationId,
      messages,
    });
  });

  // ------------------------------------------
  // GPS TRACKING
  // ------------------------------------------
  socket.on("startTracking", (data) => {
    const { customerId, driverId } = data || {};
    console.log(
      `📍 START TRACKING: Customer ${customerId} -> Driver ${driverId}`,
    );

    if (!customerId || !driverId) return;

    activeTracking.set(customerId, driverId);

    // Notify driver
    emitToUser(driverId, "trackingStarted", { customerId, driverId });

    // Send last location immediately
    const lastLocation = driverLocations.get(driverId);
    if (lastLocation) {
      socket.emit("driverLocationUpdate", lastLocation);
      console.log("📍 SENT LAST LOCATION TO CUSTOMER:", lastLocation);
    }
  });

  socket.on("driverLocation", (data) => {
    const {
      driverId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      timestamp,
    } = data || {};

    if (!driverId || latitude === undefined || longitude === undefined) {
      return;
    }

    const location = {
      driverId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy !== undefined ? Number(accuracy) : 5,
      speed: speed !== undefined ? Number(speed) : 0,
      heading: heading !== undefined ? Number(heading) : 0,
      timestamp: timestamp || Date.now(),
    };

    driverLocations.set(driverId, location);

    // Broadcast to all customers actively tracking this driver
    for (const [customerId, trackingDriverId] of activeTracking.entries()) {
      if (trackingDriverId === driverId) {
        emitToUser(customerId, "driverLocationUpdate", location);
      }
    }
  });

  socket.on("stopTracking", (data) => {
    const { customerId } = data || {};
    if (!customerId) return;

    const driverId = activeTracking.get(customerId);
    activeTracking.delete(customerId);
    console.log(`⏹️ STOPPED TRACKING: ${customerId} -> ${driverId}`);

    if (driverId) {
      emitToUser(driverId, "trackingStopped", { customerId, driverId });
    }
  });

  // ------------------------------------------
  // VOICE CALLING / WEBRTC SIGNALING
  // ------------------------------------------
  socket.on("callUser", (data) => {
    const senderId = data.senderId || data.callerId || socket.userId;
    const receiverId = data.receiverId;
    const senderName =
      data.senderName ||
      data.callerName ||
      (senderId?.startsWith("customer_") ? "Customer" : "Driver");
    const offer = data.offer;
    const callType = data.callType || "voice";

    console.log(`📞 CALL USER: ${senderId} -> ${receiverId}`);

    if (!isUserOnline(receiverId)) {
      console.log(`❌ RECEIVER NOT ONLINE FOR CALL: ${receiverId}`);
      socket.emit("callFailed", { message: "User is offline" });
      return;
    }

    emitToUser(receiverId, "incomingCall", {
      callerId: senderId,
      callerName: senderName,
      senderId,
      senderName,
      receiverId,
      offer,
      callType,
    });
  });

  socket.on("acceptCall", (data) => {
    const callerId = data.callerId || data.senderId;
    const receiverId = data.receiverId;
    console.log(`✅ CALL ACCEPTED: ${receiverId} accepted ${callerId}`);
    emitToUser(callerId, "callAccepted", data);
  });

  socket.on("rejectCall", (data) => {
    const callerId = data.callerId || data.senderId;
    const receiverId = data.receiverId;
    console.log(`❌ CALL REJECTED: ${receiverId} rejected ${callerId}`);
    emitToUser(callerId, "callRejected", data);
  });

  socket.on("endCall", (data) => {
    const peerId = data.receiverId || data.callerId || data.senderId;
    console.log(`📴 CALL ENDED with: ${peerId}`);
    if (peerId) {
      emitToUser(peerId, "callEnded", data);
    }
  });

  socket.on("offer", (data) => {
    emitToUser(data.receiverId, "offer", data);
  });

  socket.on("webrtcOffer", (data) => {
    emitToUser(data.receiverId, "webrtcOffer", data);
  });

  socket.on("answer", (data) => {
    emitToUser(data.receiverId, "answer", data);
  });

  socket.on("webrtcAnswer", (data) => {
    emitToUser(data.receiverId, "webrtcAnswer", data);
  });

  socket.on("iceCandidate", (data) => {
    emitToUser(data.receiverId, "iceCandidate", data);
  });

  socket.on("webrtcIceCandidate", (data) => {
    emitToUser(data.receiverId, "webrtcIceCandidate", data);
  });

  // ------------------------------------------
  // DISCONNECT
  // ------------------------------------------
  socket.on("disconnect", () => {
    if (socket.userId) {
      removeUserSocket(socket.userId, socket.id);
      console.log(
        `🔌 USER DISCONNECTED: ${socket.userId} (Socket: ${socket.id})`,
      );
      broadcastUserLists();
    }
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 CAB SERVER RUNNING ON PORT ${port}`);
  console.log(`📡 Socket.io ready for Driver & Client connections`);
});
