import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import SocketService from "../services/SocketService";
import NativeSocketService from "../services/NativeSocketService";
import { clearDriverSession } from "../services/AuthSession";


export default function DriverHomeScreen({ route, navigation }) {
  const {
    driverId = "driver_201",
    driverName = "Arun",
    vehicle = "Prime Sedan (TN 01 AB 1234)",
  } = route.params || {};

  const [isOnline, setIsOnline] = useState(true);

  const activeCustomer = {
    id: "customer_101",
    name: "Customer 101",
    pickup: "Kalapet Beach Road",
    drop: "Pondicherry White Town",
    fare: "350 INR",
    phone: "+91 98765 43210",
  };

  useEffect(() => {
    SocketService.connect(driverId);

    // The foreground socket service is started once during login. Starting it
    // again here can crash some Android devices when the service is rebinding.
    NativeSocketService.getInitialNotificationData()
      .then((data) => {
        if (data?.senderId) {
          navigation.navigate("DriverChat", {
            userId: driverId,
            receiverId: data.senderId,
            receiverName: data.receiverName || "Customer",
            messageId: data.messageId || "",
          });
        }
      })
      .catch((error) => console.warn("Notification launch data unavailable:", error));

    const unsubscribeNotification = NativeSocketService.onNotificationOpened((data) => {
      if (data?.senderId) {
        navigation.navigate("DriverChat", {
          userId: driverId,
          receiverId: data.senderId,
          receiverName: data.receiverName || "Customer",
          messageId: data.messageId || "",
        });
      }
    });

    const handleIncomingCall = (data) => {
      navigation.navigate("IncomingCall", {
        callerId: data.senderId || data.callerId,
        callerName: data.senderName || data.callerName || "Customer 101",
        receiverId: data.receiverId,
        offer: data.offer,
      });
    };

    SocketService.on("incomingCall", handleIncomingCall);

    return () => {
      SocketService.off("incomingCall", handleIncomingCall);
      unsubscribeNotification();
    };
  }, [driverId, navigation]);

  const toggleStatus = (value) => {
    setIsOnline(value);
  };

  const openChat = () => {
    navigation.navigate("DriverChat", {
      userId: driverId,
      receiverId: activeCustomer.id,
      receiverName: activeCustomer.name,
    });
  };

  const openTracking = () => {
    navigation.navigate("DriverTracking", {
      driverId: driverId,
      customerId: activeCustomer.id,
      customerName: activeCustomer.name,
    });
  };

  const openCall = () => {
    navigation.navigate("DriverCallScreen", {
      userId: driverId,
      receiverId: activeCustomer.id,
      receiverName: activeCustomer.name,
    });
  };

  const handleSwitchDriver = async () => {
    await clearDriverSession();
    NativeSocketService.stop();
    SocketService.disconnect();
    navigation.replace("DriverLogin");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
      <View style={styles.container}>
        {/* Sleek Top Header (Text-Only) */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerBadge}>CAB DRIVER PORTAL</Text>
            <Text style={styles.driverGreeting}>{driverName}</Text>
            <Text style={styles.vehicleText}>{vehicle}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={handleSwitchDriver}
              activeOpacity={0.8}
            >
              <Text style={styles.switchBtnText}>SWITCH</Text>
            </TouchableOpacity>

            <View style={styles.statusToggleContainer}>
              <Text
                style={[
                  styles.statusText,
                  isOnline ? styles.onlineText : styles.offlineText,
                ]}
              >
                {isOnline ? "ONLINE" : "OFFLINE"}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={toggleStatus}
                thumbColor={isOnline ? "#FFFFFF" : "#F4F4F5"}
                trackColor={{ false: "#71717A", true: "#16A34A" }}
              />
            </View>
          </View>
        </View>

        {/* Main Content - Compact, Screen-Fitted, Text-Only Controls */}
        <View style={styles.content}>
          {/* Active Booking Card with Focused 3 Actions: MESSAGE, TRACKING, CALL */}
          <View style={styles.bookingCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.customerAvatar}>
                <Text style={styles.customerAvatarText}>C</Text>
              </View>
              <View style={styles.customerInfo}>
                <View style={styles.customerNameRow}>
                  <Text style={styles.customerName}>{activeCustomer.name}</Text>
                  <View style={styles.activeRideBadge}>
                    <Text style={styles.activeRideText}>ACTIVE RIDE</Text>
                  </View>
                </View>
                <Text style={styles.customerPhone}>{activeCustomer.phone}</Text>
              </View>
              <Text style={styles.fareTag}>{activeCustomer.fare}</Text>
            </View>

            {/* Route Box */}
            <View style={styles.routeBox}>
              <View style={styles.routeRow}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeValue} numberOfLines={1}>
                  {activeCustomer.pickup}
                </Text>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.routeRow}>
                <Text style={styles.routeLabel}>DROP</Text>
                <Text style={styles.routeValue} numberOfLines={1}>
                  {activeCustomer.drop}
                </Text>
              </View>
            </View>

            {/* 3 Core Primary Action Buttons (Text-Only) */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.chatButton]}
                onPress={openChat}
                activeOpacity={0.8}
              >
                <Text style={styles.chatButtonText}>MESSAGE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.trackingButton]}
                onPress={openTracking}
                activeOpacity={0.8}
              >
                <Text style={styles.trackingButtonText}>TRACKING</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.callButton]}
                onPress={openCall}
                activeOpacity={0.8}
              >
                <Text style={styles.callButtonText}>CALL</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Summary Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TODAY'S EARNINGS</Text>
              <Text style={styles.statAmount}>1,250 INR</Text>
              <Text style={styles.statSub}>8 Completed Trips</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>DRIVER RATING</Text>
              <Text style={styles.statAmount}>4.8 / 5.0</Text>
              <Text style={styles.statSub}>98% Acceptance</Text>
            </View>
          </View>
        </View>

        {/* Bottom Navigation (Text-Only) */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} activeOpacity={0.8}>
            <Text style={styles.navLabelActive}>HOME</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() =>
              navigation.navigate("DriverChats", {
                driverId,
                driverName,
              })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.navLabel}>CHATS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={openTracking}
            activeOpacity={0.8}
          >
            <Text style={styles.navLabel}>GPS TRACK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#DC2626",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "space-between",
  },
  header: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  headerLeft: {
    flex: 1,
  },
  headerBadge: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  driverGreeting: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  vehicleText: {
    color: "#FEE2E2",
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  switchBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  switchBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  statusToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  onlineText: {
    color: "#FFFFFF",
  },
  offlineText: {
    color: "#D1D5DB",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "space-around",
  },
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarText: {
    color: "#DC2626",
    fontSize: 18,
    fontWeight: "800",
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  activeRideBadge: {
    backgroundColor: "#DCFCE7",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  activeRideText: {
    color: "#15803D",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  customerPhone: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  fareTag: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "900",
  },
  routeBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    width: 50,
  },
  routeValue: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  routeDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 6,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
  trackingButton: {
    backgroundColor: "#059669",
  },
  trackingButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  callButton: {
    backgroundColor: "#DC2626",
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statAmount: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 3,
  },
  statSub: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  bottomNav: {
    height: 56,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  navLabelActive: {
    fontSize: 11,
    color: "#DC2626",
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
