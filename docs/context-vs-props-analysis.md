# Context vs Props Analysis: Mobile Config & Pricing Components

## Executive Summary

This document analyzes prop passing patterns in the dashboard codebase, specifically focusing on mobile application configuration and pricing components. Using a tree of thought approach, we evaluate whether increased use of React Context would improve code maintainability, readability, and developer experience.

**Recommendation**: **Yes, strategically increase context usage** for shared state and configuration that flows through 3+ component levels, while maintaining props for component-specific data and callbacks.

---

## Tree of Thought Analysis

### 1. Current State Assessment

#### 1.1 Existing Context Usage
The codebase already demonstrates good context usage in some areas:

- ✅ **PricingScopeProvider** (`pricing-scope-context.tsx`): Manages location scope, effective dates, and pricing history state
- ✅ **OnboardingChecklistProvider**: Manages onboarding UI state
- ✅ **PageTourProvider**: Manages tour state
- ✅ **QueryProvider**: Manages React Query client

#### 1.2 Deep Prop Passing Examples

**A. Pricing Components - FieldPricingCard (CRITICAL)**
```
PricingPage 
  → PricingPageContent 
    → NumberPricingList/BooleanPricingList
      → FieldPricingCard (20+ props!)
```

**Props passed to FieldPricingCard:**
```typescript
interface FieldPricingCardProps {
  fieldConfig: FieldConfig;
  customerPricingRecord: FieldPricing | null;
  workerPricingRecord: FieldPricing | null;
  pricingEntry: ScopedPricingEntry<FieldPricing> | undefined;
  scopedPricing: FieldPricing | null;
  currentCustomerPrice: string;
  currentWorkerPrice: string;
  hasChanges: boolean;
  isSaving: boolean;
  overrides: LocationOverrideRow[];
  conditions: PricingCondition[];
  isExpanded: boolean;
  hasScopedValue: boolean;
  showBothContexts: boolean;
  pricingContext: "customer" | "worker";
  locationId: string | null;
  locationHierarchyId: string | null;
  fieldLabelLookup: Record<string, string>;
  onExpandedChange: (expanded: boolean) => void;
  onPriceChange: (fieldId: string, value: string, context: "customer" | "worker") => void;
  onSave: (fieldConfig: FieldConfig) => Promise<void>;
  onDeleteOverride: (id: string) => Promise<void>;
  onOpenConditionalModal: (field: FieldConfig) => void;
  deletingIds: Set<string>;
}
```

**Analysis:**
- **20+ props** passed through multiple levels
- Many props are **derived state** (currentCustomerPrice, currentWorkerPrice, hasChanges)
- **Location scope props** (locationId, locationHierarchyId) already partially in PricingScopeProvider
- **Pricing context** (pricingContext, showBothContexts) repeated across components

**B. Mobile Config - VisualFormBuilder Chain**
```
MobileConfigPage
  → VisualFormBuilder (13 props)
    → SectionEditor (13 props)
      → FieldConfigDialog (many props)
```

**Props passed to VisualFormBuilder:**
```typescript
interface VisualFormBuilderProps {
  fields: FieldConfig[];
  sections: FormSectionWithFields[];
  onAddField: (field: ...) => Promise<void>;
  onUpdateField: (fieldId: string, updates: Partial<FieldConfig>) => Promise<void>;
  onDeleteField: (fieldId: string) => Promise<void>;
  onReorderFields: (fieldIds: string[]) => Promise<void>;
  onAddSection: (section: ...) => void | Promise<void>;
  onUpdateSection: (sectionId: string, updates: Partial<FormSectionWithFields>) => void | Promise<void>;
  onDeleteSection: (sectionId: string) => void | Promise<void>;
  onReorderSections: (sectionIds: string[]) => void | Promise<void>;
  createdClusters?: string[];
}
```

**Analysis:**
- **Handler functions** passed through 2-3 levels
- **Data (fields, sections)** passed through multiple levels
- **createdClusters** state managed at page level but used deep in tree

**C. Pricing Components - BasePricingEditor**
```
PricingPage
  → PricingPageContent
    → BasePricingEditor (5 props, but many internal hooks)
      → LocationOverridesMatrix
      → ConditionalRuleBuilder
```

**Props passed to BasePricingEditor:**
```typescript
interface BasePricingEditorProps {
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  pricingContext?: "customer" | "worker";
  showBothContexts?: boolean;
}
```

