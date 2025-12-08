import { Drawer } from "@/components/ui/drawer";
import { Select, SelectItem } from "@/components/ui/select";
import { FieldConfig } from "@clean-log/shared/types/field-config";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

export interface GroupedBreakdownItem {
  brand: string;
  quantity: number;
}

interface GroupedBreakdownFieldProps {
  config: FieldConfig;
  value: GroupedBreakdownItem[];
  onChange: (items: GroupedBreakdownItem[]) => void;
  disabled?: boolean;
}

export function GroupedBreakdownField({
  config,
  value = [],
  onChange,
  disabled = false,
}: GroupedBreakdownFieldProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [quantity, setQuantity] = useState("");

  const options = config.options || [];
  const validationRules = config.validation_rules;
  const maxItems = validationRules?.max_items ?? options.length;
  const minItems = validationRules?.min_items ?? 0;
  const allowZeroQuantities = validationRules?.allow_zero_quantities ?? false;

  // Get available brands (not already selected)
  const availableBrands = options.filter(
    (option) => !value.some((item) => item.brand === option)
  );

  const handleAddItem = () => {
    if (!selectedBrand || !quantity) return;

    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 0) return;
    if (!allowZeroQuantities && quantityNum === 0) return;

    // Check if we've reached max items
    if (value.length >= maxItems) return;

    const newItems = [
      ...value,
      { brand: selectedBrand, quantity: quantityNum },
    ];
    onChange(newItems);
    setSelectedBrand("");
    setQuantity("");
    setDrawerOpen(false);
  };

  const handleRemoveItem = (brand: string) => {
    onChange(value.filter((item) => item.brand !== brand));
  };

  const handleUpdateQuantity = (brand: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    if (!allowZeroQuantities && newQuantity === 0) {
      // Remove item instead of setting to 0
      handleRemoveItem(brand);
      return;
    }

    onChange(
      value.map((item) =>
        item.brand === brand ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const canAddMore = value.length < maxItems && availableBrands.length > 0;

  return (
    <View className="space-y-3 gap-4">
      {/* Display added items */}
      {value.length > 0 && (
        <View className="space-y-2 ">
          {value.map((item) => (
            <View
              key={item.brand}
              className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5 flex-row items-center justify-between"
            >
              <View className="flex-1 flex-row items-center justify-between">
                <Text className="text-base font-medium text-foreground flex-1">
                  {item.brand}
                </Text>
                <View className="flex-row items-center gap-3">
                  {/* Quantity input */}
                  <TextInput
                    className={`bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center text-base text-foreground min-w-[60px] ${
                      disabled ? "opacity-50" : ""
                    }`}
                    value={String(item.quantity)}
                    onChangeText={(text) => {
                      const num = text === "" ? 0 : parseInt(text, 10) || 0;
                      handleUpdateQuantity(item.brand, num);
                    }}
                    keyboardType="number-pad"
                    editable={!disabled}
                  />
                  {/* Remove button */}
                  <Pressable
                    onPress={() => handleRemoveItem(item.brand)}
                    className="ml-2 p-1"
                    disabled={disabled}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add Brand button */}
      {canAddMore && !disabled && (
        <Pressable
          onPress={() => setDrawerOpen(true)}
          className="flex-row items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-[#e0e0e0] rounded-xl active:bg-gray-50"
        >
          <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          <Text className="text-base font-medium text-[#007AFF]">
            Add Entry
          </Text>
        </Pressable>
      )}

      {/* Validation messages */}
      {value.length < minItems && (
        <Text className="text-sm text-orange-500">
          At least {minItems} item(s) required
        </Text>
      )}
      {value.length >= maxItems && (
        <Text className="text-sm text-gray-500">
          Maximum {maxItems} item(s) reached
        </Text>
      )}

      {/* Add Item Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedBrand("");
          setQuantity("");
        }}
        title={`Add ${config.label}`}
        size="medium"
      >
        <ScrollView className="px-4 py-2" keyboardShouldPersistTaps="handled">
          <View className="space-y-4">
            {/* Brand Select */}
            <View>
              <Text className="text-base font-semibold mb-2 text-foreground">
                Brand
              </Text>
              <Select
                value={selectedBrand}
                onValueChange={setSelectedBrand}
                placeholder="Select a brand"
                size="medium"
              >
                {availableBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </Select>
            </View>

            {/* Quantity Input */}
            <View>
              <Text className="text-base font-semibold mb-2 text-foreground">
                Quantity
              </Text>
              <TextInput
                className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5 text-base text-foreground"
                placeholder="Enter quantity"
                placeholderTextColor="#999"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
              />
              {!allowZeroQuantities && (
                <Text className="text-sm text-gray-500 mt-1">
                  Zero quantities are not allowed
                </Text>
              )}
            </View>

            {/* Add Button */}
            <Pressable
              onPress={handleAddItem}
              disabled={
                !selectedBrand ||
                !quantity ||
                parseInt(quantity, 10) < 0 ||
                (!allowZeroQuantities && parseInt(quantity, 10) === 0)
              }
              className="bg-blue-500 rounded-xl py-4 px-8 items-center justify-center mt-2 active:bg-blue-600 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              <Text className="text-white text-lg font-semibold">Add</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Drawer>
    </View>
  );
}
