import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  PermissionsAndroid,
  Platform,
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

// Default route coordinates connecting Kalapet Beach to Pondicherry
const DEFAULT_ROUTE_COORDINATES = [
  { latitude: 12.0125, longitude: 79.8550 },
  { latitude: 12.0050, longitude: 79.8510 },
  { latitude: 11.9920, longitude: 79.8450 },
  { latitude: 11.9800, longitude: 79.8390 },
  { latitude: 11.9680, longitude: 79.8320 },
  { latitude: 11.9550, longitude: 79.8220 },
  { latitude: 11.9480, longitude: 79.8150 },
  { latitude: 11.9416, longitude: 79.8083 },
];

export default function CustomerTrackingScreen({ route, navigation }) {
  const {
    customerId = "customer_101",
    driverId = "driver_201",
    driverName = "Arun",
  } = route.params || {};

  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [driverLocation, setDriverLocation] = useState({
    driverId: driverId,
    latitude: 12.0125,
    longitude: 79.8550,
    accuracy: 5,
    speed: 36,
    heading: 90,
    timestamp: Date.now(),
  });

  // Dynamic Destination / Customer Home location state (fetched via Geolocation / LocationTracker)
  const [customerLocation, setCustomerLocation] = useState({
    latitude: 11.9416,
    longitude: 79.8083,
  });

  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: 12.0125,
      longitude: 79.8550,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  const pickupLocation = DEFAULT_ROUTE_COORDINATES[0];

  const [etaMinutes, setEtaMinutes] = useState(3);
  const [tipAdded, setTipAdded] = useState(false);
  const [lastUpdateText, setLastUpdateText] = useState("Connecting to live driver feed...");
  const [updateCount, setUpdateCount] = useState(0);

  // Request location permission on Android
  const requestLocationPermission = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "App needs your location to set as drop/home destination.",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    console.log("CUSTOMER START TRACKING FOR:", customerId, "->", driverId);
    SocketService.connect(customerId);
    SocketService.startTracking(customerId, driverId);

    // 1. Fetch live customer location to set as Home / Drop Marker (🏠)
    const initCustomerLocation = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        Geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            console.log("📍 [CUSTOMER LIVE GPS FETCHED]:", latitude, longitude);
            setCustomerLocation({ latitude, longitude });
          },
          (err) => console.log("Customer location error:", err?.message || err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );

        // Continuous watch for customer movement
        const watchId = Geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setCustomerLocation({ latitude, longitude });
          },
          (err) => {},
          { enableHighAccuracy: true, distanceFilter: 10 }
        );

        return () => Geolocation.clearWatch(watchId);
      }
    };

    const cleanupWatch = initCustomerLocation();

    const handleDriverLocation = (data) => {
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      const speed = Number(data.speed) || 0;
      const heading = Number(data.heading) || 0;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      console.log("🚗 [CLIENT MAP] LIVE DRIVER MOVEMENT:", latitude, longitude, `Speed: ${speed} km/h`);
      setDriverLocation((prev) => ({
        ...prev,
        latitude,
        longitude,
        speed,
        heading,
        timestamp: data.timestamp || Date.now(),
      }));
      setLastUpdateText(`Live GPS: ${new Date().toLocaleTimeString()} (±${data.accuracy || 5}m)`);
      setUpdateCount((c) => c + 1);

      // Smooth coordinate movement for Marker
      if (Platform.OS === "android" && markerRef.current?.animateMarkerToCoordinate) {
        markerRef.current.animateMarkerToCoordinate({ latitude, longitude }, 1500);
      } else if (animatedCoord?.timing) {
        animatedCoord
          .timing({
            latitude,
            longitude,
            duration: 1500,
            useNativeDriver: false,
          })
          .start();
      }

      // Smooth camera pan to follow driver
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: latitude - 0.008,
            longitude: longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          },
          1000
        );
      }
    };

    SocketService.on("driverLocationUpdate", handleDriverLocation);
    SocketService.on("driverLocation", handleDriverLocation);

    return () => {
      SocketService.off("driverLocationUpdate", handleDriverLocation);
      SocketService.off("driverLocation", handleDriverLocation);
      SocketService.stopTracking(customerId);
    };
  }, [customerId, driverId]);

  const recenterMap = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude - 0.008,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        800
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
      tipAdded ? "Tip removed from current ride." : "50 INR tip added for the driver."
    );
  };

  const handleOrderDetails = () => {
    Alert.alert(
      "Ride Details",
      `Driver: ${driverName}\nVehicle: Prime Sedan (TN 01 AB 1234)\nPickup: Kalapet Beach Road\nDrop: Pondicherry White Town\nFare: ${tipAdded ? "400 INR (incl. 50 tip)" : "350 INR"}`
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
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Full-screen MapView with Google Provider */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: driverLocation.latitude - 0.015,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        zoomEnabled={true}
        scrollEnabled={true}
        showsCompass={false}
      >
        {/* Origin / Pickup Marker */}
        <Marker coordinate={pickupLocation} title="Pickup Point" description="Kalapet Beach Road">
          <View style={[styles.marker, styles.markerPickup]}>
            <Text style={styles.markerIcon}>📍</Text>
          </View>
        </Marker>

        {/* Dynamic Destination / Customer Home Marker (Live Location) */}
        <Marker
          coordinate={customerLocation}
          title="Destination (My Location / Home)"
          description={`Lat: ${customerLocation.latitude?.toFixed(4)}, Lng: ${customerLocation.longitude?.toFixed(4)}`}
        >
          <View style={[styles.marker, styles.markerDrop]}>
            <Text style={styles.markerIcon}>🏠</Text>
          </View>
        </Marker>

        {/* Real-time Animated Driver Location Marker */}
        <Marker.Animated
          ref={markerRef}
          coordinate={animatedCoord}
          title={`Driver: ${driverName}`}
          description={`Speed: ${driverLocation.speed} km/h | Updates: #${updateCount}`}
          flat={true}
          rotation={driverLocation.heading || 0}
        >
          <View style={[styles.marker, styles.markerDriver]}>
            <Text style={styles.markerIcon}>🚗</Text>
          </View>
        </Marker.Animated>

        {/* Dynamic Route Polyline connecting Pickup -> Driver -> Customer Location */}
        <Polyline
          coordinates={[
            pickupLocation,
            { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
            customerLocation,
          ]}
          strokeColor="#0F172A"
          strokeWidth={4}
        />
      </MapView>

      {/* Floating Top Header Actions */}
      <SafeAreaView style={styles.topSafeArea}>
        <View style={styles.header}>
          {/* Close / Back Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.btn, styles.btnClose]}
            activeOpacity={0.8}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>

          {/* Live Status Badge */}
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE TRACKING</Text>
          </View>

          {/* Header Right Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Help & Support",
                  "Contacting 24/7 cab dispatch support. Helpline: +91 1800 123 4567"
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

      {/* Bottom Sheet Section */}
      <SafeAreaView style={styles.sheet}>
        {/* Sheet Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Cab is on the way</Text>
          <Text style={styles.sheetSubtitle}>
            {lastUpdateText}
          </Text>
        </View>

        {/* Driver Profile Card */}
        <View style={styles.driverCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.carModel}>Prime Sedan • TN 01 AB 1234</Text>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ 4.8</Text>
              <Text style={styles.speedTag}>• {driverLocation.speed || 0} km/h</Text>
            </View>
          </View>
          <View style={styles.pinBox}>
            <Text style={styles.pinLabel}>START OTP</Text>
            <Text style={styles.pinCode}>4821</Text>
          </View>
        </View>

        {/* 2 Core Primary Action Buttons: MESSAGE & CALL */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.chatButton]}
            onPress={openChat}
            activeOpacity={0.8}
          >
            <Text style={styles.chatButtonText}>MESSAGE DRIVER</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.callButton]}
            onPress={openCall}
            activeOpacity={0.8}
          >
            <Text style={styles.callButtonText}>CALL DRIVER</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Actions */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleAddTip}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>
              {tipAdded ? "✓ TIP (50 INR)" : "+ ADD TIP"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleOrderDetails}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>RIDE DETAILS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, styles.cancelBtn]}
            onPress={handleCancelRide}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryBtnText, styles.cancelBtnText]}>
              CANCEL
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  topSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 40 : 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  liveBadgeText: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  btn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  btnClose: {
    width: 44,
    paddingHorizontal: 0,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  navIcon: {
    fontSize: 14,
    fontWeight: "900",
    color: "#2563EB",
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerPickup: {
    backgroundColor: "#2563EB",
  },
  markerDrop: {
    backgroundColor: "#059669",
  },
  markerDriver: {
    backgroundColor: "#DC2626",
  },
  markerIcon: {
    fontSize: 20,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "android" ? 20 : 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHeader: {
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  carModel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F59E0B",
  },
  speedTag: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
    marginLeft: 4,
  },
  pinBox: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  pinLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  pinCode: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  chatButton: {
    backgroundColor: "#2563EB",
  },
  chatButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  callButton: {
    backgroundColor: "#059669",
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  secondaryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.3,
  },
  cancelBtn: {
    backgroundColor: "#FEF2F2",
  },
  cancelBtnText: {
    color: "#DC2626",
  },
});
