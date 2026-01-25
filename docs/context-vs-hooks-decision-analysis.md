# Context vs State Management Hooks: Decision Analysis

## Overview

This document provides a detailed analysis of when to use **React Context** versus **State Management Hooks** for the high-priority refactoring opportunities identified in the context-vs-props analysis.

---

## Decision Framework

### When to Use Context

✅ **Context is Better When:**
1. **Shared Configuration** - Same value needed by multiple components at different tree levels
2. **Cross-Component Coordination** - Components need to react to shared state changes
3. **Avoiding Prop Drilling** - Props passed through 3+ component levels
4. **Global Feature State** - State represents configuration for an entire feature area
5. **Sibling Communication** - Multiple components need to coordinate without a common parent

### When to Use Hooks

✅ **Hooks are Better When:**
1. **Instance-Specific State** - Each component instance needs independent state
2. **Component-Local Logic** - State is only used within a single component tree
3. **Explicit Dependencies** - You want dependencies to be clear from component props
4. **Performance Critical** - Avoiding unnecessary re-renders from context changes
5. **Simple State Management** - State doesn't need to be shared across components

---

## Case 1: Pricing Configuration (pricingContext, showBothContexts)

### Current Implementation

**Props passed to 10+ components:**
- `BasePricingEditor`
- `FieldPricingList`
- `NumberPricingList`
- `BooleanPricingList`
- `OptionPricingEditor`
- `FieldPricingCard`
- `FieldPriceInput`
- And more...

**Current Pattern:**
```typescript
// Every component receives these props
<BasePricingEditor
  pricingContext="customer"
  showBothContexts={true}
  locationId={locationId}
  locationHierarchyId={locationHierarchyId}
/>

<FieldPricingList
  pricingContext="customer"
  showBothContexts={true}
  locationId={locationId}
  locationHierarchyId={locationHierarchyId}
/>
```

### Analysis: Context vs Hook

#### Option A: Context (Recommended ✅)

**Why Context is Better Here:**

1. **Shared Configuration Across Many Components**
   - `pricingContext` and `showBothContexts` are used by 10+ components
   - They represent **global configuration** for the entire pricing feature
   - Same values needed at different tree levels

2. **Already Have PricingScopeProvider**
   - `PricingScopeProvider` already exists and manages location scope
   - Natural extension to include pricing context
   - Consistent pattern with existing code

3. **Avoids Repetitive Prop Passing**
   - Currently passed to every pricing component
   - Would eliminate 2 props from ~10+ component interfaces
   - Reduces maintenance burden

4. **Cross-Component Coordination**
   - When user changes `pricingContext` in one place, all components should update
   - Context makes this automatic and consistent

**Implementation:**
```typescript
// Enhanced PricingScopeProvider
interface PricingScopeValue {
  // Existing location scope...
  locationId: string | null;
  locationHierarchyId: string | null;
  
  // NEW: Pricing configuration
  pricingContext: "customer" | "worker";
  setPricingContext: (context: "customer" | "worker") => void;
  showBothContexts: boolean;
  setShowBothContexts: (show: boolean) => void;
}

// Usage in components
function FieldPricingList() {
  const { pricingContext, showBothContexts } = usePricingScope();
  // No props needed!
}
```

**Benefits:**
- ✅ Single source of truth
- ✅ Automatic updates across all components
- ✅ Reduces prop drilling
- ✅ Consistent with existing pattern

**Drawbacks:**
- ⚠️ Slightly less explicit (but hook name makes it clear)
- ⚠️ All consumers re-render when context changes (but this is desired behavior)

#### Option B: Custom Hook (Not Recommended ❌)

**Why Hook is NOT Better Here:**

```typescript
// Hypothetical hook approach
function usePricingConfig() {
  const [pricingContext, setPricingContext] = useState<"customer" | "worker">("customer");
  const [showBothContexts, setShowBothContexts] = useState(false);
  return { pricingContext, setPricingContext, showBothContexts, setShowBothContexts };
}
```

**Problems:**
1. **Each Component Gets Independent State**
   - Each component calling `usePricingConfig()` gets its own state
   - No coordination between components
   - Would need to lift state to a common parent anyway

2. **Still Need Prop Passing**
   - If you lift state to parent, you're back to prop drilling
   - Hook doesn't solve the prop passing problem

