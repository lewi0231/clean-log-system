# Mobile Hooks

> Custom hook patterns for the mobile application.

---

## Mobile-Specific Hooks

The mobile app has fewer hooks than the dashboard, focusing on:
- Job submission and form handling
- Organization context
- Offline-first patterns

---

## Entry Form Hook

### useEntryForm

```typescript
// hooks/use-entry-form.ts
import { useState, useCallback } from "react";
import type { FieldConfig } from "@clean-log/shared";

interface UseEntryFormResult {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  setValue: (fieldName: string, value: unknown) => void;
  setError: (fieldName: string, error: string) => void;
  clearError: (fieldName: string) => void;
  validate: (fields: FieldConfig[]) => boolean;
  reset: () => void;
}

export function useEntryForm(
  initialValues: Record<string, unknown> = {}
): UseEntryFormResult {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = useCallback((fieldName: string, value: unknown) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    // Clear error when value changes
    setErrors(prev => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const setError = useCallback((fieldName: string, error: string) => {
    setErrors(prev => ({ ...prev, [fieldName]: error }));
  }, []);

  const clearError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const validate = useCallback((fields: FieldConfig[]): boolean => {
    const newErrors: Record<string, string> = {};
    
    for (const field of fields) {
      const value = values[field.name];
      
      if (field.required && !value) {
        newErrors[field.name] = `${field.label} is required`;
      }
      
      // Add more validation rules as needed
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  return {
    values,
    errors,
    setValue,
    setError,
    clearError,
    validate,
    reset,
  };
}
```

### Usage

```typescript
function JobSubmissionForm({ fields }: { fields: FieldConfig[] }) {
  const { values, errors, setValue, validate } = useEntryForm();

  const handleSubmit = () => {
    if (validate(fields)) {
      submitJob(values);
    }
  };

  return (
    <View className="space-y-4">
      {fields.map(field => (
        <FieldRenderer
          key={field.id}
          field={field}
          value={values[field.name]}
          onChange={(value) => setValue(field.name, value)}
          error={errors[field.name]}
        />
      ))}
      <Button onPress={handleSubmit}>Submit</Button>
    </View>
  );
}
```

---

## Job Submission Hook

### useJobSubmission

```typescript
// hooks/use-job-submission.ts
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface UseJobSubmissionResult {
  submitting: boolean;
  error: string | null;
  submitJob: (data: SubmissionData) => Promise<void>;
}

export function useJobSubmission(jobId: string): UseJobSubmissionResult {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitJob = useCallback(async (data: SubmissionData) => {
    try {
      setSubmitting(true);
      setError(null);

      const { error: submitError } = await supabase.functions.invoke(
        "submit-job",
        { body: { job_id: jobId, submission_data: data } }
      );

      if (submitError) {
        throw new Error(submitError.message);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [jobId]);

  return {
    submitting,
    error,
    submitJob,
  };
}
```

---

## Organization Hook

### useOrganization

```typescript
// hooks/use-organization.ts
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Organization } from "@clean-log/shared";

interface UseOrganizationResult {
  organization: Organization | null;
  loading: boolean;
  error: string | null;
}

export function useOrganization(orgCode: string): UseOrganizationResult {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrganization() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("organization")
          .select("*")
          .eq("org_code", orgCode)
          .single();

        if (fetchError) throw fetchError;
        setOrganization(data);

      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
        setOrganization(null);
      } finally {
        setLoading(false);
      }
    }

    if (orgCode) {
      fetchOrganization();
    }
  }, [orgCode]);

  return { organization, loading, error };
}
```

---

## Async Storage Hook

### useAsyncStorage

```typescript
// hooks/use-async-storage.ts
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function useAsyncStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadValue() {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored !== null) {
          setValue(JSON.parse(stored));
        }
      } catch (err) {
        console.error("Failed to load from storage:", err);
      } finally {
        setLoading(false);
      }
    }

    loadValue();
  }, [key]);

  const setStoredValue = useCallback(async (newValue: T) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(newValue));
      setValue(newValue);
    } catch (err) {
      console.error("Failed to save to storage:", err);
      throw err;
    }
  }, [key]);

  return [value, setStoredValue, loading];
}
```

### Usage

```typescript
function SettingsScreen() {
  const [theme, setTheme, loading] = useAsyncStorage("theme", "light");

  if (loading) return <LoadingScreen />;

  return (
    <View>
      <Text>Current theme: {theme}</Text>
      <Button onPress={() => setTheme(theme === "light" ? "dark" : "light")}>
        Toggle Theme
      </Button>
    </View>
  );
}
```

---

## Hook Return Pattern

All hooks should return a consistent shape:

```typescript
interface UseDataResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch?: () => Promise<void>;
}
```

---

## Testing Mobile Hooks

```typescript
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useEntryForm } from "@/hooks/use-entry-form";

describe("useEntryForm", () => {
  it("should set values", () => {
    const { result } = renderHook(() => useEntryForm());

    act(() => {
      result.current.setValue("name", "John");
    });

    expect(result.current.values.name).toBe("John");
  });

  it("should clear error when value changes", () => {
    const { result } = renderHook(() => useEntryForm());

    act(() => {
      result.current.setError("name", "Required");
    });

    expect(result.current.errors.name).toBe("Required");

    act(() => {
      result.current.setValue("name", "John");
    });

    expect(result.current.errors.name).toBeUndefined();
  });
});
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| Named exports | No default exports |
| Return interface | Define explicit result interface |
| Consistent shape | `{ data, loading, error, refetch }` |
| Error handling | Always handle and expose errors |
| kebab-case | `use-entry-form.ts` |
