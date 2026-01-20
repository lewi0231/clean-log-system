# Mobile Components

> React Native component patterns for the mobile application.

---

## Component Organization

```
mobile-app/components/
├── ui/                     # Native UI primitives
│   ├── button.tsx
│   ├── select.tsx
│   ├── date-time-picker.tsx
│   ├── input.tsx
│   └── ...
├── field-renderer.tsx      # Form field rendering
└── group-breakdown-field.tsx
```

---

## Native vs Web Components

### Use Native Components

```typescript
// ✅ Good: Native components
import { View, Text, Pressable, ScrollView } from "react-native";

<View className="flex-1">
  <Text className="text-lg">Hello</Text>
  <Pressable onPress={handlePress}>
    <Text>Press Me</Text>
  </Pressable>
</View>

// ❌ Bad: Web components (won't work)
<div className="flex-1">
  <span>Hello</span>
  <button onClick={handleClick}>Click Me</button>
</div>
```

### Common Component Mappings

| Web | React Native |
|-----|--------------|
| `<div>` | `<View>` |
| `<span>`, `<p>` | `<Text>` |
| `<button>` | `<Pressable>` or `<TouchableOpacity>` |
| `<input>` | `<TextInput>` |
| `<img>` | `<Image>` |
| `<ul>`, `<li>` | `<FlatList>` or `<View>` |
| `<a>` | `<Link>` (expo-router) |
| `onClick` | `onPress` |

---

## Component Structure

```typescript
import { View, Text, Pressable } from "react-native";
import { cn } from "@/lib/utils";
import type { Job } from "@clean-log/shared";

interface JobCardProps {
  job: Job;
  onPress?: () => void;
  className?: string;
}

export function JobCard({ job, onPress, className }: JobCardProps) {
  return (
    <Pressable 
      onPress={onPress}
      className={cn(
        "bg-white rounded-lg p-4 shadow-sm",
        className
      )}
    >
      <Text className="text-lg font-medium text-gray-900">
        {job.location?.name}
      </Text>
      <Text className="text-sm text-gray-500">
        {formatDate(job.created_at)}
      </Text>
    </Pressable>
  );
}
```

---

## Lists and Scrolling

### FlatList for Large Lists

```typescript
import { FlatList } from "react-native";

<FlatList
  data={jobs}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <JobCard job={item} onPress={() => handleSelect(item.id)} />
  )}
  ItemSeparatorComponent={() => <View className="h-3" />}
  contentContainerClassName="p-4"
  ListEmptyComponent={<EmptyState message="No jobs" />}
/>
```

### ScrollView for Small Content

```typescript
import { ScrollView } from "react-native";

<ScrollView 
  className="flex-1"
  contentContainerClassName="p-4"
>
  <JobDetails job={job} />
  <SubmissionForm />
</ScrollView>
```

---

## Touch Handling

### Pressable vs TouchableOpacity

```typescript
// Preferred: Pressable (more flexible)
<Pressable 
  onPress={handlePress}
  className="p-4 bg-blue-500 rounded-lg active:bg-blue-600"
>
  <Text className="text-white text-center">Press Me</Text>
</Pressable>

// Also valid: TouchableOpacity (auto-opacity feedback)
<TouchableOpacity 
  onPress={handlePress}
  activeOpacity={0.7}
  className="p-4 bg-blue-500 rounded-lg"
>
  <Text className="text-white text-center">Press Me</Text>
</TouchableOpacity>
```

### Press States with NativeWind

```typescript
// Active state styling
<Pressable className="bg-white active:bg-gray-100 p-4 rounded-lg">
  <Text>Pressable Content</Text>
</Pressable>
```

---

## Form Fields

### Field Renderer Pattern

```typescript
// components/field-renderer.tsx
import { View, Text, TextInput } from "react-native";
import { Select } from "@/components/ui/select";
import type { FieldConfig } from "@clean-log/shared";

interface FieldRendererProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

export function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  switch (field.field_type) {
    case "text":
      return (
        <View>
          <Text className="text-sm font-medium mb-1">{field.label}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3"
            value={value as string}
            onChangeText={onChange}
            placeholder={field.placeholder}
          />
          {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
        </View>
      );

    case "select":
      return (
        <View>
          <Text className="text-sm font-medium mb-1">{field.label}</Text>
          <Select
            value={value as string}
            onValueChange={onChange}
            options={field.options}
          />
          {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
        </View>
      );

    default:
      return null;
  }
}
```

---

## Navigation

### Expo Router Links

```typescript
import { Link } from "expo-router";

<Link href="/jobs/123" asChild>
  <Pressable className="p-4 bg-white rounded-lg">
    <Text>View Job</Text>
  </Pressable>
</Link>

// Programmatic navigation
import { router } from "expo-router";

const handleSubmit = () => {
  router.push("/jobs/123");
  // or
  router.replace("/dashboard");
};
```

---

## Safe Areas

### Handle Device Notches

```typescript
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {children}
    </SafeAreaView>
  );
}
```

---

## Platform-Specific Code

### When Needed

```typescript
import { Platform } from "react-native";

<View className={Platform.OS === "ios" ? "pt-12" : "pt-6"}>
  {/* Content */}
</View>

// Or use Platform.select
const paddingTop = Platform.select({
  ios: 48,
  android: 24,
  default: 24,
});
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| Native components | Use `View`, `Text`, `Pressable` |
| `onPress` | Not `onClick` |
| FlatList | For large lists |
| SafeAreaView | For device notches |
| `className` | NativeWind styling |
| Named exports | No default exports |