3. **No Shared State**
   - Hooks don't provide shared state across components
   - Would need Context or prop drilling anyway

**Verdict:** ❌ Hook approach doesn't solve the problem. Context is the right choice.

---

## Case 2: Field Pricing UI State (expanded, saving, deleting)

### Current Implementation

**State managed in `FieldPricingList` component:**
```typescript
const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
const [saving, setSaving] = useState<Record<string, boolean>>({});
const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
```

**Passed as props to `FieldPricingCard`:**
```typescript
<FieldPricingCard
  isExpanded={expandedCards[fieldConfig.id] ?? true}
  isSaving={saving[fieldConfig.id] || false}
  deletingIds={deletingIds}
  onExpandedChange={(expanded) => setExpandedCards(...)}
  // ... 15+ more props
/>
```

### Analysis: Context vs Hook

#### Option A: Context

**Why Context Could Work:**

1. **Shared State Management**
   - State is managed in parent (`FieldPricingList`)
   - Used by child components (`FieldPricingCard`)
   - Could centralize in context

2. **Potential for Cross-Component Features**
   - "Expand All" / "Collapse All" buttons
   - Global loading states
   - Coordinated UI updates

**Implementation:**
```typescript
interface FieldPricingStateContextValue {
  expandedFields: Record<string, boolean>;
  setExpanded: (fieldId: string, expanded: boolean) => void;
  savingFields: Record<string, boolean>;
  setSaving: (fieldId: string, saving: boolean) => void;
  deletingIds: Set<string>;
  setDeleting: (id: string, deleting: boolean) => void;
}
```

**Benefits:**
- ✅ Centralized state management
- ✅ Enables "expand all" features
- ✅ Reduces props passed to cards

**Drawbacks:**
- ⚠️ Each card's state is **independent** - they don't need to coordinate
- ⚠️ Context causes all cards to re-render when any card's state changes
- ⚠️ Over-engineering for what is essentially local UI state

#### Option B: Custom Hook (Recommended ✅)

**Why Hook is Better Here:**

1. **Instance-Specific State**
   - Each `FieldPricingCard` has its own expanded/saving/deleting state
   - Cards don't need to know about other cards' state
   - Independent UI state per instance

2. **Encapsulation**
   - Hook encapsulates the state logic for a single card
   - Returns only what that card needs
   - Clear, explicit dependencies

3. **Performance**
   - Only the specific card re-renders when its state changes
   - No unnecessary re-renders of other cards
   - Better performance characteristics

4. **Simpler Mental Model**
   - Each card manages its own state
   - Easier to reason about
   - Less coupling between components

**Implementation:**
```typescript
// Custom hook for card state
function useFieldPricingCardState(fieldId: string) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  return {
    isExpanded,
    setIsExpanded,
    isSaving,
    setIsSaving,
    isDeleting,
    setIsDeleting,
  };
}

// Usage in FieldPricingCard
function FieldPricingCard({ fieldConfig, ...otherProps }) {
  const { isExpanded, setIsExpanded, isSaving, setIsSaving } = 
    useFieldPricingCardState(fieldConfig.id);
  
  // State is local to this card instance
  // No props needed for UI state!
}
```

**Benefits:**
- ✅ Each card has independent state
- ✅ Better performance (no unnecessary re-renders)
- ✅ Clearer encapsulation
- ✅ Easier to test
- ✅ Reduces props significantly

**Drawbacks:**
- ⚠️ Can't easily implement "expand all" (but can be added later if needed)
- ⚠️ State is per-instance (but this is actually desired)

**Alternative: Hybrid Approach**

If you need "expand all" functionality later, you can combine both:

```typescript
// Context for global actions
interface FieldPricingStateContextValue {
  expandAll: () => void;
  collapseAll: () => void;
  // Broadcast actions to all cards
}

// Hook for per-card state
function useFieldPricingCardState(fieldId: string) {
  const { expandAll, collapseAll } = useFieldPricingState();
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Listen to global actions if needed
  useEffect(() => {
    // Handle expandAll/collapseAll if needed
  }, [expandAll, collapseAll]);
  
  return { isExpanded, setIsExpanded, ... };
}
```

**Verdict:** ✅ Hook approach is better for this case. Context would be over-engineering.

---

## Case 3: Field Label Lookup

### Current Implementation

