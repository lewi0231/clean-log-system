# Mobile App Style Guide

> React Native / Expo specific patterns for the mobile application.

**Tech Stack:**
- React Native with Expo
- TypeScript
- NativeWind (Tailwind CSS for React Native)
- Tailwind CSS v3 (config-based)
- Expo Router for navigation

---

## Documents

| Document | Description |
|----------|-------------|
| [Components](./components.md) | React Native component patterns |
| [Hooks](./hooks.md) | Mobile-specific hooks |
| [Styling](./styling.md) | NativeWind, Tailwind v3 patterns |

---

## Quick Reference

### Component Structure

```typescript
import { View, Text, Pressable } from "react-native";
import { useJobSubmission } from "@/hooks/use-job-submission";
import type { Job } from "@clean-log/shared";

interface JobCardProps {
  job: Job;
  onPress?: () => void;
}

export function JobCard({ job, onPress }: JobCardProps) {
  return (
    <Pressable 
      onPress={onPress}
      className="bg-white rounded-lg p-4 shadow-sm"
    >
      <Text className="text-lg font-medium">{job.location?.name}</Text>
      <Text className="text-gray-500">{job.created_at}</Text>
    </Pressable>
  );
}
```

### Styling with NativeWind

```typescript
// Use className with Tailwind classes
<View className="flex-1 bg-gray-100 p-4">
  <Text className="text-xl font-bold text-gray-900">Title</Text>
  <Text className="text-sm text-gray-500">Subtitle</Text>
</View>

// Conditional styling
<View className={cn("p-4 rounded-lg", isActive && "bg-blue-100")}>
```

---

## Key Differences from Dashboard

| Aspect | Dashboard | Mobile |
|--------|-----------|--------|
| Framework | Next.js | Expo |
| Styling | Tailwind v4 (CSS-first) | Tailwind v3 (config-based) |
| Navigation | App Router | Expo Router |
| Components | DOM elements | Native components |
| Touch | `onClick` | `onPress` |

---

## Directory Structure

```
mobile-app/
├── app/                  # Expo Router pages
├── components/
│   ├── ui/              # Native UI primitives
│   └── field-renderer.tsx
├── hooks/               # Mobile-specific hooks
├── lib/                 # Utilities
├── constants/           # App constants
└── types/               # Mobile-specific types
```
