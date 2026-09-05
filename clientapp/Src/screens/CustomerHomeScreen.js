import React, { useEffect, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import SocketService from "../services/SocketService";
import NativeSocketService from "../services/NativeSocketService";
import { clearUserSession } from "../services/AuthSession";
import LocationTracker from './LocationTraker';
import { WS_URL } from "../config/AppConfig";


export default function CustomerHomeScreen({ route, navigation }) {
  const { userId = "customer_101", userName = "Customer 101" } =
    route.params || {};

  const [drivers, setDrivers] = useState([
    {
      id: "driver_201",
      name: "Arun",
      car: "Prime Sedan (TN 01 AB 1234)",
      phone: "+91 98765 11201",
      rating: "4.8",
      online: true,
    },
    {
      id: "driver_202",
      name: "Kumar",
      car: "Mini Hatchback (TN 01 CD 5678)",
      phone: "+91 98765 11202",
      rating: "4.7",
      online: false,
    },
    {
      id: "driver_203",
      name: "Ravi",
      car: "Auto Rickshaw (TN 01 EF 9012)",
      phone: "+91 98765 11203",
      rating: "4.9",
      online: false,
    },
  ]);

  useEffect(() => {
    SocketService.connect(userId);
    // Service is already started from LoginScreen. Don't call start() again.

    SocketService.onDriverList((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setDrivers(list);
      }
    });

    const incomingCall = (data) => {
      navigation.navigate("CustomerIncomingCall", {
        callerId: data.senderId || data.callerId,
        receiverId: data.receiverId,
        receiverName: data.senderName || data.callerName || "Driver",
        offer: data.offer,
      });
    };

    SocketService.onIncomingCall(incomingCall);

    return () => {
      SocketService.off("driverList");
      SocketService.off("incomingCall", incomingCall);
    };
  }, [navigation, userId]);

  const openChat = (driver) => {
    navigation.navigate("CustomerChat", {
      userId: userId,
      receiverId: driver.id,
      receiverName: driver.name,
    });
  };

  // const openTracking = (driver) => {
  //   navigation.navigate("CustomerTracking", {
  //     customerId: userId,
  //     driverId: driver.id,
  //     driverName: driver.name,
  //   });
  // };

  const openTracking = (driver) => {
    navigation.navigate("Map", {
      customerId: userId,
      driverId: driver.id,
      driverName: driver.name,
    });
  };

  const openCall = (driver) => {
    navigation.navigate("CustomerCallScreen", {
      userId: userId,
      receiverId: driver.id,
      receiverName: driver.name,
    });
  };

  const handleSwitchUser = async () => {
    await clearUserSession();
    NativeSocketService.stop();
    SocketService.disconnect();
    navigation.replace("CustomerLogin");
  };

  const renderDriver = ({ item: driver }) => {
    const isPrimary = driver.id === "driver_201";

    return (
      <View style={[styles.driverCard, isPrimary && styles.primaryCard]}>
        {isPrimary && (
          <View style={styles.assignedBadge}>
            <Text style={styles.assignedBadgeText}>ASSIGNED DRIVER</Text>
          </View>
        )}

        {/* Top Info */}
        <View style={styles.driverTop}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{driver.name.charAt(0)}</Text>
            </View>
          </View>

          <View style={styles.driverInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>
                  Rating: {driver.rating || "4.8"}
                </Text>
              </View>
            </View>
            <Text style={styles.carModel}>
              {driver.car || "Prime Sedan • TN 01 AB 1234"}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusPill,
                  driver.online ? styles.onlinePill : styles.offlinePill,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    !driver.online && styles.offlinePillText,
                  ]}
                >
                  {driver.online ? "ONLINE" : "OFFLINE"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Active Route Info */}
        <View style={styles.routeBox}>
          <View style={styles.routeItem}>
            <Text style={styles.routeTag}>PICKUP</Text>
            <Text style={styles.routeText} numberOfLines={1}>
              Kalapet Beach Road
            </Text>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeItem}>
            <Text style={styles.routeTag}>DROP</Text>
            <Text style={styles.routeText} numberOfLines={1}>
              Pondicherry White Town
            </Text>
          </View>
        </View>

        {/* 3 Core Primary Action Buttons (Text-Only) */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.chatBtn]}
            onPress={() => openChat(driver)}
            activeOpacity={0.8}
          >
            <Text style={styles.chatBtnText}>MESSAGE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.trackBtn]}
            onPress={() => openTracking(driver)}
            activeOpacity={0.8}
          >
            <Text style={styles.trackBtnText}>TRACKING</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.callBtn]}
            onPress={() => openCall(driver)}
            activeOpacity={0.8}
          >
            <Text style={styles.callBtnText}>CALL</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />
      <View style={styles.container}>
        {/* Modern Header Banner */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.appTag}>CAB CONNECT • CUSTOMER</Text>
              <Text style={styles.headerTitle}>{userName}</Text>
              <Text style={styles.userSubText}>Account: {userId}</Text>
            </View>
            <TouchableOpacity
              style={styles.switchButton}
              onPress={handleSwitchUser}
              activeOpacity={0.8}
            >
              <Text style={styles.switchButtonText}>SWITCH</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>
            Active connection to driver with instant messaging, tracking, and voice calling.
          </Text>
        </View>

        {/* Driver Section */}
        <View style={styles.body}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Drivers</Text>
            <Text style={styles.driverCountBadge}>
              {drivers.length} DRIVERS
            </Text>
          </View>

          <FlatList
            data={drivers}
            renderItem={renderDriver}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Connecting to drivers...</Text>
              </View>
            }
          />
        </View>
        <LocationTracker/>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1E3A8A",
  },
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  header: {
    backgroundColor: "#1E3A8A",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  appTag: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
  },
  userSubText: {
    color: "#CBD5E1",
    fontSize: 12,
    marginTop: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  switchButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  switchButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    color: "#E2E8F0",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  body: {
    flex: 1,
    paddingTop: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  driverCountBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
    backgroundColor: "#DBEAFE",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  driverCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  primaryCard: {
    borderColor: "#3B82F6",
    borderWidth: 1.5,
  },
  assignedBadge: {
    backgroundColor: "#EFF6FF",
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  assignedBadgeText: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  driverTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#1D4ED8",
    fontSize: 22,
    fontWeight: "800",
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  driverName: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
  },
  ratingBadge: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  ratingText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "800",
  },
  carModel: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  statusRow: {
    marginTop: 5,
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  offlinePill: {
    backgroundColor: "#F1F5F9",
  },
  statusPillText: {
    color: "#065F46",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  offlinePillText: {
    color: "#64748B",
  },
  routeBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeTag: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    width: 54,
  },
  routeText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  routeDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 6,
  },
  actionsContainer: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chatBtn: {
    backgroundColor: "#2563EB",
  },
  chatBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  trackBtn: {
    backgroundColor: "#059669",
  },
  trackBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  callBtn: {
    backgroundColor: "#475569",
  },
  callBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
});
