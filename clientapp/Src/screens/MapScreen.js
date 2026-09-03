import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  AnimatedRegion,
  MarkerAnimated,
} from "react-native-maps";
import Geolocation from "@react-native-community/geolocation";

import SocketService from "../services/SocketService";

// Route coordinates connecting Kalapet Beach to Pondicherry White Town
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

export default function MapScreen({ route, navigation }) {
  const {
    customerId = "customer_101",
    driverId = "driver_201",
    driverName = "Arun",
  } = route.params || {};

  const mapRef = useRef(null);

  const [driverLocation, setDriverLocation] = useState({
    driverId: driverId,
    latitude: 12.0125,
    longitude: 79.8550,
    accuracy: 5,
    speed: 36,
    heading: 90,
    timestamp: Date.now(),
  });

  // AnimatedRegion drives the marker's smooth glide across updates.
  // Kept in a ref so the same instance persists across re-renders.
  const animatedDriverCoord = useRef(
    new AnimatedRegion({
      latitude: 12.0125,
      longitude: 79.8550,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  const [customerLocation, setCustomerLocation] = useState({
    latitude: 11.9416,
    longitude: 79.8083,
  });

  const pickupLocation = ROUTE_COORDINATES[0];
  const dropLocation = ROUTE_COORDINATES[ROUTE_COORDINATES.length - 1];

  const [etaMinutes, setEtaMinutes] = useState(3);
  const [tipAdded, setTipAdded] = useState(false);

  useEffect(() => {
    console.log("CUSTOMER START TRACKING FOR:", customerId, "->", driverId);
    SocketService.connect(customerId);
    SocketService.startTracking(customerId, driverId);

    // Fetch customer's live GPS for Home marker
    Geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCustomerLocation({ latitude, longitude });
      },
      (err) => console.log("MapScreen Geolocation error:", err?.message || err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    const handleDriverLocation = (data) => {
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      console.log("CUSTOMER RECEIVED GPS LOCATION UPDATE:", data);

      setDriverLocation((prev) => ({ ...prev, ...data, latitude, longitude }));

      // Glide the marker to the new coordinate over 1s instead of jumping
      animatedDriverCoord
        .timing({
          latitude,
          longitude,
          duration: 1000,
          useNativeDriver: false, // AnimatedRegion doesn't support native driver
        })
        .start();

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: latitude - 0.012,
            longitude: longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          },
          1000,
        );
      }
    };

    SocketService.onDriverLocation(handleDriverLocation);

    return () => {
      SocketService.removeDriverLocationListener();
      SocketService.stopTracking(customerId);
    };
  }, [customerId, driverId]);

  const recenterMap = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude - 0.012,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        800,
      );
    }
  };

  const openChat = () => {
    navigation.navigate("CustomerChat", {
      userId: customerId,
      receiverId: driverId,
      receiverName: driverName,
    });
  };

  const openCall = () => {
    navigation.navigate("CustomerCallScreen", {
      userId: customerId,
      receiverId: driverId,
      receiverName: driverName,
    });
  };

  const handleAddTip = () => {
    setTipAdded((prev) => !prev);
    Alert.alert(
      tipAdded ? "Tip Removed" : "Tip Added",
      tipAdded ? "Tip removed from current ride." : "50 INR tip added for the driver.",
    );
  };

  const handleOrderDetails = () => {
    Alert.alert(
      "Ride Details",
      `Driver: ${driverName}\nVehicle: Prime Sedan (TN 01 AB 1234)\nPickup: Kalapet Beach Road\nDrop: Pondicherry White Town\nFare: ${tipAdded ? "400 INR (incl. 50 tip)" : "350 INR"}`,
    );
  };

  const handleCancelRide = () => {
    Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

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
                  "Help & Support",
                  "Contacting 24/7 cab dispatch support. Helpline: +91 1800 123 4567",
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
          latitude: driverLocation.latitude - 0.015,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        <Marker coordinate={pickupLocation} title="Pickup Point" description="Kalapet Beach Road">
          <View style={[styles.marker, styles.markerPickup]}>
            <Text style={styles.markerIcon}>📍</Text>
          </View>
        </Marker>

        <Marker
          coordinate={customerLocation}
          title="Destination (My Location / Home)"
          description={`Lat: ${customerLocation.latitude?.toFixed(4)}, Lng: ${customerLocation.longitude?.toFixed(4)}`}
        >
          <View style={[styles.marker, styles.markerDrop]}>
            <Text style={styles.markerIcon}>🏠</Text>
          </View>
        </Marker>

        {/* Driver marker — now uses MarkerAnimated + AnimatedRegion,
            so it glides smoothly instead of jumping on each GPS update */}
        <MarkerAnimated
          coordinate={animatedDriverCoord}
          title={`Driver: ${driverName}`}
          description={`Speed: ${driverLocation.speed || 36} km/h`}
        >
          <View style={[styles.marker, styles.markerDriver]}>
            <Text style={styles.markerIcon}>🚗</Text>
          </View>
        </MarkerAnimated>

        <Polyline
          coordinates={ROUTE_COORDINATES}
          strokeColor="#0F172A"
          strokeWidth={4}
        />
      </MapView>

      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Cab is coming soon</Text>
          <Text style={styles.sheetSubtitle}>
            Arrives in
            <Text style={styles.boldText}>{` ${etaMinutes} minutes`}</Text>
            <Text style={styles.speedBadge}>{` • ${driverLocation.speed || 36} km/h`}</Text>
          </Text>
        </View>

        <View style={styles.sheetSection}>
          <View style={styles.sectionInfo}>
            <Text style={styles.sectionTitle}>Driver</Text>
            <Text style={styles.sectionSubtitle}>{driverName} • Prime Sedan</Text>
          </View>

          <TouchableOpacity onPress={handleAddTip} activeOpacity={0.8}>
            <View style={[styles.btnSm, tipAdded && styles.btnSmActive]}>
              <Text style={[styles.btnSmText, tipAdded && styles.btnSmTextActive]}>
                {tipAdded ? "✓ +50 Tip" : "+ Add tip"}
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
            <Text style={styles.sectionTitle}>Destination</Text>
            <Text style={styles.sectionSubtitle} numberOfLines={1}>
              Pondicherry White Town • 350 INR
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleOrderDetails}
            style={styles.btnSm}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSmText}>Route</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionFooter}>
          <TouchableOpacity onPress={handleOrderDetails} activeOpacity={0.8}>
            <View style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>View Ride Details</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCancelRide} activeOpacity={0.8}>
            <View style={styles.btnEmpty}>
              <Text style={styles.btnEmptyText}>Cancel Ride</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  markerPickup: { backgroundColor: "#2563EB" },
  markerDrop: { backgroundColor: "#059669" },
  markerDriver: { backgroundColor: "#DC2626", width: 40, height: 40, borderRadius: 20 },
  markerIcon: { fontSize: 18 },
  topSafeArea: {
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  headerActions: { alignItems: "flex-end" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  btnClose: { width: 42, height: 42, paddingHorizontal: 0 },
  closeIcon: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  navIcon: { fontSize: 16, fontWeight: "800", color: "#2563EB", transform: [{ rotate: "-45deg" }] },
  btnText: { fontSize: 14, fontWeight: "800", color: "#0F172A", letterSpacing: 0.3 },
  btnSm: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    marginLeft: 6,
  },
  btnSmActive: { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" },
  btnSmText: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  btnSmTextActive: { color: "#16A34A" },
  btnIconOnly: { width: 40, height: 40, paddingHorizontal: 0, borderRadius: 20 },
  callBtn: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  chatBtn: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  actionEmoji: { fontSize: 16 },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#DC2626",
    elevation: 3,
    shadowColor: "#DC2626",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  btnPrimaryText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.5 },
  btnEmpty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
    marginTop: 4,
  },
  btnEmptyText: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  sheet: {
    marginTop: "auto",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 2 },
  sheetSubtitle: { fontSize: 13, fontWeight: "500", color: "#64748B" },
  boldText: { fontWeight: "800", color: "#0F172A" },
  speedBadge: { color: "#059669", fontWeight: "700" },
  sheetSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionInfo: { flex: 1, marginRight: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  sectionFooter: { paddingHorizontal: 20, paddingTop: 12 },
});

// import React from 'react';
// import {View, StyleSheet} from 'react-native';
// import MapView, {Marker} from 'react-native-maps';

// const MapScreen = () => {
//   return (
//     <View style={styles.container}>
//       <MapView
//         style={styles.map}
//         initialRegion={{
//           latitude: 11.9139,
//           longitude: 79.8145,
//           latitudeDelta: 0.05,
//           longitudeDelta: 0.05,
//         }}
//       >
//         <Marker
//           coordinate={{
//             latitude: 11.9139,
//             longitude: 79.8145,
//           }}
//           title="My Location"
//           description="Puducherry"
//         />
//       </MapView>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   map: {
//     flex: 1,
//   },
// });

// export default MapScreen;