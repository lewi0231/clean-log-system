# Mobile Styling

> NativeWind and Tailwind CSS v3 patterns for the mobile app.

---

## Tech Stack

- **NativeWind v3** - Tailwind CSS for React Native
- **Tailwind CSS v3** - Config-based (not CSS-first like dashboard)
- **`cn()` utility** - Class merging

**Note:** Dashboard uses Tailwind v4 (CSS-first), while mobile uses Tailwind v3 (config-based) due to NativeWind compatibility. Patterns are similar but configuration differs.

---

## Basic Usage

### className with NativeWind

```typescript
import { View, Text } from "react-native";

<View className="flex-1 bg-gray-100 p-4">
  <Text className="text-xl font-bold text-gray-900">Title</Text>
  <Text className="text-sm text-gray-500">Subtitle</Text>
</View>
```

### Conditional Styling

```typescript
import { cn } from "@/lib/utils";

<View className={cn(
  "p-4 rounded-lg",
  isActive && "bg-blue-100 border-blue-500",
  isDisabled && "opacity-50"
)}>
  <Text className={cn(
    "text-base",
    isActive ? "text-blue-900" : "text-gray-900"
  )}>
    Content
  </Text>
</View>
```

---

## Color Tokens

### Available Colors

```typescript
// Background colors
<View className="bg-white">
<View className="bg-gray-100">
<View className="bg-blue-500">
<View className="bg-red-500">

// Text colors
<Text className="text-gray-900">
<Text className="text-gray-500">
<Text className="text-blue-600">
<Text className="text-red-500">

// Border colors
<View className="border border-gray-300">
<View className="border-2 border-blue-500">
```

### Opacity Modifiers

```typescript
// Background with opacity
<View className="bg-blue-500/50">  // 50% opacity
<View className="bg-black/10">      // 10% opacity

// For overlays
<View className="absolute inset-0 bg-black/50">
```

---

## Layout

### Flexbox (Default)

```typescript
// Column (default in RN)
<View className="flex-1">
  <View className="h-20 bg-blue-500" />
  <View className="flex-1 bg-gray-100" />
</View>

// Row
<View className="flex-row items-center justify-between">
  <Text>Left</Text>
  <Text>Right</Text>
</View>

// Centered content
<View className="flex-1 items-center justify-center">
  <Text>Centered</Text>
</View>
```

### Spacing

```typescript
// Padding
<View className="p-4">        // All sides
<View className="px-4 py-2">  // Horizontal, vertical
<View className="pt-4">       // Top only

// Margin
<View className="m-4">
<View className="mx-auto">    // Center horizontally
<View className="mt-4">

// Gap (in flex containers)
<View className="flex-row gap-2">
  <Button />
  <Button />
</View>
```

---

## Typography

### Text Sizes

```typescript
<Text className="text-xs">Extra Small</Text>   // 12px
<Text className="text-sm">Small</Text>         // 14px
<Text className="text-base">Base</Text>        // 16px
<Text className="text-lg">Large</Text>         // 18px
<Text className="text-xl">Extra Large</Text>   // 20px
<Text className="text-2xl">2XL</Text>          // 24px
```

### Font Weights

```typescript
<Text className="font-normal">Normal</Text>
<Text className="font-medium">Medium</Text>
<Text className="font-semibold">Semibold</Text>
<Text className="font-bold">Bold</Text>
```

### Text Alignment

```typescript
<Text className="text-left">Left</Text>
<Text className="text-center">Center</Text>
<Text className="text-right">Right</Text>
```

---

## Borders and Shadows

### Borders

```typescript
// Border width
<View className="border">          // 1px
<View className="border-2">        // 2px

// Border radius
<View className="rounded">         // Small
<View className="rounded-lg">      // Medium
<View className="rounded-full">    // Fully rounded

// Border color
<View className="border border-gray-300">
```

### Shadows

```typescript
// Shadow (iOS and Android)
<View className="shadow-sm">
<View className="shadow">
<View className="shadow-lg">

// Note: Shadows work differently on Android
// May need elevation for Android
<View className="shadow-lg elevation-5">
```

---

## Interactive States

### Pressable States

```typescript
<Pressable 
  className="bg-blue-500 active:bg-blue-600 p-4 rounded-lg"
>
  <Text className="text-white text-center">Press Me</Text>
</Pressable>

// Disabled state
<Pressable 
  disabled={isDisabled}
  className={cn(
    "bg-blue-500 p-4 rounded-lg",
    isDisabled && "opacity-50"
  )}
>
  <Text className="text-white">Button</Text>
</Pressable>
```

---

## Common Patterns

### Card

```typescript
<View className="bg-white rounded-lg p-4 shadow-sm">
  <Text className="text-lg font-medium">Card Title</Text>
  <Text className="text-gray-500 mt-1">Card description</Text>
</View>
```

### List Item

```typescript
<Pressable className="flex-row items-center p-4 bg-white border-b border-gray-200">
  <View className="flex-1">
    <Text className="text-base font-medium">Item Title</Text>
    <Text className="text-sm text-gray-500">Subtitle</Text>
  </View>
  <ChevronRight className="text-gray-400" />
</Pressable>
```

### Form Field

```typescript
<View className="mb-4">
  <Text className="text-sm font-medium text-gray-700 mb-1">
    Label
  </Text>
  <TextInput
    className="border border-gray-300 rounded-lg p-3 bg-white"
    placeholder="Enter value"
  />
</View>
```

### Button

```typescript
// Primary button
<Pressable className="bg-blue-500 active:bg-blue-600 p-4 rounded-lg">
  <Text className="text-white text-center font-medium">Primary</Text>
</Pressable>

// Secondary button
<Pressable className="bg-gray-200 active:bg-gray-300 p-4 rounded-lg">
  <Text className="text-gray-900 text-center font-medium">Secondary</Text>
</Pressable>

// Outline button
<Pressable className="border border-blue-500 p-4 rounded-lg active:bg-blue-50">
  <Text className="text-blue-500 text-center font-medium">Outline</Text>
</Pressable>
```

---

## Configuration

### tailwind.config.js

```javascript
// mobile-app/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Custom colors if needed
      },
    },
  },
  plugins: [],
};
```

---

## Platform Differences

### Dashboard vs Mobile

| Feature | Dashboard (Tailwind v4) | Mobile (NativeWind) |
|---------|-------------------------|---------------------|
| Config | CSS-first (no config) | `tailwind.config.js` |
| Colors | oklch color space | rgb color space |
| Dark mode | CSS variables | Config-based |
| Shadows | CSS shadows | Platform shadows |

### Mobile-Specific Considerations

```typescript
// Safe area padding (use SafeAreaView instead)
<SafeAreaView className="flex-1">

// Platform-specific elevation (Android)
<View className="shadow-lg elevation-5">

// Note: Some web classes don't work in RN
// ❌ cursor-pointer (no cursor in mobile)
// ❌ hover: states (no hover in mobile)
// ✅ active: states work
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| `className` | Use for all styling |
| `cn()` | For conditional classes |
| `flex-1` | For filling space |
| Direct colors | Use `bg-blue-500`, not semantic tokens |
| `active:` | For press states (not `hover:`) |
| SafeAreaView | For screen containers |
| Config-based | Tailwind v3, not v4 |
