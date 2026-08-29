import React, { useState } from "react";
import {
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

import SocketService from "../services/SocketService";

const PRESET_DRIVERS = [
  {
    id: "driver_201",
    name: "Arun",
    car: "Prime Sedan (TN 01 AB 1234)",
    rating: "4.8",
    phone: "+91 98765 11201",
  },
  {
    id: "driver_202",
    name: "Kumar",
    car: "Mini Hatchback (TN 01 CD 5678)",
    rating: "4.7",
    phone: "+91 98765 11202",
  },
  {
    id: "driver_203",
    name: "Ravi",
    car: "Auto Rickshaw (TN 01 EF 9012)",
    rating: "4.9",
    phone: "+91 98765 11203",
  },
];

export default function DriverLoginScreen({ navigation }) {
  const [selectedId, setSelectedId] = useState("driver_201");
  const [customId, setCustomId] = useState("");
  const [customName, setCustomName] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const handleLogin = (idToUse, nameToUse) => {
    const finalId = idToUse || (isCustom ? customId.trim() : selectedId);
    const finalDriver = PRESET_DRIVERS.find((d) => d.id === finalId);
    const finalName =
      nameToUse ||
      (isCustom
        ? customName.trim() || finalId
        : finalDriver?.name || finalId);
    const finalCar = isCustom ? "Custom Cab" : finalDriver?.car || "Cab";

    if (!finalId) return;

    // Connect socket with this driver ID
    SocketService.connect(finalId);

    navigation.replace("DriverHome", {
      driverId: finalId,
      driverName: finalName,
      vehicle: finalCar,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.appTag}>CAB DRIVER PORTAL</Text>
          <Text style={styles.headerTitle}>Driver Login</Text>
          <Text style={styles.headerSubtitle}>
            Select your driver profile or enter custom driver credentials
          </Text>
        </View>

        {/* Driver List */}
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>CHOOSE DRIVER ACCOUNT</Text>

          {PRESET_DRIVERS.map((driver) => {
            const isSelected = !isCustom && selectedId === driver.id;
            return (
              <TouchableOpacity
                key={driver.id}
                style={[
                  styles.profileCard,
                  isSelected && styles.profileCardActive,
                ]}
                onPress={() => {
                  setIsCustom(false);
                  setSelectedId(driver.id);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.profileInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName}>{driver.name}</Text>
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
                        Rating: {driver.rating}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.profileVehicle}>{driver.car}</Text>
                  <Text style={styles.profileId}>ID: {driver.id}</Text>
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

          {/* Custom Driver Account */}
          <TouchableOpacity
            style={[styles.customCard, isCustom && styles.profileCardActive]}
            onPress={() => setIsCustom(true)}
            activeOpacity={0.8}
          >
            <View style={styles.nameRow}>
              <Text style={styles.customCardTitle}>Custom Driver Account</Text>
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
                <Text style={styles.inputLabel}>DRIVER ID</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. driver_204"
                  placeholderTextColor="#94A3B8"
                  value={customId}
                  onChangeText={setCustomId}
                  autoCapitalize="none"
                />

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                  DRIVER NAME
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Manikandan"
                  placeholderTextColor="#94A3B8"
                  value={customName}
                  onChangeText={setCustomName}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => handleLogin()}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>LOGIN AS DRIVER</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  appTag: {
    color: "#FCA5A5",
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
    color: "#FEE2E2",
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
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
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
    backgroundColor: "#FEE2E2",
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
    color: "#DC2626",
  },
  profileVehicle: {
    fontSize: 13,
    color: "#475569",
    marginTop: 3,
    fontWeight: "600",
  },
  profileId: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
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
    borderColor: "#DC2626",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DC2626",
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
    borderTopColor: "#FECACA",
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
    backgroundColor: "#DC2626",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#DC2626",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
