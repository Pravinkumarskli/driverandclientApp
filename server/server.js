const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server: SocketIOServer } = require('socket.io');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Initialize Socket.io Server
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Initialize Native WebSocket Server (handles Android OkHttp connections)
const wss = new WebSocket.Server({ noServer: true });

// Handle upgrade for Native WebSocket vs Socket.io
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;
  if (pathname && pathname.startsWith('/socket.io')) return;
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// ─────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────
const nativeSockets   = new Map(); // userId -> Set<WebSocket>
const socketIoSockets = new Map(); // userId -> Set<socketId>
const userRegistry    = new Map(); // userId -> { userId, userType, name, online, loginTime }
const conversationHistory = new Map(); // conversationId -> Message[]
const activeTracking  = new Map(); // customerId -> driverId
const driverLocations = new Map(); // driverId -> location
const customerLocations = new Map(); // customerId -> location

function getConversationId(id1, id2) {
  return [id1, id2].sort().join('_');
}

function getUserLabel(userId) {
  const info = userRegistry.get(userId);
  if (!info) return userId;
  const name = info.name ? ` (${info.name})` : '';
  return `${userId}${name} [${info.userType || '?'}]`;
}

function now() {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────
// UNIFIED EMIT HELPER (NATIVE WS + SOCKET.IO)
// ─────────────────────────────────────────────────────────────
function emitToUser(userId, eventName, data) {
  let delivered = false;

  if (!userId) return false;

  // 1. Native Android WebSocket connections
  if (nativeSockets.has(userId)) {
    const wsSet = nativeSockets.get(userId);
    const payload = JSON.stringify({ ...data, type: eventName });
    for (const ws of wsSet) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
          delivered = true;
        } catch (e) {
          console.error(`   ❌ Error sending to native WS for ${userId}:`, e.message);
        }
      }
    }
  }

  // 2. Socket.io connections
  if (socketIoSockets.has(userId)) {
    const sIdSet = socketIoSockets.get(userId);
    for (const sId of sIdSet) {
      io.to(sId).emit(eventName, data);
      delivered = true;
    }
  }

  return delivered;
}

// ─────────────────────────────────────────────────────────────
// 1. NATIVE ANDROID WEBSOCKET HANDLER
// ─────────────────────────────────────────────────────────────
let socketSeq = 1;

