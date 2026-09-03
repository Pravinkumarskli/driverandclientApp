import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import NativeSocketService from '../services/NativeSocketService';
import SocketService from '../services/SocketService';
import { WS_URL } from '../config/AppConfig';

const LocationTracker = ({ driverId = 'driver_201' }) => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    speed: 0,
    accuracy: null,
    heading: 0,
  });
  const [timer, setTimer] = useState(3);
  const [socketStatus, setSocketStatus] = useState('CONNECTING');
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [broadcastCount, setBroadcastCount] = useState(0);

  const fetchAndBroadcastLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, speed, accuracy, heading } = position.coords;
        const newLoc = {
          latitude,
          longitude,
          speed: speed != null ? Math.round(speed * 3.6) : 0, // Convert to km/h or 0
          accuracy: accuracy ? Math.round(accuracy) : 5,
          heading: heading || 0,
        };

        setLocation(newLoc);
        setLastSentTime(new Date().toLocaleTimeString());
        setBroadcastCount((prev) => prev + 1);

        const locPayload = {
          driverId,
          latitude,
          longitude,
          accuracy: newLoc.accuracy,
          speed: newLoc.speed,
          heading: newLoc.heading,
          timestamp: position.timestamp || Date.now(),
        };

        // 1. Broadcast via Native WebSocket (Kill-proof background service)
        NativeSocketService.sendLocation(locPayload);

        // 2. Broadcast via Socket.io (Triggers socket.on('driverLocation') on server)
        SocketService.sendLocation(locPayload);

        console.log('📍 [LocationTracker] Location broadcasted to Native WS & Socket.io:', latitude, longitude);
      },
      (error) => console.log('Location Error:', error?.message || error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => {
    let countdownInterval = null;
    let unsubLocation = null;
    let unsubConn = null;

    const initTracker = async () => {
      // 1. Request Android Permissions (Fine, Coarse, Background, Notifications)
      const granted = await NativeSocketService.requestLocationPermissions();
      if (!granted) {
        console.warn('[LocationTracker] Location permission not granted');
      }

      // 2. Start Native Android Foreground Service (persists in background & killed state)
      try {
        await NativeSocketService.start(WS_URL, driverId, 'driver');
        setIsServiceActive(true);
      } catch (e) {
        console.error('[LocationTracker] Error starting native socket service:', e);
      }

      // 3. Connect Socket.io client (for in-app real-time features)
      SocketService.connect(driverId);

      // 4. Listen to live native GPS updates dispatched from Kotlin service
      unsubLocation = NativeSocketService.onLocationUpdate((nativeLoc) => {
        if (nativeLoc && nativeLoc.latitude) {
          const locObj = {
            latitude: nativeLoc.latitude,
            longitude: nativeLoc.longitude,
            speed: nativeLoc.speed ? Math.round(nativeLoc.speed * 3.6) : 0,
            accuracy: nativeLoc.accuracy ? Math.round(nativeLoc.accuracy) : 5,
            heading: nativeLoc.heading || 0,
          };
          setLocation(locObj);
          setLastSentTime(new Date().toLocaleTimeString());
          setBroadcastCount((prev) => prev + 1);

          // Forward native GPS fix to Socket.io as well
          SocketService.sendLocation({
            driverId,
            latitude: locObj.latitude,
            longitude: locObj.longitude,
            accuracy: locObj.accuracy,
            speed: locObj.speed,
            heading: locObj.heading,
            timestamp: nativeLoc.timestamp || Date.now(),
          });
        }
      });

      // 5. Listen to Native Socket connection state
      unsubConn = NativeSocketService.onConnectionState((state) => {
        setSocketStatus(state);
      });

      // Initial manual fetch
      fetchAndBroadcastLocation();

     
      countdownInterval = setInterval(() => {
        setTimer((prevTime) => {
          if (prevTime <= 1) {
            fetchAndBroadcastLocation();
            NativeSocketService.triggerLocationUpdate();
            return 3; // Reset to 3 seconds
          }
          return prevTime - 1;
        });
      }, 1000);
    };

    initTracker();

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
      if (unsubLocation) unsubLocation();
      if (unsubConn) unsubConn();
    };
  }, [driverId]);

  return (
    <View style={styles.container}>
      {/* Status Header */}
      <View style={styles.headerRow}>
        <View style={styles.statusIndicator}>
          <View
            style={[
              styles.statusDot,
              socketStatus === 'CONNECTED'
                ? styles.dotOnline
                : styles.dotOffline,
            ]}
          />
          <Text style={styles.statusLabel}>
            {socketStatus === 'CONNECTED'
              ? 'NATIVE SOCKET ONLINE'
              : `SOCKET ${socketStatus}`}
          </Text>
        </View>

        <View style={styles.bgServiceBadge}>
          <Text style={styles.bgServiceText}>KILL-PROOF BG SERVICE</Text>
        </View>
      </View>

      {/* Main Coordinate Display */}
      <View style={styles.coordsCard}>
        <View style={styles.coordRow}>
          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>LATITUDE</Text>
            <Text style={styles.coordValue}>
              {location.latitude != null
                ? location.latitude.toFixed(6)
                : 'Searching...'}
            </Text>
          </View>
          <View style={styles.coordDivider} />
          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>LONGITUDE</Text>
            <Text style={styles.coordValue}>
              {location.longitude != null
                ? location.longitude.toFixed(6)
                : 'Searching...'}
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Next Sync</Text>
            <Text style={styles.statValue}>{timer}s</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValue}>{location.speed} km/h</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Accuracy</Text>
            <Text style={styles.statValue}>
              {location.accuracy != null ? `±${location.accuracy}m` : '--'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Sent Logs</Text>
            <Text style={styles.statValue}>#{broadcastCount}</Text>
          </View>
        </View>
      </View>

      {/* Bottom Action / Info Bar */}
      <View style={styles.footerRow}>
        <Text style={styles.footerInfo}>
          {lastSentTime
            ? `Last broadcast: ${lastSentTime}`
            : 'Acquiring GPS coordinates...'}
        </Text>
        <TouchableOpacity
          style={styles.syncBtn}
          onPress={fetchAndBroadcastLocation}
          activeOpacity={0.8}
        >
          <Text style={styles.syncBtnText}>SYNC NOW</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E2E8F0',
    letterSpacing: 0.5,
  },
  bgServiceBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bgServiceText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.5,
  },
  coordsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  coordBox: {
    flex: 1,
    alignItems: 'center',
  },
  coordDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#334155',
  },
  coordLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  coordValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  footerInfo: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  syncBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default LocationTracker;