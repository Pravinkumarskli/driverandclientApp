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

  const handleLogin = (idToUse, nameToUse) => {
    const finalId = idToUse || (isCustom ? customId.trim() : selectedId);
    const finalName =
      nameToUse ||
      (isCustom
        ? customName.trim() || finalId
        : PRESET_CUSTOMERS.find((c) => c.id === finalId)?.name || finalId);

    if (!finalId) return;

    // Connect socket with this user ID
    SocketService.connect(finalId);

    navigation.replace("CustomerHomeScreen", {
      userId: finalId,
      userName: finalName,
    });
  };

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
            Select your customer profile or enter custom credentials to start
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
            <Text style={styles.loginButtonText}>LOGIN AS CUSTOMER</Text>
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
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
