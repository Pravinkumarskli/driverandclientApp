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

export default function DriverTrackingScreen({ route, navigation }) {
  const {
    driverId = "driver_201",
    customerId = "customer_101",
    customerName = "Customer 101",
  } = route.params || {};

  const mapRef = useRef(null);
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [broadcastCount, setBroadcastCount] = useState(0);

  // Driver location (Kalapet)
  const [driverCoord, setDriverCoord] = useState({
    latitude: 12.0125,
    longitude: 79.855,
  });

  const customerCoord = {
    latitude: 11.9416,
    longitude: 79.8083,
  };

  const [speed, setSpeed] = useState(38);

  useEffect(() => {
    SocketService.connect(driverId);

    // Initial broadcast
    SocketService.sendLocation({
      driverId: driverId,
      latitude: driverCoord.latitude,
      longitude: driverCoord.longitude,
      accuracy: 5,
      speed: 38,
      heading: 90,
      timestamp: Date.now(),
    });
    setBroadcastCount(1);

    // Periodic live movement broadcast towards customer
    let step = 0;
    const interval = setInterval(() => {
      if (!isBroadcasting) return;

      step += 1;
      const latDelta = (customerCoord.latitude - 12.0125) * (step / 80);
      const lngDelta = (customerCoord.longitude - 79.855) * (step / 80);

      const nextLat = 12.0125 + latDelta;
      const nextLng = 79.855 + lngDelta;
      const simulatedSpeed = 35 + (step % 10);

      setDriverCoord({ latitude: nextLat, longitude: nextLng });
      setSpeed(simulatedSpeed);
      setBroadcastCount((prev) => prev + 1);

      SocketService.sendLocation({
        driverId: driverId,
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
    };
  }, [customerCoord.latitude, customerCoord.longitude, driverId, isBroadcasting]);

  const toggleBroadcast = () => {
    setIsBroadcasting((prev) => !prev);
  };

  const openChat = () => {
    navigation.navigate("DriverChat", {
      userId: driverId,
      receiverId: customerId,
      receiverName: customerName,
    });
  };

  const openCall = () => {
    navigation.navigate("DriverCallScreen", {
      userId: driverId,
      receiverId: customerId,
      receiverName: customerName,
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
          latitude: driverCoord.latitude,
          longitude: driverCoord.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        {/* Customer Location Marker */}
        <Marker
          coordinate={customerCoord}
          title={`CUSTOMER: ${customerName.toUpperCase()}`}
          description="Customer Pickup Location"
          pinColor="#2563EB"
        />

        {/* Driver Location Marker */}
        <Marker
          coordinate={driverCoord}
          title="YOUR DRIVER LOCATION"
          description={`Speed: ${speed} km/h • Broadcast Active`}
          pinColor="#DC2626"
        />
      </MapView>

      {/* Floating Header (Text-Only) */}
      <SafeAreaView style={styles.headerArea}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>BACK</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>DRIVER GPS BROADCAST</Text>
            <TouchableOpacity
              style={[
                styles.broadcastPill,
                isBroadcasting ? styles.broadcastActive : styles.broadcastPaused,
              ]}
              onPress={toggleBroadcast}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.broadcastText,
                  !isBroadcasting && styles.broadcastTextInactive,
                ]}
              >
                {isBroadcasting ? "BROADCASTING" : "PAUSED"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom Information & Action Card (Text-Only) */}
      <View style={styles.bottomCard}>
        <View style={styles.customerHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>C</Text>
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{customerName}</Text>
            <Text style={styles.rideRoute}>Kalapet to Pondicherry</Text>
          </View>
          <View style={styles.fareBadge}>
            <Text style={styles.fareText}>350 INR</Text>
          </View>
        </View>

        {/* Real-time Telemetry Grid */}
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>GPS SPEED</Text>
            <Text style={styles.telemetryValue}>{speed} KM/H</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>LATITUDE</Text>
            <Text style={styles.telemetryValue}>
              {driverCoord.latitude.toFixed(4)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>LONGITUDE</Text>
            <Text style={styles.telemetryValue}>
              {driverCoord.longitude.toFixed(4)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>SENT</Text>
            <Text style={styles.telemetryValue}>#{broadcastCount}</Text>
          </View>
        </View>

        {/* Text-Only Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.chatBtn]}
            onPress={openChat}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>MESSAGE CUSTOMER</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.callBtn]}
            onPress={openCall}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>CALL CUSTOMER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerArea: {
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
  backBtn: {
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
  backBtnText: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerTitleBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  broadcastPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  broadcastActive: {
    backgroundColor: "#ECFDF5",
  },
  broadcastPaused: {
    backgroundColor: "#F1F5F9",
  },
  broadcastText: {
    color: "#059669",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  broadcastTextInactive: {
    color: "#64748B",
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
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "800",
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  rideRoute: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  fareBadge: {
    backgroundColor: "#FEF2F2",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  fareText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "800",
  },
  telemetryRow: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  telemetryBox: {
    flex: 1,
    alignItems: "center",
  },
  telemetryLabel: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  telemetryValue: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  divider: {
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
    backgroundColor: "#059669",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