**Analysis:**
- Props are **location scope related** - already partially in PricingScopeProvider
- **pricingContext** and **showBothContexts** repeated across many components
- Internal hooks fetch data that could be shared

---

### 2. Decision Framework

#### 2.1 When to Use Context

✅ **Use Context For:**
1. **Shared configuration** used by 3+ component levels
2. **Derived/computed state** that multiple components need
3. **Global UI state** (modals, drawers, expanded states)
4. **Repeated prop patterns** (same props passed to many siblings)
5. **Cross-cutting concerns** (pricing context, location scope)

❌ **Keep Props For:**
1. **Component-specific data** (single field config, single pricing record)
2. **Direct parent-child relationships** (1-2 levels)
3. **Event handlers** that are component-specific
4. **Props that vary per instance** (different for each card in a list)

#### 2.2 Cost-Benefit Analysis

**Benefits of Context:**
- ✅ Reduces prop drilling (fewer props to pass)
- ✅ Centralizes state management
- ✅ Easier to add new consumers
- ✅ Better TypeScript inference with proper typing
- ✅ Reduces coupling between components

**Costs of Context:**
- ⚠️ Slightly more complex setup
- ⚠️ Can make component dependencies less explicit
- ⚠️ Overuse can make debugging harder
- ⚠️ Performance considerations (re-renders)

**Verdict:** For the identified cases, **benefits outweigh costs** because:
- Props are passed through 3+ levels
- Same data/configuration used by multiple components
- Reduces maintenance burden

---

### 3. Specific Recommendations

#### 3.1 HIGH PRIORITY: Pricing Context Enhancement

**Current State:**
- `PricingScopeProvider` exists but only handles location scope
- `pricingContext` and `showBothContexts` passed as props everywhere
- Pricing data fetching duplicated in multiple components

**Recommendation: Create `PricingConfigContext`**

```typescript
interface PricingConfigContextValue {
  // Pricing context mode
  pricingContext: "customer" | "worker";
  setPricingContext: (context: "customer" | "worker") => void;
  showBothContexts: boolean;
  setShowBothContexts: (show: boolean) => void;
  
  // Shared pricing data
  fieldLabelLookup: Record<string, string>;
  
  // Shared handlers (if needed)
  // These could be in context if used by multiple components
}
```

**Impact:**
- Removes `pricingContext` and `showBothContexts` from ~10+ component props
- Centralizes pricing mode management
- Makes it easier to add new pricing views

**Files Affected:**
- `dashboard/components/pricing/base-pricing-editor.tsx`
- `dashboard/components/pricing/field-pricing-list.tsx`
- `dashboard/components/pricing/field-pricing-card.tsx`
- `dashboard/components/pricing/option-pricing-editor.tsx`
- `dashboard/components/pricing/number-pricing-list.tsx`
- `dashboard/components/pricing/boolean-pricing-list.tsx`

#### 3.2 HIGH PRIORITY: Field Pricing State Context

**Current State:**
- `FieldPricingCard` receives 20+ props
- Many props are derived state (currentCustomerPrice, hasChanges, etc.)
- Expanded state, saving state managed per card

**Recommendation: Create `FieldPricingStateContext`**

```typescript
interface FieldPricingStateContextValue {
  // Expanded state per field
  expandedFields: Record<string, boolean>;
  setExpanded: (fieldId: string, expanded: boolean) => void;
  
  // Saving state per field
  savingFields: Record<string, boolean>;
  setSaving: (fieldId: string, saving: boolean) => void;
  
  // Deleting state
  deletingIds: Set<string>;
  setDeleting: (id: string, deleting: boolean) => void;
  
  // Field label lookup (shared across all pricing components)
  fieldLabelLookup: Record<string, string>;
}
```

**Impact:**
- Reduces `FieldPricingCard` props from 20+ to ~10-12
- Centralizes UI state management
- Makes it easier to add features like "expand all" / "collapse all"

**Alternative Approach:**
Instead of context, consider using a **state management hook** that encapsulates the card state logic:

```typescript
function useFieldPricingCardState(fieldId: string) {
  // Manages expanded, saving, deleting state for a single card
  // Returns only what that card needs
}
```

This might be better than context if each card's state is truly independent.

#### 3.3 MEDIUM PRIORITY: Mobile Config Context

