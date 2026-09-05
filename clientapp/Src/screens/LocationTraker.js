import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import SocketService from '../services/SocketService';
import NativeSocketService from '../services/NativeSocketService';
import { WS_URL } from '../config/AppConfig';

const LocationTracker = ({ customerId = 'customer_101', onLocationChange = null }) => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    speed: 0,
    accuracy: null,
    heading: 0,
  });
  const [timer, setTimer] = useState(3);
  const [socketStatus, setSocketStatus] = useState('CONNECTING');
  const [lastSentTime, setLastSentTime] = useState(null);
  const [broadcastCount, setBroadcastCount] = useState(0);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const perms = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];
        if (Platform.Version >= 33) {
          perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        const res = await PermissionsAndroid.requestMultiple(perms);
        return (
          res[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Location permission error:', err);
        return false;
      }
    }
    return true;
  };

  const fetchAndBroadcastLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, speed, accuracy, heading } = position.coords;
        const newLoc = {
          latitude,
          longitude,
          speed: speed != null ? Math.round(speed * 3.6) : 0,
          accuracy: accuracy ? Math.round(accuracy) : 5,
          heading: heading || 0,
        };

        setLocation(newLoc);
        setLastSentTime(new Date().toLocaleTimeString());
        setBroadcastCount((prev) => prev + 1);

        if (typeof onLocationChange === 'function') {
          onLocationChange(newLoc);
        }

        const locationPayload = {
          customerId,
          latitude,
          longitude,
          accuracy: newLoc.accuracy,
          heading: newLoc.heading,
          timestamp: position.timestamp || Date.now(),
        };
        // Send through both transports: native service survives a swiped app,
        // Socket.IO keeps the currently open map instant.
        NativeSocketService.sendCustomerLocation(locationPayload);
        SocketService.sendCustomerLocation(locationPayload);

        console.log('📍 [CUSTOMER LOCATION TRACKER]:', latitude, longitude);
      },
      (error) => console.log('Customer Location Error:', error?.message || error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => {
    let countdownInterval = null;

    const initTracker = async () => {
      await requestPermissions();

      // Connect Sockets
      SocketService.connect(customerId);
      try {
        await NativeSocketService.start(WS_URL, customerId, 'client');
        setSocketStatus('CONNECTED');
      } catch (e) {
        setSocketStatus('CONNECTED');
      }

      // Initial manual fetch
      fetchAndBroadcastLocation();

      // Continuous 3s sync interval
      countdownInterval = setInterval(() => {
        setTimer((prevTime) => {
          if (prevTime <= 1) {
            fetchAndBroadcastLocation();
            return 3;
          }
          return prevTime - 1;
        });
      }, 1000);
    };

    initTracker();

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [customerId]);

  return (
    <View style={styles.container}>
      {/* Status Header */}
      <View style={styles.headerRow}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, styles.dotOnline]} />
          <Text style={styles.statusLabel}>CUSTOMER GPS ACTIVE</Text>
        </View>

        <View style={styles.bgServiceBadge}>
          <Text style={styles.bgServiceText}>HOME / DROP POINT</Text>
        </View>
      </View>

      {/* Main Coordinate Display */}
      <View style={styles.coordsCard}>
        <View style={styles.coordRow}>
          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>MY LATITUDE</Text>
            <Text style={styles.coordValue}>
              {location.latitude != null
                ? location.latitude.toFixed(6)
                : 'Searching...'}
            </Text>
          </View>
          <View style={styles.coordDivider} />
          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>MY LONGITUDE</Text>
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
            <Text style={styles.statLabel}>Accuracy</Text>
            <Text style={styles.statValue}>
              {location.accuracy != null ? `±${location.accuracy}m` : '--'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Updates</Text>
            <Text style={styles.statValue}>#{broadcastCount}</Text>
          </View>
        </View>
      </View>

      {/* Bottom Action / Info Bar */}
      <View style={styles.footerRow}>
        <Text style={styles.footerInfo} numberOfLines={1}>
          {lastSentTime
            ? `Home GPS: ${lastSentTime}`
            : 'Acquiring GPS coordinates...'}
        </Text>
        <TouchableOpacity
          style={styles.syncBtn}
          onPress={fetchAndBroadcastLocation}
          activeOpacity={0.8}
        >
          <Text style={styles.syncBtnText}>SYNC GPS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E2E8F0',
    letterSpacing: 0.5,
  },
  bgServiceBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.4)',
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
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  coordBox: {
    flex: 1,
    alignItems: 'center',
  },
  coordDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#334155',
  },
  coordLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  coordValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
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
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  footerInfo: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  syncBtn: {
    backgroundColor: '#2563EB',
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
