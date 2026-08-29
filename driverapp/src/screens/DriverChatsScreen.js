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

export default function DriverChatsScreen({ route, navigation }) {
  const { driverId = "driver_201", driverName = "Arun" } = route.params || {};

  const [customers, setCustomers] = useState([
    {
      id: "customer_101",
      name: "Customer 101",
      phone: "+91 98765 43210",
      online: true,
    },
    {
      id: "customer_102",
      name: "Customer 102",
      phone: "+91 98765 43211",
      online: false,
    },
  ]);

  useEffect(() => {
    SocketService.connect(driverId);
    SocketService.on("customerList", (list) => {
      if (Array.isArray(list) && list.length > 0) {
        setCustomers(list);
      }
    });

    return () => {
      SocketService.off("customerList");
    };
  }, [driverId]);

  const openChat = (customer) => {
    navigation.navigate("DriverChat", {
      userId: driverId,
      receiverId: customer.id,
      receiverName: customer.name,
    });
  };

  const renderCustomer = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => openChat(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0) : "C"}
          </Text>
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <View
              style={[
                styles.statusBadge,
                item.online ? styles.statusBadgeOnline : styles.statusBadgeOffline,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  item.online && styles.statusBadgeTextOnline,
                ]}
              >
                {item.online ? "ONLINE" : "OFFLINE"}
              </Text>
            </View>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.online
              ? "Tap to send a message or coordinate ride"
              : "Customer is currently offline"}
          </Text>
        </View>

        <View style={styles.openButton}>
          <Text style={styles.openButtonText}>CHAT</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Header (Text-Only) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>BACK</Text>
          </TouchableOpacity>
          <Text style={styles.title}>CUSTOMER CHATS</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{customers.length} ACTIVE</Text>
          </View>
        </View>

        {/* Customer List */}
        <FlatList
          data={customers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No active customer chats</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    height: 64,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: "#EFF6FF",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  list: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
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
    color: "#DC2626",
    fontSize: 18,
    fontWeight: "800",
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  statusBadgeOnline: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgeOffline: {
    backgroundColor: "#F1F5F9",
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  statusBadgeTextOnline: {
    color: "#15803D",
  },
  lastMessage: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },
  openButton: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  openButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.5,
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
  },
});