**Current State:**
- Handler functions passed through 2-3 levels
- `createdClusters` state managed at page level
- Fields and sections data passed through multiple levels

**Recommendation: Create `MobileConfigContext`**

```typescript
interface MobileConfigContextValue {
  // Data
  fields: FieldConfig[];
  sections: FormSectionWithFields[];
  createdClusters: string[];
  setCreatedClusters: (clusters: string[]) => void;
  
  // Handlers
  handleAddField: (field: ...) => Promise<void>;
  handleUpdateField: (fieldId: string, updates: Partial<FieldConfig>) => Promise<void>;
  handleDeleteField: (fieldId: string) => Promise<void>;
  handleReorderFields: (fieldIds: string[]) => Promise<void>;
  handleAddSection: (section: ...) => void | Promise<void>;
  handleUpdateSection: (sectionId: string, updates: Partial<FormSectionWithFields>) => void | Promise<void>;
  handleDeleteSection: (sectionId: string) => void | Promise<void>;
  handleReorderSections: (sectionIds: string[]) => void | Promise<void>;
}
```

**Impact:**
- Removes 10+ props from `VisualFormBuilder`
- Removes 10+ props from `SectionEditor`
- Makes handlers available anywhere in the form builder tree

**Consideration:**
This is a **medium priority** because:
- The handlers are already well-encapsulated in `useMobileConfig` hook
- The component tree is only 2-3 levels deep
- Props make dependencies explicit

**Alternative:** Keep props but consider if some handlers can be moved closer to where they're used.

#### 3.4 LOW PRIORITY: Location Scope Enhancement

**Current State:**
- `PricingScopeProvider` already handles location scope
- But `locationId` and `locationHierarchyId` still passed as props in some places

**Recommendation:**
- Ensure all pricing components use `usePricingScope()` hook
- Remove redundant prop passing where context is available
- This is mostly a cleanup task

---

### 4. Implementation Strategy

#### Phase 1: Quick Wins (1-2 days)
1. **Enhance PricingScopeProvider** to include `pricingContext` and `showBothContexts`
   - Add to existing context
   - Update components to use context instead of props
   - Remove props from component interfaces

2. **Create FieldPricingStateContext** for UI state
   - Move expanded/saving/deleting state to context
   - Update `FieldPricingCard` to use context
   - Reduce props significantly

#### Phase 2: Medium Refactoring (3-5 days)
3. **Create MobileConfigContext** (if proceeding)
   - Wrap form builder components
   - Move handlers to context
   - Update all consumers

4. **Clean up redundant prop passing**
   - Audit all pricing components
   - Remove props that are available via context
   - Update TypeScript interfaces

#### Phase 3: Testing & Validation (2-3 days)
5. **Test all affected flows**
   - Mobile config creation/editing
   - Pricing configuration
   - Location scope changes

6. **Performance testing**
   - Verify no unnecessary re-renders
   - Check context value memoization
   - Profile with React DevTools

---

### 5. Code Examples

#### Example 1: Enhanced PricingScopeProvider

```typescript
// dashboard/components/pricing/pricing-scope-context.tsx

interface PricingScopeValue {
  // Existing
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;
  locationNodeId: string | null;
  setLocationNodeId: (id: string | null) => void;
  locationId: string | null;
  setLocationId: (id: string | null) => void;
  effectiveDate: string | null;
  setEffectiveDate: (date: string | null) => void;
  expirationDate: string | null;
  setExpirationDate: (date: string | null) => void;
  pricingHistoryRefreshToken: number;
  refreshPricingHistory: () => void;
  
  // NEW: Pricing context
  pricingContext: "customer" | "worker";
  setPricingContext: (context: "customer" | "worker") => void;
  showBothContexts: boolean;
  setShowBothContexts: (show: boolean) => void;
  
  // NEW: Shared data
  fieldLabelLookup: Record<string, string>;
}

export function PricingScopeProvider({ children }: { children: ReactNode }) {
  const { fieldConfigs } = useFieldConfigs();
  const [pricingContext, setPricingContext] = useState<"customer" | "worker">("customer");
  const [showBothContexts, setShowBothContexts] = useState(false);
  
  const fieldLabelLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    fieldConfigs.forEach((fc) => {
      lookup[fc.id] = fc.label;
    });
    return lookup;
  }, [fieldConfigs]);
  
  // ... rest of existing implementation
}
```

