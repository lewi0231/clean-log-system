import { Drawer } from "@/components/ui/drawer";
import { Select, SelectItem } from "@/components/ui/select";
import { useTheme } from "@/lib/theme-context";
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
  const { colors } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [quantity, setQuantity] = useState("");

  const options = config.options || [];
  const validationRules = config.validation_rules;
  const maxItems = validationRules?.max_items ?? options.length;
  const minItems = validationRules?.min_items ?? 0;
  const allowZeroQuantities = validationRules?.allow_zero_quantities ?? false;

  // Get available brands (not already selected)
  const availableBrands = options.filter((option) => !value.some((item) => item.brand === option));

  const handleAddItem = () => {
    if (!selectedBrand || !quantity) return;

    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 0) return;
    if (!allowZeroQuantities && quantityNum === 0) return;

    // Check if we've reached max items
    if (value.length >= maxItems) return;

    const newItems = [...value, { brand: selectedBrand, quantity: quantityNum }];
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
      value.map((item) => (item.brand === brand ? { ...item, quantity: newQuantity } : item))
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
              className="bg-card border border-border rounded-xl px-4 py-3.5 flex-row items-center justify-between"
            >
              <View className="flex-1 flex-row items-center justify-between">
                <Text className="text-base font-medium text-foreground flex-1">{item.brand}</Text>
                <View className="flex-row items-center gap-3">
                  <TextInput
                    className={`bg-muted border border-border rounded-lg px-3 py-2 text-center text-base text-foreground min-w-[60px] ${
                      disabled ? "opacity-50" : ""
                    }`}
                    style={{ color: colors.foreground }}
                    value={String(item.quantity)}
                    onChangeText={(text) => {
                      const num = text === "" ? 0 : parseInt(text, 10) || 0;
                      handleUpdateQuantity(item.brand, num);
                    }}
                    keyboardType="number-pad"
                    editable={!disabled}
                    placeholderTextColor={colors.mutedForeground}
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
          className="flex-row items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-border rounded-xl active:bg-muted"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text className="text-base font-medium text-primary">Add Entry</Text>
        </Pressable>
      )}

      {/* Validation messages */}
      {value.length < minItems && (
        <Text className="text-sm text-orange-500">At least {minItems} item(s) required</Text>
      )}
      {value.length >= maxItems && (
        <Text className="text-sm text-muted-foreground">Maximum {maxItems} item(s) reached</Text>
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
          <View className="space-y-4 ">
            {/* Option Select */}
            <View className="">
              <Text className="text-base font-semibold mb-2 text-foreground">Option</Text>
              <Select
                value={selectedBrand}
                onValueChange={setSelectedBrand}
                placeholder="Select an option"
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
              <Text className="text-base font-semibold mb-2 text-foreground">Quantity</Text>
              <TextInput
                className="bg-card border border-border rounded-xl px-4 py-3.5 text-base text-foreground"
                style={{ color: colors.foreground }}
                placeholder="Enter quantity"
                placeholderTextColor={colors.mutedForeground}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
              />
              {!allowZeroQuantities && (
                <Text className="text-sm text-muted-foreground mt-1">
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
              className="bg-primary rounded-xl py-4 px-8 items-center justify-center mt-2 active:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              <Text className="text-primary-foreground text-lg font-semibold">Add</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Drawer>
    </View>
  );
}
