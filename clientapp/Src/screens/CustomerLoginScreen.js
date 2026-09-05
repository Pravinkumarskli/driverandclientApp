import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import NativeSocketService from "../services/NativeSocketService";
import SocketService from "../services/SocketService";
import { getUserSession, saveUserSession } from "../services/AuthSession";
import { WS_URL } from "../config/AppConfig";

const PRESET_CUSTOMERS = [
  {
    id: "customer_101",
    name: "Customer 101",
    role: "Regular Rider",
    phone: "+91 98765 43210",
  },
  {
    id: "customer_102",
    name: "Customer 102",
    role: "Premium Rider",
    phone: "+91 98765 43211",
  },
];

export default function CustomerLoginScreen({ navigation }) {
  const [selectedId, setSelectedId] = useState("customer_101");
  const [customId, setCustomId] = useState("");
  const [customName, setCustomName] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // ── Auto-Login on App Launch ──────────────────────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const savedSession = await getUserSession();
        if (savedSession && savedSession.userId && isMounted) {
          console.log("⚡ [AUTO-LOGIN] Found saved customer session:", savedSession);
          setIsConnecting(true);
          // Start socket background service
          NativeSocketService.start(WS_URL, savedSession.userId, "client", 5000).catch((e) =>
            console.warn("[AutoLogin] Native start error:", e),
          );
          SocketService.connect(savedSession.userId);
          
          // Check if there was a launch notification that opened the app
          const initialNotif = await NativeSocketService.getInitialNotificationData();
          if (initialNotif && isMounted) {
            console.log("🔔 [AUTO-LOGIN CUSTOMER] Routing directly from launch notification:", initialNotif);
            await NativeSocketService.clearInitialNotificationData();

            if (initialNotif.action === "INCOMING_CALL" || initialNotif.callerId) {
              let parsedOffer = null;
              if (initialNotif.offer) {
                try {
                  parsedOffer =
                    typeof initialNotif.offer === "string"
                      ? JSON.parse(initialNotif.offer)
                      : initialNotif.offer;
                } catch (e) {
                  parsedOffer = initialNotif.offer;
                }
              }
              navigation.replace("CustomerIncomingCall", {
                callerId: initialNotif.callerId || initialNotif.senderId,
                callerName: initialNotif.callerName || initialNotif.receiverName || "Driver",
                receiverId: savedSession.userId,
                receiverName: savedSession.userName || "Customer",
                offer: parsedOffer,
                autoAnswer: initialNotif.autoAnswer === true,
              });
              return;
            } else if (initialNotif.action === "OPEN_CHAT" || initialNotif.senderId) {
              navigation.replace("CustomerChat", {
                userId: savedSession.userId,
                receiverId: initialNotif.senderId,
                receiverName: initialNotif.receiverName || "Driver",
                messageId: initialNotif.messageId || "",
                message: initialNotif.message || "",
              });
              return;
            }
          }

          if (!isMounted) return;
          const currentRoute = navigation.getState()?.routes?.[navigation.getState()?.index]?.name;
          if (currentRoute && currentRoute !== "CustomerLogin") {
            console.log("⚡ [AUTO-LOGIN CUSTOMER] Already on screen:", currentRoute, "- skipping replace with CustomerHomeScreen");
            return;
          }

          navigation.replace("CustomerHomeScreen", {
            userId: savedSession.userId,
            userName: savedSession.userName || savedSession.userId,
          });
          return;
        }
      } catch (err) {
        console.warn("[AutoLogin] Check error:", err);
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  const handleLogin = async (idToUse, nameToUse) => {
    const finalId = idToUse || (isCustom ? customId.trim() : selectedId);
    const finalName =
      nameToUse ||
      (isCustom
        ? customName.trim() || finalId
        : PRESET_CUSTOMERS.find((c) => c.id === finalId)?.name || finalId);

    if (!finalId) {
      Alert.alert("Required", "Please select or enter a Customer ID");
      return;
    }

    setIsConnecting(true);

    try {
      console.log(`[CUSTOMER LOGIN] Initializing native socket for ${finalId} at ${WS_URL}`);

      // Save persistent session so user stays logged in
      await saveUserSession({
        userId: finalId,
        userName: finalName,
        userRole: "Customer",
      });

      // Start socket background service
      NativeSocketService.start(WS_URL, finalId, "client", 5000).catch((e) =>
        console.warn("[ManualLogin] Native start error:", e),
      );
      SocketService.connect(finalId);

      setIsConnecting(false);

      // Check if there was a launch notification that opened the app
      const initialNotif = await NativeSocketService.getInitialNotificationData();
      if (initialNotif) {
        console.log("🔔 [LOGIN CUSTOMER] Routing from launch notification:", initialNotif);
        await NativeSocketService.clearInitialNotificationData();

        if (initialNotif.action === "INCOMING_CALL" || initialNotif.callerId) {
          let parsedOffer = null;
          if (initialNotif.offer) {
            try {
              parsedOffer =
                typeof initialNotif.offer === "string"
                  ? JSON.parse(initialNotif.offer)
                  : initialNotif.offer;
            } catch (e) {
              parsedOffer = initialNotif.offer;
            }
          }
          navigation.replace("CustomerIncomingCall", {
            callerId: initialNotif.callerId || initialNotif.senderId,
            callerName: initialNotif.callerName || initialNotif.receiverName || "Driver",
            receiverId: finalId,
            receiverName: finalName,
            offer: parsedOffer,
            autoAnswer: initialNotif.autoAnswer === true,
          });
          return;
        } else if (initialNotif.action === "OPEN_CHAT" || initialNotif.senderId) {
          navigation.replace("CustomerChat", {
            userId: finalId,
            receiverId: initialNotif.senderId,
            receiverName: initialNotif.receiverName || "Driver",
            messageId: initialNotif.messageId || "",
          });
          return;
        }
      }

      navigation.replace("CustomerHomeScreen", {
        userId: finalId,
        userName: finalName,
      });
    } catch (error) {
      console.error("[CUSTOMER LOGIN] Socket connection error:", error);
      setIsConnecting(false);
      // Navigate gracefully
      navigation.replace("CustomerHomeScreen", {
        userId: finalId,
        userName: finalName,
      });
    }
  };

  if (isCheckingSession) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingScreen]}>
        <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingScreenText}>Loading Cab Connect...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.appTag}>CAB CONNECT</Text>
          <Text style={styles.headerTitle}>Customer Portal</Text>
          <Text style={styles.headerSubtitle}>
            Native Android OkHttp WebSocket & WebRTC Calling
          </Text>
        </View>

        {/* Profiles Section */}
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>CHOOSE YOUR PROFILE</Text>

          {PRESET_CUSTOMERS.map((cust) => {
            const isSelected = !isCustom && selectedId === cust.id;
            return (
              <TouchableOpacity
                key={cust.id}
                style={[
                  styles.profileCard,
                  isSelected && styles.profileCardActive,
                ]}
                onPress={() => {
                  setIsCustom(false);
                  setSelectedId(cust.id);
                }}
                disabled={isConnecting}
                activeOpacity={0.8}
              >
                <View style={styles.profileInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName}>{cust.name}</Text>
                    <View
                      style={[
                        styles.tagPill,
                        isSelected ? styles.tagPillActive : styles.tagPillInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagPillText,
                          isSelected && styles.tagPillTextActive,
                        ]}
                      >
                        {cust.role}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.profileId}>ID: {cust.id}</Text>
                  <Text style={styles.profilePhone}>{cust.phone}</Text>
                </View>

                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleActive,
                  ]}
                >
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Custom Login Accordion */}
          <TouchableOpacity
            style={[styles.customCard, isCustom && styles.profileCardActive]}
            onPress={() => setIsCustom(true)}
            disabled={isConnecting}
            activeOpacity={0.8}
          >
            <View style={styles.nameRow}>
              <Text style={styles.customCardTitle}>Custom Account</Text>
              <View
                style={[
                  styles.radioCircle,
                  isCustom && styles.radioCircleActive,
                ]}
              >
                {isCustom && <View style={styles.radioInner} />}
              </View>
            </View>

            {isCustom && (
              <View style={styles.customInputBox}>
                <Text style={styles.inputLabel}>CUSTOMER ID</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. customer_103"
                  placeholderTextColor="#94A3B8"
                  value={customId}
                  onChangeText={setCustomId}
                  autoCapitalize="none"
                  editable={!isConnecting}
                />

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                  CUSTOMER NAME
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Rahul"
                  placeholderTextColor="#94A3B8"
                  value={customName}
                  onChangeText={setCustomName}
                  editable={!isConnecting}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.loginButton, isConnecting && styles.loginButtonDisabled]}
            onPress={() => handleLogin()}
            disabled={isConnecting}
            activeOpacity={0.85}
          >
            {isConnecting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.loginButtonText}>CONNECTING...</Text>
              </View>
            ) : (
              <Text style={styles.loginButtonText}>LOGIN AS CUSTOMER</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1E3A8A",
  },
  loadingScreen: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E3A8A",
  },
  loadingScreenText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "space-between",
  },
  header: {
    backgroundColor: "#1E3A8A",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  appTag: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  headerSubtitle: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  profileCardActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  tagPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tagPillActive: {
    backgroundColor: "#DBEAFE",
  },
  tagPillInactive: {
    backgroundColor: "#F1F5F9",
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  tagPillTextActive: {
    color: "#1D4ED8",
  },
  profileId: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  profilePhone: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioCircleActive: {
    borderColor: "#2563EB",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  customCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  customCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  customInputBox: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
    paddingTop: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 1,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0F172A",
  },
  footer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  loginButton: {
    backgroundColor: "#2563EB",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#2563EB",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  loginButtonDisabled: {
    backgroundColor: "#60A5FA",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
