import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  AnimatedRegion,
  MarkerAnimated,
} from 'react-native-maps';

import SocketService from '../services/SocketService';

const ROUTE_COORDINATES = [
  { latitude: 12.0125, longitude: 79.8550 },
  { latitude: 12.0050, longitude: 79.8510 },
  { latitude: 11.9920, longitude: 79.8450 },
  { latitude: 11.9800, longitude: 79.8390 },
  { latitude: 11.9680, longitude: 79.8320 },
  { latitude: 11.9550, longitude: 79.8220 },
  { latitude: 11.9480, longitude: 79.8150 },
  { latitude: 11.9416, longitude: 79.8083 },
];

const TOTAL_STEPS = 80;

export default function MapScreen({ route, navigation }) {
  const {
    driverId = 'driver_201',
    customerId = 'customer_101',
    customerName = 'Customer 101',
  } = (route && route.params) || {};

  const mapRef = useRef(null);
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [broadcastCount, setBroadcastCount] = useState(0);
  const [hasArrived, setHasArrived] = useState(false);

  const isBroadcastingRef = useRef(true);
  const stepRef = useRef(0);

  const [driverCoord, setDriverCoord] = useState({
    latitude: 12.0125,
    longitude: 79.8550,
  });

  const animatedDriverCoord = useRef(
    new AnimatedRegion({
      latitude: 12.0125,
      longitude: 79.8550,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  const pickupCoord = ROUTE_COORDINATES[0];
  const dropCoord = ROUTE_COORDINATES[ROUTE_COORDINATES.length - 1];
  const [speed, setSpeed] = useState(38);

  useEffect(() => {
    isBroadcastingRef.current = isBroadcasting;
  }, [isBroadcasting]);

  useEffect(() => {
    SocketService.connect(driverId);

    SocketService.sendLocation({
      driverId,
      latitude: driverCoord.latitude,
      longitude: driverCoord.longitude,
      accuracy: 5,
      speed: 38,
      heading: 90,
      timestamp: Date.now(),
    });
    setBroadcastCount(1);

    const interval = setInterval(() => {
      if (!isBroadcastingRef.current) return;

      if (stepRef.current >= TOTAL_STEPS) {
        clearInterval(interval);
        setHasArrived(true);
        return;
      }

      stepRef.current += 1;
      const step = stepRef.current;

      const latDelta = (dropCoord.latitude - pickupCoord.latitude) * (step / TOTAL_STEPS);
      const lngDelta = (dropCoord.longitude - pickupCoord.longitude) * (step / TOTAL_STEPS);

      const nextLat = pickupCoord.latitude + latDelta;
      const nextLng = pickupCoord.longitude + lngDelta;
      const simulatedSpeed = 35 + (step % 10);

      setDriverCoord({ latitude: nextLat, longitude: nextLng });
      setSpeed(simulatedSpeed);
      setBroadcastCount((prev) => prev + 1);

      animatedDriverCoord
        .timing({
          latitude: nextLat,
          longitude: nextLng,
          duration: 1000,
          useNativeDriver: false,
        })
        .start();

      SocketService.sendLocation({
        driverId,
        latitude: nextLat,
        longitude: nextLng,
        accuracy: 4,
        speed: simulatedSpeed,
        heading: 90,
        timestamp: Date.now(),
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      SocketService.disconnect?.();
    };
  }, []);

  const recenterMap = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: driverCoord.latitude - 0.012,
          longitude: driverCoord.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        800,
      );
    }
  };

  const toggleBroadcast = () => {
    const next = !isBroadcasting;
    setIsBroadcasting(next);
    Alert.alert(
      next ? 'Broadcast Resumed' : 'Broadcast Paused',
      next
        ? 'GPS location is now broadcasting live to passenger.'
        : 'GPS broadcasting paused.',
    );
  };

  const openChat = () => {
    navigation.navigate('DriverChat', {
      userId: driverId,
      receiverId: customerId,
      receiverName: customerName,
    });
  };

  const openCall = () => {
    navigation.navigate('DriverCallScreen', {
      userId: driverId,
      receiverId: customerId,
      receiverName: customerName,
    });
  };

  const handleTripDetails = () => {
    Alert.alert(
      'Trip Dispatch Summary',
      `Customer: ${customerName}\nPickup: Kalapet Beach Road\nDrop: Pondicherry White Town\nFare: 350 INR\nStatus: ${
        hasArrived ? 'Arrived at destination' : 'GPS Live Dispatched'
      }`,
    );
  };

  const handleCompleteTrip = () => {
    Alert.alert('Arrived at Destination', 'Confirm completion of current trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete Trip',
        onPress: () => {
          Alert.alert('Success', 'Trip completed successfully! Fare: 350 INR collected.');
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <SafeAreaView style={styles.topSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.btn, styles.btnClose]}
            activeOpacity={0.8}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Driver Support',
                  'Contacting 24/7 Driver Dispatch Helpline: +91 1800 987 6543',
                )
              }
              activeOpacity={0.8}
            >
              <View style={styles.btn}>
                <Text style={styles.btnText}>Help</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={recenterMap}
              style={[styles.btn, styles.btnClose]}
              activeOpacity={0.8}
            >
              <Text style={styles.navIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: driverCoord.latitude - 0.015,
          longitude: driverCoord.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        onMapReady={recenterMap}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        <Marker coordinate={pickupCoord} title="Pickup Point" description="Kalapet Beach Road">
          <View style={[styles.marker, styles.markerPickup]}>
            <Text style={styles.markerIcon}>📍</Text>
          </View>
        </Marker>

        <Marker coordinate={dropCoord} title="Drop Point" description="Pondicherry White Town">
          <View style={[styles.marker, styles.markerDrop]}>
            <Text style={styles.markerIcon}>🏠</Text>
          </View>
        </Marker>

        <MarkerAnimated
          coordinate={animatedDriverCoord}
          title="Your Vehicle Location"
          description={`Speed: ${speed} km/h • Broadcast Active`}
        >
          <View style={[styles.marker, styles.markerDriver]}>
            <Text style={styles.markerIcon}>🚗</Text>
          </View>
        </MarkerAnimated>

        <Polyline coordinates={ROUTE_COORDINATES} strokeColor="#0F172A" strokeWidth={4} />
      </MapView>

      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            {hasArrived ? 'Arrived at destination' : 'Trip in progress'}
          </Text>
          <Text style={styles.sheetSubtitle}>
            {hasArrived ? 'Ready to complete trip' : 'En route to drop-off'}
            <Text style={styles.speedBadge}>{` • ${speed} km/h`}</Text>
            <Text style={styles.broadcastTag}>
              {isBroadcasting ? ' • 📡 LIVE GPS' : ' • ⏸️ PAUSED'}
            </Text>
          </Text>
        </View>

        <View style={styles.sheetSection}>
          <View style={styles.sectionInfo}>
            <Text style={styles.sectionTitle}>Passenger</Text>
            <Text style={styles.sectionSubtitle}>{customerName} • +91 98765 43210</Text>
          </View>

          <TouchableOpacity onPress={toggleBroadcast} activeOpacity={0.8}>
            <View style={[styles.btnSm, isBroadcasting ? styles.btnSmActive : styles.btnSmInactive]}>
              <Text
                style={[
                  styles.btnSmText,
                  isBroadcasting ? styles.btnSmTextActive : styles.btnSmTextInactive,
                ]}
              >
                {isBroadcasting ? 'GPS ON' : 'PAUSED'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openCall}
            style={[styles.btnSm, styles.btnIconOnly, styles.callBtn]}
            activeOpacity={0.8}
          >
            <Text style={styles.actionEmoji}>📞</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openChat}
            style={[styles.btnSm, styles.btnIconOnly, styles.chatBtn]}
            activeOpacity={0.8}
          >
            <Text style={styles.actionEmoji}>💬</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sheetSection}>
          <View style={styles.sectionInfo}>
            <Text style={styles.sectionTitle}>Drop-off Location</Text>
            <Text style={styles.sectionSubtitle} numberOfLines={1}>
              Pondicherry White Town • Fare: 350 INR
            </Text>
          </View>

          <TouchableOpacity onPress={handleTripDetails} style={styles.btnSm} activeOpacity={0.8}>
            <Text style={styles.btnSmText}>Details</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionFooter}>
          <TouchableOpacity onPress={handleCompleteTrip} activeOpacity={0.8}>
            <View style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Arrived & Complete Trip</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <View style={styles.btnEmpty}>
              <Text style={styles.btnEmptyText}>Minimize Map</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  markerPickup: { backgroundColor: '#2563EB' },
  markerDrop: { backgroundColor: '#059669' },
  markerDriver: { backgroundColor: '#DC2626', width: 40, height: 40, borderRadius: 20 },
  markerIcon: { fontSize: 18 },
  topSafeArea: { backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  headerActions: { alignItems: 'flex-end' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  btnClose: { width: 42, height: 42, paddingHorizontal: 0 },
  closeIcon: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  navIcon: { fontSize: 16, fontWeight: '800', color: '#2563EB', transform: [{ rotate: '-45deg' }] },
  btnText: { fontSize: 14, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 },
  btnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    marginLeft: 6,
  },
  btnSmActive: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  btnSmInactive: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  btnSmText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  btnSmTextActive: { color: '#16A34A' },
  btnSmTextInactive: { color: '#DC2626' },
  btnIconOnly: { width: 40, height: 40, paddingHorizontal: 0, borderRadius: 20 },
  callBtn: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  chatBtn: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  actionEmoji: { fontSize: 16 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#16A34A',
    elevation: 3,
    shadowColor: '#16A34A',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  btnEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  btnEmptyText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  sheet: {
    marginTop: 'auto',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sheetHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  sheetSubtitle: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  speedBadge: { color: '#059669', fontWeight: '700' },
  broadcastTag: { color: '#2563EB', fontWeight: '700' },
  sheetSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionInfo: { flex: 1, marginRight: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  sectionFooter: { paddingHorizontal: 20, paddingTop: 12 },
});