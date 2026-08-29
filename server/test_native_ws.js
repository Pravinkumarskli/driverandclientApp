const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:3000/';

console.log('--- STARTING NATIVE WEBSOCKET & NOTIFICATION ROUTING TEST ---');

const clientWs = new WebSocket(SERVER_URL);
const driverWs = new WebSocket(SERVER_URL);

let clientReady = false;
let driverReady = false;

function checkReady() {
  if (clientReady && driverReady) {
    runChatTests();
  }
}

// 1. Client Setup
clientWs.on('open', () => {
  console.log('📱 Customer WebSocket opened. Registering as customer_101 (client)...');
  clientWs.send(JSON.stringify({
    type: 'register',
    userId: 'customer_101',
    userType: 'client',
    timestamp: Date.now()
  }));
});

clientWs.on('message', (buffer) => {
  const data = JSON.parse(buffer.toString());

  if (data.type === 'registerSuccess') {
    console.log('✅ Customer registered successfully!');
    clientReady = true;
    checkReady();
  } else if (data.type === 'receiveMessage') {
    console.log('>> 📩 CUSTOMER RECEIVED MESSAGE FROM DRIVER:');
    console.log(data);
    if (data.message === 'Hello Customer! Native Android WebSocket message arrived.') {
      console.log('✅ TEST 1 PASSED: Customer received driver message in real-time!');
      sendCustomerReply();
    }
  } else if (data.type === 'pong') {
    console.log('✅ TEST 3 PASSED: Heartbeat PING/PONG verified on Native WS!');
    console.log('\n🎉 ALL NATIVE WEBSOCKET TESTS COMPLETED SUCCESSFULLY! 🎉');
    clientWs.close();
    driverWs.close();
    process.exit(0);
  }
});

// 2. Driver Setup
driverWs.on('open', () => {
  console.log('🚗 Driver WebSocket opened. Registering as driver_201 (driver)...');
  driverWs.send(JSON.stringify({
    type: 'register',
    userId: 'driver_201',
    userType: 'driver',
    timestamp: Date.now()
  }));
});

driverWs.on('message', (buffer) => {
  const data = JSON.parse(buffer.toString());

  if (data.type === 'registerSuccess') {
    console.log('✅ Driver registered successfully!');
    driverReady = true;
    checkReady();
  } else if (data.type === 'receiveMessage') {
    console.log('>> 📩 DRIVER RECEIVED MESSAGE FROM CUSTOMER:');
    console.log(data);
    if (data.message === 'Thanks Arun! I see your car on the map.') {
      console.log('✅ TEST 2 PASSED: Driver received customer reply in real-time!');
      testHeartbeat();
    }
  } else if (data.type === 'messageDelivered') {
    console.log(`📨 Delivery ACK received for messageId: ${data.messageId} (status: ${data.status})`);
  }
});

function runChatTests() {
  console.log('\n[TEST 1] Driver sending message to Customer over native WebSocket...');
  driverWs.send(JSON.stringify({
    type: 'sendMessage',
    messageId: `msg_${Date.now()}_driver`,
    senderId: 'driver_201',
    receiverId: 'customer_101',
    senderType: 'driver',
    receiverType: 'client',
    message: 'Hello Customer! Native Android WebSocket message arrived.',
    messageType: 'text',
    timestamp: Date.now()
  }));
}

function sendCustomerReply() {
  console.log('\n[TEST 2] Customer sending reply to Driver over native WebSocket...');
  clientWs.send(JSON.stringify({
    type: 'sendMessage',
    messageId: `msg_${Date.now()}_customer`,
    senderId: 'customer_101',
    receiverId: 'driver_201',
    senderType: 'client',
    receiverType: 'driver',
    message: 'Thanks Arun! I see your car on the map.',
    messageType: 'text',
    timestamp: Date.now()
  }));
}

function testHeartbeat() {
  console.log('\n[TEST 3] Testing Heartbeat Ping/Pong...');
  clientWs.send(JSON.stringify({
    type: 'ping',
    timestamp: Date.now()
  }));
}

setTimeout(() => {
  console.error('Test timed out!');
  process.exit(1);
}, 8000);