**Computed in multiple components:**
```typescript
// In FieldPricingList
const fieldLabelLookup = useMemo(() => {
  const lookup: Record<string, string> = {};
  fieldConfigs.forEach((fc) => {
    lookup[fc.id] = fc.label;
  });
  return lookup;
}, [fieldConfigs]);

// Passed as prop
<FieldPricingCard fieldLabelLookup={fieldLabelLookup} />
```

### Analysis: Context vs Hook

#### Option A: Context (Recommended ✅)

**Why Context is Better:**

1. **Shared Data**
   - Same lookup computed in multiple components
   - Derived from same source (`fieldConfigs`)
   - No need to recompute in each component

2. **Performance**
   - Compute once, use everywhere
   - Memoized in context provider
   - Avoids duplicate computations

3. **Consistency**
   - Single source of truth
   - All components use same lookup
   - Easier to maintain

**Implementation:**
```typescript
// In PricingScopeProvider or separate context
const { fieldConfigs } = useFieldConfigs();

const fieldLabelLookup = useMemo(() => {
  const lookup: Record<string, string> = {};
  fieldConfigs.forEach((fc) => {
    lookup[fc.id] = fc.label;
  });
  return lookup;
}, [fieldConfigs]);

// Available via context
const { fieldLabelLookup } = usePricingScope();
```

#### Option B: Custom Hook

**Why Hook Could Work:**

```typescript
function useFieldLabelLookup() {
  const { fieldConfigs } = useFieldConfigs();
  return useMemo(() => {
    const lookup: Record<string, string> = {};
    fieldConfigs.forEach((fc) => {
      lookup[fc.id] = fc.label;
    });
    return lookup;
  }, [fieldConfigs]);
}
```

**Analysis:**
- ✅ Each component computes its own (but this is fine - it's memoized)
- ✅ No prop passing needed
- ⚠️ Slight duplication (but React Query likely caches `fieldConfigs`)

**Verdict:** ✅ Either approach works, but **Context is slightly better** because:
- Single computation point
- Guaranteed consistency
- Part of pricing scope anyway

---

## Summary & Recommendations

### Case 1: Pricing Configuration (pricingContext, showBothContexts)
**Recommendation: ✅ Context**

**Reasoning:**
- Shared configuration across 10+ components
- Natural extension of existing `PricingScopeProvider`
- Avoids repetitive prop passing
- Enables cross-component coordination

### Case 2: Field Pricing UI State (expanded, saving, deleting)
**Recommendation: ✅ Custom Hook**

**Reasoning:**
- Instance-specific state (each card is independent)
- Better performance (no unnecessary re-renders)
- Clearer encapsulation
- Simpler mental model

**Note:** If "expand all" functionality is needed later, can add Context for global actions while keeping hook for per-card state.

### Case 3: Field Label Lookup
**Recommendation: ✅ Context (in PricingScopeProvider)**

**Reasoning:**
- Shared data used by multiple components
- Single computation point
- Part of pricing scope configuration
- Performance benefit (compute once)

---

## Implementation Priority

### Phase 1: Quick Wins (Context)
1. ✅ Enhance `PricingScopeProvider` with `pricingContext` and `showBothContexts`
2. ✅ Add `fieldLabelLookup` to `PricingScopeProvider`
3. ✅ Update all pricing components to use context instead of props

**Impact:** Removes 3-4 props from 10+ components

### Phase 2: Hook Refactoring
4. ✅ Create `useFieldPricingCardState` hook
5. ✅ Move expanded/saving/deleting state into hook
6. ✅ Update `FieldPricingCard` to use hook

**Impact:** Removes 3-4 props from `FieldPricingCard`, better performance

### Phase 3: Cleanup
7. ✅ Remove redundant prop passing
8. ✅ Update TypeScript interfaces
9. ✅ Test all affected flows

---

## Key Takeaways

1. **Context for Shared Configuration** - When the same value/config is needed by many components
2. **Hooks for Instance State** - When each component instance needs independent state
3. **Hybrid Approach** - Can combine both (context for global, hooks for local)
4. **Performance Matters** - Context causes all consumers to re-render; hooks are more granular
5. **Explicit is Better** - But not at the cost of prop drilling through 3+ levels

The decision isn't always clear-cut, but the framework above should guide the choice for each specific case.