wss.on('connection', (ws, req) => {
  const socketId   = `ws_${socketSeq++}_${Date.now().toString(36)}`;
  const remoteIp   = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  const connectedAt = now();

  let authUserId   = null;
  let authUserType = 'unknown';
  let authUserName = '';

  console.log(`\n${'═'.repeat(58)}`);
  console.log(`⚡  NEW NATIVE WS CONNECTION`);
  console.log(`   Socket    : ${socketId}`);
  console.log(`   IP        : ${remoteIp}`);
  console.log(`   Time      : ${connectedAt}`);
  console.log(`   Total     : ${wss.clients.size} connected`);
  console.log(`${'═'.repeat(58)}\n`);

  ws.on('message', (buffer) => {
    try {
      const data = JSON.parse(buffer.toString());
      const { type } = data;

      // ── REGISTER ──────────────────────────────────────────
      if (type === 'register') {
        authUserId   = data.userId;
        authUserType = data.userType || 'unknown';
        authUserName = data.userName || data.name || '';

        if (!nativeSockets.has(authUserId)) {
          nativeSockets.set(authUserId, new Set());
        }
        nativeSockets.get(authUserId).add(ws);

        userRegistry.set(authUserId, {
          userId:    authUserId,
          userType:  authUserType,
          name:      authUserName,
          online:    true,
          loginTime: now(),
        });

        const socketCount = nativeSockets.get(authUserId).size;
        const totalOnline = nativeSockets.size;

        console.log(`\n🟢 LOGIN  ─── ${authUserType.toUpperCase()} LOGGED IN ───────────────────`);
        console.log(`   User ID   : ${authUserId}`);
        if (authUserName) console.log(`   Name      : ${authUserName}`);
        console.log(`   Socket    : ${socketId}`);
        console.log(`   Sockets   : ${socketCount} (this user) | ${totalOnline} unique users online`);
        console.log(`   Time      : ${now()}`);
        console.log(`${'─'.repeat(58)}\n`);

        ws.send(JSON.stringify({
          type:      'registerSuccess',
          userId:    authUserId,
          userType:  authUserType,
          timestamp: Date.now(),
        }));
        return;
      }

      // ── PING / PONG ───────────────────────────────────────
      if (type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      // ── SEND MESSAGE ──────────────────────────────────────
      if (type === 'sendMessage') {
        const {
          messageId   = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          senderId    = authUserId,
          receiverId,
          senderType  = authUserType,
          receiverType = (senderType === 'client' ? 'driver' : 'client'),
          message,
          messageType = 'text',
        } = data;

        if (!senderId || !receiverId || !message) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing senderId, receiverId, or message' }));
          return;
        }

        const conversationId = getConversationId(senderId, receiverId);
        const messageObject = {
          id:           messageId,
          messageId,
          conversationId,
          senderId,
          receiverId,
          senderType,
          receiverType,
          message:      message.trim(),
          type:         'receiveMessage',
          messageType,
          timestamp:    data.timestamp || Date.now(),
          status:       'delivered',
        };

        // Store in-memory history
        if (!conversationHistory.has(conversationId)) {
          conversationHistory.set(conversationId, []);
        }
        conversationHistory.get(conversationId).push(messageObject);

        // Deliver to receiver
        const isDelivered = emitToUser(receiverId, 'receiveMessage', messageObject);

        const senderInfo   = getUserLabel(senderId);
        const receiverInfo = getUserLabel(receiverId);

        console.log(`\n💬 MESSAGE ────────────────────────────────────────────`);
        console.log(`   FROM      : ${senderInfo}`);
        console.log(`   TO        : ${receiverInfo}`);
        console.log(`   Msg ID    : ${messageId}`);
        console.log(`   Text      : "${messageObject.message}"`);
        console.log(`   Delivered : ${isDelivered ? '✅ Yes' : '❌ No (offline/not connected)'}`);
        console.log(`   Time      : ${now()}`);
        console.log(`${'─'.repeat(58)}\n`);

        // Delivery ACK back to sender
        ws.send(JSON.stringify({
          type:         'messageDelivered',
          messageId,
          conversationId,
          status:       isDelivered ? 'delivered' : 'sent',
          timestamp:    Date.now(),
          message:      messageObject,
        }));
        return;
      }

      // ── GET MESSAGES (history fetch from native WS) ──────
      if (type === 'getMessages') {
        const senderId = data.userId || authUserId;
        const otherUserId = data.otherUserId || data.receiverId;
        if (!senderId || !otherUserId) {
          ws.send(JSON.stringify({ type: 'getMessagesResponse', success: false, messages: [] }));
          return;
        }
        const conversationId = getConversationId(senderId, otherUserId);
        const msgs = conversationHistory.get(conversationId) || [];
        console.log(`\n📋 GET MESSAGES (Native WS) ─────────────────────────────`);
        console.log(`   User      : ${getUserLabel(senderId)}`);
        console.log(`   Other     : ${getUserLabel(otherUserId)}`);
        console.log(`   Conv ID   : ${conversationId}`);
        console.log(`   Messages  : ${msgs.length}`);
        console.log(`${'─'.repeat(58)}\n`);
        ws.send(JSON.stringify({
          type: 'getMessagesResponse',
          success: true,
          conversationId,
          messages: msgs,
        }));
        return;
      }

      // ── GPS LOCATION ──────────────────────────────────────
      if (type === 'customerLocation') {
        const customerId = data.customerId || authUserId;
        if (!customerId) return;
        const loc = {
          customerId,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          accuracy: Number(data.accuracy || 5),
          heading: Number(data.heading || 0),
          timestamp: data.timestamp || Date.now(),
        };
        if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;
        customerLocations.set(customerId, loc);
        const driverId = activeTracking.get(customerId);
        if (driverId) emitToUser(driverId, 'customerLocationUpdate', loc);
        io.emit('customerLocationUpdate', loc);
        return;
      }

      if (type === 'sendLocation' || type === 'driverLocation') {
        const driverId = data.driverId || authUserId;
        const loc = {
          driverId,
          latitude:  Number(data.latitude),
          longitude: Number(data.longitude),
          accuracy:  Number(data.accuracy || 5),
          speed:     Number(data.speed || 0),
          heading:   Number(data.heading || 0),
          timestamp: data.timestamp || Date.now(),
        };
        driverLocations.set(driverId, loc);

        console.log(`\n📍 [NATIVE WS LOCATION] Driver: ${driverId} ──────────────────────`);
        console.log(`   Latitude  : ${loc.latitude}`);
        console.log(`   Longitude : ${loc.longitude}`);
        console.log(`   Speed     : ${loc.speed} | Accuracy: ±${loc.accuracy}m | Heading: ${loc.heading}°`);
        console.log(`   Time      : ${now()}`);
        console.log(`${'─'.repeat(58)}\n`);

        for (const [customerId, trackedDriverId] of activeTracking.entries()) {
          if (trackedDriverId === driverId) {
            emitToUser(customerId, 'driverLocationUpdate', loc);
          }
        }
        // Broadcast to all connected clients
        io.emit('driverLocationUpdate', loc);
        io.emit('driverLocation', loc);
        return;
      }

      // ── CALLING EVENTS (NATIVE WS) ────────────────────────
      if (type === 'callUser') {
        const receiverId = data.receiverId || data.target;
        const callerId = data.callerId || data.senderId || authUserId;
        const callerName = data.callerName || data.senderName || userRegistry.get(callerId)?.name || callerId;
        console.log(`\n📞 [CALL USER (Native WS)] ${callerId} ➔ ${receiverId} (Caller: ${callerName})`);
        emitToUser(receiverId, 'incomingCall', {
          ...data,
          type: 'incomingCall',
          callerId,
          senderId: callerId,
          receiverId,
          callerName,
        });
        return;
      }

      if (type === 'endCall' || type === 'rejectCall' || type === 'callEnded') {
        const otherParty = data.receiverId || data.callerId || data.target;
        console.log(`\n🛑 [END/REJECT CALL (Native WS)] ➔ ${otherParty}`);
        if (otherParty) {
          emitToUser(otherParty, 'callEnded', {
            ...data,
            type: 'callEnded',
            senderId: authUserId,
          });
        }
        return;
      }

    } catch (e) {
      console.error(`❌ [Native WS] Error processing message on ${socketId}:`, e.message);
    }
  });

  ws.on('close', (code, reason) => {
    const reasonText = reason ? reason.toString() : '';
    if (authUserId && nativeSockets.has(authUserId)) {
      const set = nativeSockets.get(authUserId);
      set.delete(ws);
      if (set.size === 0) {
        nativeSockets.delete(authUserId);
        const user = userRegistry.get(authUserId);
        if (user) user.online = false;
      }
      console.log(`\n🔴 DISCONNECT ─── ${authUserType.toUpperCase()} LEFT ───────────────────`);
      console.log(`   User ID   : ${authUserId}`);
      if (authUserName) console.log(`   Name      : ${authUserName}`);
      console.log(`   Socket    : ${socketId}`);
      console.log(`   Code      : ${code}  Reason: ${reasonText || 'Normal closure'}`);
      console.log(`   Time      : ${now()}`);
      console.log(`   Remaining : ${wss.clients.size} native WS connection(s)`);
      console.log(`${'─'.repeat(58)}\n`);
    } else {
      console.log(`🔴 [Native WS] Unregistered socket ${socketId} closed (code: ${code})`);
    }
  });

  ws.on('error', (err) => {
    console.error(`❌ [Native WS] Socket ${socketId} | User: ${authUserId || 'unregistered'} | ${err.message}`);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. SOCKET.IO HANDLER (FOR REACT NATIVE WEBRTC CALLING & GPS)
// ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  let socketUserId = null;
  let socketUserType = 'unknown';

  socket.on('register', (data, callback) => {
    const userId   = typeof data === 'string' ? data : data?.userId;
    const userType = typeof data === 'object' ? data.userType : 'unknown';
    const userName = typeof data === 'object' ? (data.userName || data.name || '') : '';
    if (!userId) return;

    socketUserId   = userId;
    socketUserType = userType;

    if (!socketIoSockets.has(userId)) socketIoSockets.set(userId, new Set());
    socketIoSockets.get(userId).add(socket.id);

    userRegistry.set(userId, { userId, userType, name: userName, online: true, loginTime: now() });

    console.log(`\n🟢 LOGIN  ─── ${userType.toUpperCase()} LOGGED IN (Socket.io) ──────────`);
    console.log(`   User ID   : ${userId}`);
    if (userName) console.log(`   Name      : ${userName}`);
    console.log(`   Socket.io : ${socket.id}`);
    console.log(`   Time      : ${now()}`);
    console.log(`${'─'.repeat(58)}\n`);

    if (typeof callback === 'function') callback({ success: true, userId, socketId: socket.id });
  });

  socket.on('sendMessage', (data, callback) => {
    const senderId   = data.senderId || socketUserId;
    const receiverId = data.receiverId;
    const messageText = data.message;
    const messageId  = data.id || data.messageId || `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    if (!senderId || !receiverId || !messageText) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid message' });
      return;
    }

    const conversationId = getConversationId(senderId, receiverId);
    const messageObject = {
      id:           messageId,
      messageId,
      conversationId,
      senderId,
      receiverId,
      senderType:   data.senderType || socketUserType,
      receiverType: data.receiverType || (socketUserType === 'client' ? 'driver' : 'client'),
      message:      messageText,
      type:         'receiveMessage',
      timestamp:    data.timestamp || Date.now(),
      status:       'delivered',
    };

    if (!conversationHistory.has(conversationId)) conversationHistory.set(conversationId, []);
    conversationHistory.get(conversationId).push(messageObject);

    const isDelivered = emitToUser(receiverId, 'receiveMessage', messageObject);

    console.log(`\n💬 MESSAGE (Socket.io) ──────────────────────────────────`);
    console.log(`   FROM      : ${getUserLabel(senderId)}`);
    console.log(`   TO        : ${getUserLabel(receiverId)}`);
    console.log(`   Text      : "${messageText.trim()}"`);
    console.log(`   Delivered : ${isDelivered ? '✅ Yes' : '❌ No'}`);
    console.log(`   Time      : ${now()}`);
    console.log(`${'─'.repeat(58)}\n`);

    if (typeof callback === 'function') {
      callback({ success: true, message: { ...messageObject, status: isDelivered ? 'delivered' : 'sent' } });
    }
  });

  socket.on('getMessages', (data, callback) => {
    const { userId } = data || {};
    const otherUserId = data?.otherUserId || data?.receiverId;
    if (!userId || !otherUserId) {
      if (typeof callback === 'function') callback({ success: false, messages: [] });
      return;
    }
    const conversationId = getConversationId(userId, otherUserId);
    const msgs = conversationHistory.get(conversationId) || [];
    if (typeof callback === 'function') callback({ success: true, conversationId, messages: msgs });
  });

  socket.on('startTracking', (data) => {
    const { customerId, driverId } = data || {};
    if (!customerId || !driverId) return;
    activeTracking.set(customerId, driverId);
    const lastLoc = driverLocations.get(driverId);
    if (lastLoc) socket.emit('driverLocationUpdate', lastLoc);
    const customerLoc = customerLocations.get(customerId);
    if (customerLoc) emitToUser(driverId, 'customerLocationUpdate', customerLoc);
  });

  socket.on('stopTracking', (data) => {
    if (data?.customerId) activeTracking.delete(data.customerId);
  });

  socket.on('driverLocation', (data) => {
    const driverId = data.driverId || socketUserId;
    if (!driverId) return;
    const loc = {
      driverId,
      latitude:  Number(data.latitude),
      longitude: Number(data.longitude),
      accuracy:  Number(data.accuracy || 5),
      speed:     Number(data.speed || 0),
      heading:   Number(data.heading || 0),
      timestamp: data.timestamp || Date.now(),
    };
    driverLocations.set(driverId, loc);

    console.log(`\n📍 [SOCKET.IO LOCATION] Driver: ${driverId} ─────────────────────`);
    console.log(`   Latitude  : ${loc.latitude}`);
    console.log(`   Longitude : ${loc.longitude}`);
    console.log(`   Speed     : ${loc.speed} | Accuracy: ±${loc.accuracy}m | Heading: ${loc.heading}°`);
    console.log(`   Time      : ${now()}`);
    console.log(`${'─'.repeat(58)}\n`);

    for (const [customerId, trackedDriverId] of activeTracking.entries()) {
      if (trackedDriverId === driverId) emitToUser(customerId, 'driverLocationUpdate', loc);
    }
    io.emit('driverLocationUpdate', loc);
    io.emit('driverLocation', loc);
  });

  socket.on('sendLocation', (data) => {
    const driverId = data.driverId || socketUserId;
    if (!driverId) return;
    const loc = {
      driverId,
      latitude:  Number(data.latitude),
      longitude: Number(data.longitude),
      accuracy:  Number(data.accuracy || 5),
      speed:     Number(data.speed || 0),
      heading:   Number(data.heading || 0),
      timestamp: data.timestamp || Date.now(),
    };
    driverLocations.set(driverId, loc);

    console.log(`\n📍 [SOCKET.IO LOCATION] Driver: ${driverId} ─────────────────────`);
    console.log(`   Latitude  : ${loc.latitude}`);
    console.log(`   Longitude : ${loc.longitude}`);
    console.log(`   Speed     : ${loc.speed} | Accuracy: ±${loc.accuracy}m | Heading: ${loc.heading}°`);
    console.log(`   Time      : ${now()}`);
    console.log(`${'─'.repeat(58)}\n`);

    for (const [customerId, trackedDriverId] of activeTracking.entries()) {
      if (trackedDriverId === driverId) emitToUser(customerId, 'driverLocationUpdate', loc);
    }
    io.emit('driverLocationUpdate', loc);
    io.emit('driverLocation', loc);
  });

  socket.on('customerLocation', (data) => {
    const customerId = data.customerId || socketUserId;
    if (!customerId) return;
    const loc = {
      customerId,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      accuracy: Number(data.accuracy || 5),
      heading: Number(data.heading || 0),
      timestamp: data.timestamp || Date.now(),
    };
    if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;
    customerLocations.set(customerId, loc);
    const driverId = activeTracking.get(customerId);
    if (driverId) emitToUser(driverId, 'customerLocationUpdate', loc);
    io.emit('customerLocationUpdate', loc);
  });

  socket.on('callUser', (data) => {
    const receiverId = data.receiverId || data.target;
    const callerId = data.callerId || data.senderId || socketUserId;
    const callerName = data.callerName || data.senderName || userRegistry.get(callerId)?.name || callerId;
    console.log(`\n📞 [CALL USER] ${callerId} ➔ ${receiverId} (Caller: ${callerName})`);
    emitToUser(receiverId, 'incomingCall', {
      ...data,
      type: 'incomingCall',
      callerId,
      senderId: callerId,
      receiverId,
      callerName,
    });
  });

  socket.on('acceptCall', (data) => {
    let targetCallerId;
    let answeringUserId;
    if (typeof data === 'string') {
      targetCallerId = data;
      answeringUserId = socketUserId;
    } else if (typeof data === 'object' && data !== null) {
      targetCallerId = data.callerId || data.receiverId || data.target;
      answeringUserId = data.senderId || socketUserId;
    }
    console.log(`\n✅ [CALL ACCEPTED] Call accepted by ${answeringUserId} ➔ Notifying caller: ${targetCallerId}`);
    if (targetCallerId) {
      emitToUser(targetCallerId, 'callAccepted', {
        ...data,
        callerId: targetCallerId,
        senderId: answeringUserId,
      });
    }
  });

  socket.on('rejectCall', (data) => {
    let targetCallerId;
    let rejectingUserId;
    if (typeof data === 'string') {
      targetCallerId = data;
      rejectingUserId = socketUserId;
    } else if (typeof data === 'object' && data !== null) {
      targetCallerId = data.callerId || data.receiverId || data.target;
      rejectingUserId = data.senderId || socketUserId;
    }
    console.log(`\n❌ [CALL REJECTED] Call declined by ${rejectingUserId} ➔ Notifying: ${targetCallerId}`);
    if (targetCallerId) {
      emitToUser(targetCallerId, 'callRejected', {
        ...data,
        callerId: targetCallerId,
        senderId: rejectingUserId,
      });
    }
  });

  socket.on('endCall', (data) => {
    let otherParty;
    let endingUserId;
    if (typeof data === 'string') {
      otherParty = data;
      endingUserId = socketUserId;
    } else if (typeof data === 'object' && data !== null) {
      otherParty = data.receiverId || data.callerId || data.target;
      endingUserId = data.senderId || socketUserId;
    }
    console.log(`\n🛑 [CALL ENDED] Call ended by ${endingUserId} ➔ Notifying: ${otherParty}`);
    if (otherParty) {
      emitToUser(otherParty, 'callEnded', {
        ...data,
        senderId: endingUserId,
      });
    }
  });

  // WebRTC SDP Offer (Support both 'offer' and 'webrtcOffer')
  const handleOffer = (data) => {
    const target = data.receiverId || data.target || data.callerId;
    console.log(`📡 [WEBRTC OFFER] ${data.senderId || socketUserId} ➔ ${target}`);
    emitToUser(target, 'offer', data);
    emitToUser(target, 'webrtcOffer', data);
  };
  socket.on('offer', handleOffer);
  socket.on('webrtcOffer', handleOffer);

  // WebRTC SDP Answer (Support both 'answer' and 'webrtcAnswer')
  const handleAnswer = (data) => {
    const target = data.receiverId || data.target || data.callerId;
    console.log(`📡 [WEBRTC ANSWER] ${data.senderId || socketUserId} ➔ ${target}`);
    emitToUser(target, 'answer', data);
    emitToUser(target, 'webrtcAnswer', data);
  };
  socket.on('answer', handleAnswer);
  socket.on('webrtcAnswer', handleAnswer);

  // WebRTC ICE Candidate (Support both 'iceCandidate' and 'webrtcIceCandidate')
  const handleIce = (data) => {
    const target = data.receiverId || data.target || data.callerId;
    emitToUser(target, 'iceCandidate', data);
    emitToUser(target, 'webrtcIceCandidate', data);
  };
  socket.on('iceCandidate', handleIce);
  socket.on('webrtcIceCandidate', handleIce);

  socket.on('disconnect', () => {
    console.log(`\n🔴 DISCONNECT ─── ${socketUserType.toUpperCase()} LEFT (Socket.io) ──────`);
    console.log(`   User ID   : ${socketUserId || 'unregistered'}`);
    console.log(`   Time      : ${now()}`);
    console.log(`${'─'.repeat(58)}\n`);
    if (socketUserId && socketIoSockets.has(socketUserId)) {
      const set = socketIoSockets.get(socketUserId);
      set.delete(socket.id);
      if (set.size === 0) socketIoSockets.delete(socketUserId);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 3. HTTP API
// ─────────────────────────────────────────────────────────────
app.get('/api/messages', (req, res) => {
  const { userId, otherUserId, conversationId: convQuery } = req.query;
  const conversationId = convQuery || (userId && otherUserId ? getConversationId(userId, otherUserId) : null);
  if (!conversationId) {
    return res.status(400).json({ success: false, messages: [], error: 'Missing userId/otherUserId or conversationId' });
  }
  const msgs = conversationHistory.get(conversationId) || [];
  res.json({ success: true, conversationId, messages: msgs });
});

app.get('/api/health', (req, res) => {
  const onlineUsers = [];
  for (const [userId, info] of userRegistry.entries()) {
    if (info.online) onlineUsers.push({ userId, userType: info.userType, name: info.name });
  }
  res.json({
    status:              'ok',
    nativeClientsCount:  nativeSockets.size,
    socketIoClientsCount: socketIoSockets.size,
    onlineUsers,
    timestamp:           Date.now(),
  });
});

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'═'.repeat(58)}`);
  console.log(`🚀  Cab Server listening on port ${PORT}`);
  console.log(`📱  Native WebSocket : ws://0.0.0.0:${PORT}/`);
  console.log(`🔌  Socket.io        : http://0.0.0.0:${PORT}/socket.io/`);
  console.log(`${'═'.repeat(58)}\n`);
  console.log(`Waiting for connections...\n`);
});
