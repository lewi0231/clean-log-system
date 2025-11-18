import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

const NAME_OPTIONS = [
  { label: "Alice", value: "Alice" },
  { label: "Bob", value: "Bob" },
  { label: "Charlie", value: "Charlie" },
];

const LOCATION_OPTIONS = [
  { label: "EasyAuto Warehouse", value: "EasyAuto Warehouse" },
  { label: "Reynella Kia", value: "Reynella Kia" },
  { label: "Toyota Hillcrest [New]", value: "Toyota Hillcrest [New]" },
];

export default function HomeScreen() {
  // Use empty string as a safe "no selection" value for pickers
  const [selectedName, setSelectedName] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [soaps, setSoaps] = useState<string>("0");
  const [wipes, setWipes] = useState<string>("0");

  const soapsValue = Number(soaps) || 0;
  const wipesValue = Number(wipes) || 0;

  const handleSubmit = () => {
    console.log({
      name: selectedName || "(none)",
      location: selectedLocation || "(none)",
      soaps: soapsValue,
      wipe: wipesValue,
    });

    setSelectedName("");
    setSelectedLocation("");
    setWipes("0");
    setSoaps("0");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Clean Log</ThemedText>
      </ThemedView>

      {/* Name field */}
      <ThemedView style={styles.fieldContainer}>
        <ThemedText type="subtitle" style={styles.label}>
          Name
        </ThemedText>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.placeholder}
          selectedTextStyle={styles.selectedText}
          itemTextStyle={styles.itemText}
          containerStyle={styles.dropdownContainer}
          itemContainerStyle={styles.dropdownItem}
          activeColor="#f0f0f0"
          data={NAME_OPTIONS}
          labelField="label"
          valueField="value"
          placeholder="Select a name..."
          value={selectedName || null}
          onChange={(item) => {
            setSelectedName(item.value);
          }}
        />
      </ThemedView>

      {/* Location field */}
      <ThemedView style={styles.fieldContainer}>
        <ThemedText type="subtitle" style={styles.label}>
          Location
        </ThemedText>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.placeholder}
          selectedTextStyle={styles.selectedText}
          itemTextStyle={styles.itemText}
          containerStyle={styles.dropdownContainer}
          itemContainerStyle={styles.dropdownItem}
          activeColor="#f0f0f0"
          data={LOCATION_OPTIONS}
          labelField="label"
          valueField="value"
          placeholder="Select a location..."
          value={selectedLocation || null}
          onChange={(item) => {
            setSelectedLocation(item.value);
          }}
        />
      </ThemedView>

      {/* Soaps numeric input */}
      <ThemedView style={styles.fieldContainer}>
        <ThemedText type="subtitle" style={styles.label}>
          Soaps
        </ThemedText>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={soaps}
          onChangeText={setSoaps}
        />
      </ThemedView>

      {/* Wipes numeric input */}
      <ThemedView style={styles.fieldContainer}>
        <ThemedText type="subtitle" style={styles.label}>
          Wipes
        </ThemedText>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={wipes}
          onChangeText={setWipes}
        />
      </ThemedView>

      {/* Submit button - using Pressable instead of Button */}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleSubmit}
      >
        <ThemedText style={styles.buttonText}>Submit</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 20,
  },
  contentContainer: {
    padding: 20,
    gap: 20,
  },
  titleContainer: {
    marginBottom: 8,
    paddingBottom: 16,
    backgroundColor: "inherit",
  },
  fieldContainer: {
    gap: 10,
    marginBottom: 8,
    backgroundColor: "inherit",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    color: "#333",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderRadius: 12,
    borderColor: "#e0e0e0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    // Modern shadow effect
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2, // Android shadow
  },
  dropdown: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderRadius: 12,
    borderColor: "#e0e0e0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    // Modern shadow effect
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2, // Android shadow
  },
  dropdownContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    marginTop: 4,
    // Enhanced shadow for dropdown menu
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5, // Android shadow
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  placeholder: {
    color: "#999",
    fontSize: 16,
  },
  selectedText: {
    color: "#1a1a1a",
    fontSize: 16,
    fontWeight: "500",
  },
  itemText: {
    color: "#333",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007AFF", // iOS blue, or use your brand color
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    // Modern shadow
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5, // Android shadow
  },
  buttonPressed: {
    backgroundColor: "#0051D5", // Darker when pressed
    transform: [{ scale: 0.98 }], // Slight scale down for feedback
    shadowOpacity: 0.2,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    backgroundColor: "lightgray",
  },
});
