// Configuration for Cab Customer App
// When testing with real device or emulator via USB with `adb reverse tcp:3000 tcp:3000`, use "127.0.0.1"
// If testing over Wi-Fi without USB, ensure phone and PC are on same Wi-Fi and set PC Wi-Fi IP (e.g. "192.168.0.118")
export const SERVER_IP = "192.168.1.104";
export const SERVER_PORT = "3000";

export const SOCKET_URL = `http://${SERVER_IP}:${SERVER_PORT}`;
export const WS_URL = `ws://${SERVER_IP}:${SERVER_PORT}`;