#### Example 2: FieldPricingCard with Context

```typescript
// Before: 20+ props
export function FieldPricingCard({
  fieldConfig,
  customerPricingRecord,
  workerPricingRecord,
  // ... 18 more props
}: FieldPricingCardProps) { ... }

// After: ~10 props (only component-specific data)
export function FieldPricingCard({
  fieldConfig,
  customerPricingRecord,
  workerPricingRecord,
  pricingEntry,
  scopedPricing,
  currentCustomerPrice,
  currentWorkerPrice,
  hasChanges,
  overrides,
  conditions,
  hasScopedValue,
}: FieldPricingCardProps) {
  const {
    pricingContext,
    showBothContexts,
    fieldLabelLookup,
  } = usePricingScope();
  
  const {
    expandedFields,
    setExpanded,
    savingFields,
    deletingIds,
  } = useFieldPricingState();
  
  const isExpanded = expandedFields[fieldConfig.id] ?? false;
  const isSaving = savingFields[fieldConfig.id] ?? false;
  
  // ... rest of component
}
```

---

### 6. Risks & Mitigations

#### Risk 1: Over-engineering
**Mitigation:** Start with Phase 1 only. Evaluate if further context is needed after initial changes.

#### Risk 2: Performance Issues
**Mitigation:**
- Use `useMemo` for context values
- Split contexts if needed (separate data from UI state)
- Use React.memo for expensive components

#### Risk 3: Breaking Changes
**Mitigation:**
- Implement incrementally
- Keep props as fallback during transition
- Comprehensive testing before removing props

#### Risk 4: Loss of Explicit Dependencies
**Mitigation:**
- Document context dependencies in component docs
- Use TypeScript to enforce context usage
- Consider custom hooks that wrap context (e.g., `usePricingConfig()`)

---

### 7. Success Metrics

**Before:**
- `FieldPricingCard`: 20+ props
- `VisualFormBuilder`: 13 props
- `BasePricingEditor`: 5 props + many internal hooks
- `pricingContext` passed to 10+ components

**After (Target):**
- `FieldPricingCard`: ~10-12 props (component-specific only)
- `VisualFormBuilder`: ~5-7 props (or use context)
- `BasePricingEditor`: 2-3 props (location scope from context)
- `pricingContext`: Available via context, not props

**Code Quality:**
- Reduced prop drilling by ~40-50%
- Clearer separation of concerns
- Easier to add new pricing features
- Better TypeScript inference

---

### 8. Conclusion

**Recommendation: Proceed with strategic context adoption**

The analysis shows clear benefits from increasing context usage, particularly for:
1. **Pricing configuration** (pricingContext, showBothContexts)
2. **Field pricing UI state** (expanded, saving, deleting)
3. **Mobile config handlers** (if tree depth increases)

**Priority Order:**
1. ✅ **HIGH**: Enhance PricingScopeProvider with pricing context
2. ✅ **HIGH**: Create FieldPricingStateContext for UI state
3. ⚠️ **MEDIUM**: Consider MobileConfigContext (evaluate after Phase 1)
4. ✅ **LOW**: Clean up redundant prop passing

**Next Steps:**
1. Review this document with the team
2. Start with Phase 1 (quick wins)
3. Measure impact before proceeding to Phase 2
4. Document context usage patterns for future development

---

## Appendix: Component Prop Counts

### Current Prop Counts (Deepest Chains)

| Component | Props Count | Depth | Context Candidate? |
|-----------|-------------|-------|-------------------|
| `FieldPricingCard` | 20+ | 3 | ✅ YES |
| `VisualFormBuilder` | 13 | 1 | ⚠️ MAYBE |
| `SectionEditor` | 13 | 2 | ⚠️ MAYBE |
| `BasePricingEditor` | 5 | 2 | ✅ YES (partial) |
| `FieldPricingList` | 7 | 2 | ✅ YES (partial) |
| `OptionPricingEditor` | 6 | 2 | ✅ YES (partial) |
| `MutuallyExclusiveGroupManager` | 7 | 2 | ❌ NO |

### Context Usage Opportunities

**High Impact:**
- Pricing context (10+ components affected)
- Field pricing state (20+ props reduced)

**Medium Impact:**
- Mobile config handlers (10+ props reduced, but only 2-3 levels)

**Low Impact:**
- Location scope (already partially in context, just cleanup needed)
