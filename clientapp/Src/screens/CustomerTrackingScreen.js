import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
  Share,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  AnimatedRegion,
} from "react-native-maps";
import Geolocation from "@react-native-community/geolocation";

import SocketService from "../services/SocketService";

// Google Maps API Key from AndroidManifest
const GOOGLE_MAPS_API_KEY = "AIzaSyDUgrmq9CuX0qgx2TQhrpycUd0MzwxJBX8";

// Default Road route coordinates connecting Kalapet Beach to Pondicherry
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

const INITIAL_DRIVER_LOCATION = DEFAULT_ROUTE_COORDINATES[0];
const INITIAL_HOME_LOCATION = DEFAULT_ROUTE_COORDINATES[DEFAULT_ROUTE_COORDINATES.length - 1];

// ---------- Google Encoded Polyline Decoder ----------
function decodePolyline(encoded) {
  let points = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// ---------- Fetch Real Road Route (OSRM Road Router + Google Directions API) ----------
async function fetchRoadRoute(origin, destination) {
  if (!origin || !destination) return null;

  // 1. OSRM Free OpenStreetMap Road Network Router
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl);
    const data = await res.json();

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates.map((pt) => ({
        latitude: pt[1],
        longitude: pt[0],
      }));
      if (coords.length > 1) {
        console.log("🛣️ [ROAD ROUTE] Fetched via OSRM:", coords.length, "points");
        return coords;
      }
    }
  } catch (err) {
    console.log("OSRM router notice:", err?.message || err);
  }

  // 2. Google Directions API
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.startsWith("AIza")) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.routes && data.routes.length > 0) {
        const encoded = data.routes[0].overview_polyline?.points;
        if (encoded) {
          const points = decodePolyline(encoded);
          if (points && points.length > 1) {
            console.log("🛣️ [ROAD ROUTE] Fetched via Google Directions API:", points.length, "points");
            return points;
          }
        }
      }
    } catch (err) {
      console.log("Google Directions notice:", err?.message || err);
    }
  }

  return null;
}

