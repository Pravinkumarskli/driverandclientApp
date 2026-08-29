import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

import SocketService from "../services/SocketService";

export default function CustomerTrackingScreen({ route, navigation }) {
  const {
    customerId = "customer_101",
    driverId = "driver_201",
    driverName = "Arun",
  } = route.params || {};

  const mapRef = useRef(null);

  const [driverLocation, setDriverLocation] = useState({
    driverId: driverId,
    latitude: 12.0125,
    longitude: 79.855,
    accuracy: 5,
    speed: 36,
    heading: 90,
    timestamp: Date.now(),
  });

  const customerLocation = {
    latitude: 11.9416,
    longitude: 79.8083,
  };

  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    console.log("CUSTOMER START TRACKING FOR:", customerId, "->", driverId);
    SocketService.connect(customerId);
    SocketService.startTracking(customerId, driverId);

    const handleDriverLocation = (data) => {
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      console.log("CUSTOMER RECEIVED GPS LOCATION UPDATE:", data);
      setDriverLocation(data);
      setUpdateCount((prev) => prev + 1);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
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

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        {/* Customer Location */}
        <Marker
          coordinate={customerLocation}
          title="CUSTOMER PICKUP POINT"
          description="Kalapet Beach Road"
          pinColor="#2563EB"
        />

        {/* Driver Location */}
        <Marker
          coordinate={{
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
          }}
          title={`DRIVER: ${driverName.toUpperCase()}`}
          description={`Speed: ${driverLocation.speed || 35} km/h`}
          pinColor="#DC2626"
        />
      </MapView>

      {/* Floating Top Header (Text-Only) */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>BACK</Text>
          </TouchableOpacity>

          <View style={styles.titleCard}>
            <Text style={styles.titleText}>LIVE GPS TRACKING</Text>
            <View style={styles.liveIndicator}>
              <Text style={styles.liveText}>
                {updateCount > 0 ? "LIVE SIGNAL" : "SIGNAL ACTIVE"}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Floating Bottom Card with Driver Info, Telemetry, and Text-Only Actions */}
      <View style={styles.bottomCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{driverName.charAt(0)}</Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.carModel}>Prime Sedan • TN 01 AB 1234</Text>
          </View>
          <View style={styles.etaBadge}>
            <Text style={styles.etaTime}>4 MINS</Text>
            <Text style={styles.etaLabel}>ESTIMATED</Text>
          </View>
        </View>

        {/* Real-time GPS Coordinates and Telemetry */}
        <View style={styles.telemetryGrid}>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryKey}>LATITUDE</Text>
            <Text style={styles.telemetryVal}>
              {Number(driverLocation.latitude).toFixed(4)}
            </Text>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryKey}>LONGITUDE</Text>
            <Text style={styles.telemetryVal}>
              {Number(driverLocation.longitude).toFixed(4)}
            </Text>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryKey}>SPEED</Text>
            <Text style={styles.telemetryVal}>
              {driverLocation.speed || 35} KM/H
            </Text>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryKey}>UPDATES</Text>
            <Text style={styles.telemetryVal}>#{updateCount || 1}</Text>
          </View>
        </View>

        {/* Text-Only Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.chatBtn]}
            onPress={openChat}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>MESSAGE DRIVER</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.callBtn]}
            onPress={openCall}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>CALL DRIVER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  backButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  backButtonText: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  titleCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  titleText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  liveIndicator: {
    backgroundColor: "#ECFDF5",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  liveText: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  bottomCard: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    elevation: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#1D4ED8",
    fontSize: 18,
    fontWeight: "800",
  },
  driverDetails: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  carModel: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  etaBadge: {
    backgroundColor: "#EFF6FF",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  etaTime: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "800",
  },
  etaLabel: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "700",
  },
  telemetryGrid: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  telemetryItem: {
    flex: 1,
    alignItems: "center",
  },
  telemetryKey: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  telemetryVal: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  telemetryDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chatBtn: {
    backgroundColor: "#2563EB",
  },
  callBtn: {
    backgroundColor: "#475569",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