function getDistanceMeters(p1, p2) {
  if (!p1 || !p2) return 0;
  const R = 6371e3;
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapScreen({ route, navigation }) {
  const {
    customerId = "customer_101",
    driverId = "driver_201",
    driverName = "Peter Markent",
    destinationTitle = "Gatot Subroto Street 8129",
    bookingNumber = "AB321481251245612",
    originCity = "Minnesota, USA",
    destinationCity = "New York, USA",
    createdDate = "04 June 2025",
  } = (route && route.params) || {};

  const mapRef = useRef(null);
  const driverMarkerRef = useRef(null);

  // Road coordinates state connecting Car -> Home (initialized with default road coordinates)
  const [routeCoordinates, setRouteCoordinates] = useState(DEFAULT_ROUTE_COORDINATES);
  const [routeLoading, setRouteLoading] = useState(false);

  // Driver Car Live Location
  const [driverLocation, setDriverLocation] = useState({
    driverId: driverId,
    latitude: INITIAL_DRIVER_LOCATION.latitude,
    longitude: INITIAL_DRIVER_LOCATION.longitude,
    accuracy: 5,
    speed: 36,
    heading: 90,
    timestamp: Date.now(),
  });

  // Animated Region for smooth car movement
  const animatedDriverCoord = useRef(
    new AnimatedRegion({
      latitude: INITIAL_DRIVER_LOCATION.latitude,
      longitude: INITIAL_DRIVER_LOCATION.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  // Customer Home / Destination Location
  const [customerLocation, setCustomerLocation] = useState(INITIAL_HOME_LOCATION);

  const lastRoutedDriverPos = useRef(INITIAL_DRIVER_LOCATION);
  const lastRoutedHomePos = useRef(INITIAL_HOME_LOCATION);

  const [etaMinutes, setEtaMinutes] = useState(12);

  // Update real road route polyline
  const updateRoadRoute = useCallback(async (carPos, homePos) => {
    if (!carPos || !homePos) return;
    try {
      const points = await fetchRoadRoute(carPos, homePos);
      if (points && points.length > 1) {
        setRouteCoordinates(points);
        lastRoutedDriverPos.current = carPos;
        lastRoutedHomePos.current = homePos;
      }
    } catch (e) {
      console.log("Error updating road route:", e);
    }
  }, []);

  // Initial road route calculation
  useEffect(() => {
    updateRoadRoute(INITIAL_DRIVER_LOCATION, INITIAL_HOME_LOCATION);
  }, [updateRoadRoute]);

  // Connect to Socket and track live driver & customer locations
  useEffect(() => {
    console.log("🗺️ [MAP SCREEN] Tracking started for:", customerId, "-> Driver:", driverId);
    SocketService.connect(customerId);
    SocketService.startTracking(customerId, driverId);

    // Watch customer position (Home location)
    const customerWatchId = Geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading } = pos.coords;
        const nextHome = { latitude, longitude };
        setCustomerLocation(nextHome);

        SocketService.sendCustomerLocation({
          customerId,
          latitude,
          longitude,
          accuracy: accuracy || 5,
          heading: heading || 0,
          timestamp: pos.timestamp || Date.now(),
        });

        // Re-fetch road route if customer moved significantly (> 50m)
        if (getDistanceMeters(lastRoutedHomePos.current, nextHome) > 50) {
          updateRoadRoute(driverLocation, nextHome);
        }
      },
      (err) => console.log("MapScreen customer GPS error:", err?.message || err),
      { enableHighAccuracy: true, distanceFilter: 5, timeout: 15000, maximumAge: 5000 }
    );

    // Handle live driver car movement
    const handleDriverLocation = (data) => {
      const rawLat = Number(data.latitude);
      const rawLng = Number(data.longitude);

      if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return;

      const nextDriverPos = { latitude: rawLat, longitude: rawLng };

      setDriverLocation((prev) => ({
        ...prev,
        ...data,
        latitude: rawLat,
        longitude: rawLng,
      }));

      // Smooth glide to new location
      if (Platform.OS === "android" && driverMarkerRef.current?.animateMarkerToCoordinate) {
        driverMarkerRef.current.animateMarkerToCoordinate(nextDriverPos, 1000);
      } else if (animatedDriverCoord?.timing) {
        animatedDriverCoord
          .timing({
            latitude: rawLat,
            longitude: rawLng,
            duration: 1000,
            useNativeDriver: false,
          })
          .start();
      }

      // Recalculate road polyline if driver moved > 40m
      if (getDistanceMeters(lastRoutedDriverPos.current, nextDriverPos) > 40) {
        updateRoadRoute(nextDriverPos, customerLocation);
      }
    };

    SocketService.onDriverLocation(handleDriverLocation);
    SocketService.on("driverLocationUpdate", handleDriverLocation);
    SocketService.on("driverLocation", handleDriverLocation);

    return () => {
      Geolocation.clearWatch(customerWatchId);
      SocketService.removeDriverLocationListener();
      SocketService.off("driverLocationUpdate", handleDriverLocation);
      SocketService.off("driverLocation", handleDriverLocation);
      SocketService.stopTracking(customerId);
    };
  }, [customerId, driverId, customerLocation, driverLocation, updateRoadRoute, animatedDriverCoord]);

  // Re-center map to view both Car and Home
  const recenterMap = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: (driverLocation.latitude + customerLocation.latitude) / 2,
          longitude: (driverLocation.longitude + customerLocation.longitude) / 2,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
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

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Track my ride: Driver ${driverName} is on the way! Booking ID: ${bookingNumber}`,
      });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const handleOrderDetails = () => {
    Alert.alert(
      "Order Details",
      `Booking No: ${bookingNumber}\nDriver: ${driverName}\nFrom: ${originCity}\nTo: ${destinationCity}\nDate: ${createdDate}`
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Full-screen MapView */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: (INITIAL_DRIVER_LOCATION.latitude + INITIAL_HOME_LOCATION.latitude) / 2,
          longitude: (INITIAL_DRIVER_LOCATION.longitude + INITIAL_HOME_LOCATION.longitude) / 2,
          latitudeDelta: 0.09,
          longitudeDelta: 0.09,
        }}
        zoomEnabled={true}
        scrollEnabled={true}
        showsCompass={false}
      >
        {/* Road Route Polyline connecting Car -> Home */}
        {routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2563EB"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* 🏠 Home / Destination Marker (Clean Rounded White Badge with House Icon) */}
        <Marker
          coordinate={customerLocation}
          title="Destination / Home"
          description="Drop-off location"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.homeMarkerBadge}>
            <Text style={styles.homeMarkerIcon}>🏠</Text>
          </View>
        </Marker>

        {/* 🚗 Driver Car Marker (Animated along the road) */}
        <Marker.Animated
          ref={driverMarkerRef}
          coordinate={animatedDriverCoord}
          title={`Driver: ${driverName}`}
          description={`Speed: ${driverLocation.speed || 36} km/h`}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.carMarkerBadge}>
            <Text style={styles.carMarkerIcon}>🚗</Text>
          </View>
        </Marker.Animated>
      </MapView>

      {/* Top Floating Header Pill Navigation */}
      <SafeAreaView style={styles.topHeaderContainer} pointerEvents="box-none">
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.circleHeaderBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>

          <View style={styles.pillBadge}>
            <Text style={styles.pillBadgeText}>Track Your Order</Text>
          </View>

          <TouchableOpacity
            onPress={handleShare}
            style={styles.circleHeaderBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.shareIconText}>↗</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {routeLoading && (
        <View style={styles.routeLoadingBadge}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.routeLoadingText}>Calculating road route…</Text>
        </View>
      )}

      {/* Bottom Floating Card (Matching Reference UI) */}
      <View style={styles.bottomSheetWrapper} pointerEvents="box-none">
        <View style={styles.bottomCardContainer}>
          {/* Blue Top Banner */}
          <View style={styles.blueBanner}>
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerTitle} numberOfLines={1}>
                {destinationTitle}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {`Warehouse Pickup • ${etaMinutes} min Estimated`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={recenterMap}
              style={styles.bannerLocateBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.locateIcon}>➤</Text>
            </TouchableOpacity>
          </View>

          {/* Driver Row Card */}
          <View style={styles.driverSection}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarEmoji}>👨‍✈️</Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverNameText}>{driverName}</Text>
              <Text style={styles.driverRoleText}>Driver</Text>
            </View>
            <View style={styles.driverActionsRow}>
              <TouchableOpacity
                onPress={openChat}
                style={styles.actionRoundBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>💬</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openCall}
                style={styles.actionRoundBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>📞</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Review Order Section */}
          <View style={styles.orderSection}>
            <Text style={styles.orderSectionTitle}>Review Order</Text>

            <View style={styles.bookingRow}>
              <View>
                <Text style={styles.bookingLabel}>Booking Number</Text>
                <Text style={styles.bookingNumber}>{bookingNumber}</Text>
              </View>
              <TouchableOpacity
                onPress={handleOrderDetails}
                style={styles.seeDetailsBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.seeDetailsText}>See Details</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.routeGrid}>
              <View style={styles.routeGridItem}>
                <Text style={styles.routeGridLabel}>From</Text>
                <Text style={styles.routeGridValue} numberOfLines={1}>
                  {originCity}
                </Text>
              </View>
              <View style={styles.routeGridItem}>
                <Text style={styles.routeGridLabel}>To</Text>
                <Text style={styles.routeGridValue} numberOfLines={1}>
                  {destinationCity}
                </Text>
              </View>
              <View style={styles.routeGridItem}>
                <Text style={styles.routeGridLabel}>Created</Text>
                <Text style={styles.routeGridValue}>{createdDate}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
map: {
    ...StyleSheet.absoluteFillObject,
  },
  homeMarkerBadge: {
    width: 38,
    height: 38,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1E3A8A",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  homeMarkerIcon: {
    fontSize: 20,
  },
  carMarkerBadge: {
    width: 42,
    height: 42,
    backgroundColor: "#1D4ED8",
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  carMarkerIcon: {
    fontSize: 22,
  },
  topHeaderContainer: {
    position: "absolute",
    top: Platform.OS === "android" ? 35 : 10,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  circleHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backIconText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0F172A",
  },
  shareIconText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  pillBadge: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pillBadgeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  routeLoadingBadge: {
    position: "absolute",
    top: Platform.OS === "android" ? 95 : 75,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 15,
  },
  routeLoadingText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
  },
  bottomSheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  bottomCardContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
    paddingBottom: Platform.OS === "android" ? 24 : 16,
  },
  blueBanner: {
    backgroundColor: "#1D4ED8",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerInfo: {
    flex: 1,
    marginRight: 12,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#DBEAFE",
  },
  bannerLocateBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  locateIcon: {
    fontSize: 18,
    color: "#1D4ED8",
    transform: [{ rotate: "-45deg" }],
    marginLeft: 2,
    marginTop: -2,
  },
  driverSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  driverAvatarEmoji: {
    fontSize: 26,
  },
  driverDetails: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  driverRoleText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  driverActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionRoundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIcon: {
    fontSize: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 20,
  },
  orderSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  orderSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  bookingLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    marginBottom: 2,
  },
  bookingNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  seeDetailsBtn: {
    backgroundColor: "#EEF2FF",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  seeDetailsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4338CA",
  },
  routeGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
  },
  routeGridItem: {
    flex: 1,
  },
  routeGridLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 4,
  },
  routeGridValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
});









 