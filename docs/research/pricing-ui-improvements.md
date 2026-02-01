# Pricing UI Improvements - Recommendations

Based on UX analysis and industry research, here are prioritized recommendations to improve the pricing configuration experience.

## Research Summary

### Sources Consulted

- **Empty State UI Design** (Setproduct) - Best practices for designing empty states that guide, delight, and convert
- **SaaS Pricing Page Best Practices** (Design Studio UI/UX) - 12 industry-standard patterns for pricing UX
- **Wizard UI Pattern** (Eleken) - When and how to use progressive disclosure for complex flows
- **Nielsen Norman Group** - Cognitive load reduction and progressive disclosure principles

### Key Research Findings

1. **Empty states are not errors—they are opportunities** (Setproduct). They can teach, direct, and emotionally resonate with users. A well-designed empty state says "we're here to help" rather than "you broke it."

2. **Progressive disclosure reduces cognitive load by up to 40%** compared to showing all complexity upfront (Mental Model research). Break complex tasks into sequential, manageable steps.

3. **Pricing pages shape perceived value within seconds** (Design Studio). Most visitors decide in under 10 seconds if they will explore further.

4. **Wizard UIs improve completion rates** for complex multi-step tasks (Eleken). They reduce overwhelm, improve accuracy, and enhance task flow.

5. **Clear visual hierarchy guides the eye** - Use color, soft shadows, or badges to highlight recommended options. Maintain consistent rhythm: name, benefit line, price, key features, one primary CTA.

6. **Social proof near pricing reduces doubt** and shortens time to click. Trust signals should appear exactly where decisions happen.

---

## Executive Summary

**Current State**: The pricing UI shows all complexity upfront, leading to cognitive overload and decision paralysis.

**Goal**: Progressive disclosure with guided onboarding, contextual help, and clear visual hierarchy.

**Key Principles** (Research-Backed):

1. **Progressive Disclosure**: Show what users need now, hide what they don't (reduces cognitive load by 40%)
2. **Guided Empty States**: Turn blank screens into teachable moments with clear next steps
3. **Feature Discoverability**: Make important features (like Invoice Adjustments) more prominent
4. **Natural Language**: Replace technical equations with examples users understand
5. **Visual Hierarchy**: Use color-coding and badges to indicate state (priced vs. unpriced, empty vs. configured)

---

## Priority 1: Critical UX Issues (High Impact, Medium Effort)

### 1.1 Empty State Consolidation & Onboarding

**Problem**: 5+ empty states shown simultaneously overwhelms users.

**Research Insight** (Setproduct):

> "Empty states are those UI moments when there is no content yet to display... They are incredibly high-leverage. These are moments of friction, hesitation, or abandonment. Or, with the right design, they become moments of engagement, guidance, or delight."

**Current Behavior**:

- Each tab shows its own empty state
- Users see "No fields configured" multiple times
- No guidance on where to start

**Research-Backed Principles**:

1. **Contextual**: Tailor the message to the user's current action and intent
2. **Conversational**: Speak like a human, not a backend log file
3. **Actionable**: Guide the user to the next step—don't leave them in limbo
4. **Single CTA**: One path is better than three vague options

**Recommendation**: **Smart Empty State with Guided Onboarding**

#### Implementation Approach A: Single "Get Started" Empty State (Recommended)

**When to show**: If user has NO pricing configured AND no fields exist

```tsx
// Show this instead of tabs when completely empty
<Card className="border-primary/20 bg-primary/5">
  <CardHeader>
    <CardTitle>Get Started with Pricing</CardTitle>
    <CardDescription>
      Configure how your services are priced. Let's set this up step by step.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    {/* Step 1: Check if fields exist */}
    {fieldConfigs.length === 0 ? (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">1</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Create Your First Field</h3>
            <p className="text-sm text-muted-foreground">
              Add fields to your mobile app forms (e.g., "Number of Windows",
              "Service Type")
            </p>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href="/dashboard/mobile-config">
                Go to Mobile App Configuration
              </Link>
            </Button>
          </div>
        </div>
      </div>
    ) : (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">1</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Set Up Field Pricing</h3>
            <p className="text-sm text-muted-foreground">
              Configure prices for your {fieldConfigs.length} field
              {fieldConfigs.length > 1 ? "s" : ""}
            </p>
            <div className="mt-2 flex gap-2">
              {numberFields.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("number-pricing")}
                >
                  Price {numberFields.length} Number Field
                  {numberFields.length > 1 ? "s" : ""}
                </Button>
              )}
              {booleanFields.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("boolean-pricing")}
                >
                  Price {booleanFields.length} Boolean Field
                  {booleanFields.length > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-1">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-semibold text-muted-foreground">
                2
              </span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-muted-foreground">
              Add Invoice Adjustments (Optional)
            </h3>
            <p className="text-sm text-muted-foreground">
              Set call-out fees, markups, or service-based adjustments
            </p>
          </div>
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

#### Implementation Approach B: Tab Badges with Counts (Simpler Alternative)

**Show field counts in tabs**:

```tsx
<TabsTrigger value="number-pricing">
  <Hash className="h-4 w-4 mr-2" />
  Number
  {numberFields.length > 0 && (
    <Badge variant="secondary" className="ml-2">
      {numberFields.length}
    </Badge>
  )}
</TabsTrigger>
```

**Disable/gray out tabs with 0 fields**:

```tsx
<TabsTrigger
  value="select-pricing"
  disabled={selectFields.length === 0}
  className={selectFields.length === 0 ? "opacity-50" : ""}
>
  <List className="h-4 w-4 mr-2" />
  Select
  {selectFields.length === 0 && (
    <span className="ml-2 text-xs text-muted-foreground">(0 fields)</span>
  )}
</TabsTrigger>
```

**Recommendation**: Start with Approach B (simpler), then add Approach A for first-time users.

**Research-Backed Empty State Copy Patterns** (Setproduct):

| Pattern           | Example                                       | When to Use            |
| ----------------- | --------------------------------------------- | ---------------------- |
| **Reassurance**   | "You're all set up. Ready when you are."      | After completing setup |
| **Encouragement** | "It all starts with your first price."        | First-time users       |
| **Curiosity**     | "No fields priced... yet. Let's change that." | Motivating action      |
| **Guidance**      | "Create fields first, then set prices here."  | Missing prerequisites  |

**Avoid These Anti-Patterns**:

- ❌ "No data available" (too robotic)
- ❌ "You didn't add anything yet" (blaming the user)
- ❌ "Looks like it's empty in here…" (vague, no guidance)
- ✅ "This space will hold your pricing rules." (helpful, forward-looking)

---

### 1.2 Invoice Adjustments Prominence

**Problem**: Critical feature (call-out fees, markups) is buried as last tab.

**Research Insight** (Design Studio UI/UX):

> "Pricing pages can make or break a SaaS funnel... Prospects land, skim for a few seconds, and decide whether to start a trial, book a demo, or bounce."

**Industry Validation** (Housecall Pro HVAC Pricing Guide):

- Service call fees ($70–$200) are **universal** in field service businesses
- This is often the first pricing element customers encounter
- Burying it reduces discoverability and trust

**Current Behavior**: Base pricing is the 5th tab, users might miss it.

**Recommendation**: **Elevate Invoice Adjustments**

#### Option A: Move to Top-Level Tab (Best UX)

Make "Invoice Adjustments" a sibling tab to "Pricing" and "Pricing History":

```tsx
<TabsList>
  <TabsTrigger value="set-pricing">Pricing</TabsTrigger>
  <TabsTrigger value="adjustments">Invoice Adjustments</TabsTrigger> {/* NEW */}
  <TabsTrigger value="pricing-history">Pricing History</TabsTrigger>
</TabsList>
```

**Benefits**:

- Equal prominence with main pricing
- Users discover it earlier
- Clearer mental model (pricing vs. adjustments)

#### Option B: Prominent Card Above Tabs (Simpler)

Add a collapsible card above the field-type tabs:

```tsx
<div className="space-y-6">
  {/* Invoice Adjustments - Prominent */}
  <Card className="border-primary/20 bg-primary/5">
    <Collapsible>
      <CollapsibleTrigger asChild>
        <CardHeader className="cursor-pointer hover:bg-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Invoice Adjustments</CardTitle>
              <CardDescription>
                Set call-out fees, markups, or service-based adjustments
              </CardDescription>
            </div>
            <ChevronDown />
          </div>
        </CardHeader>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent>
          <BasePricingEditor {...props} />
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  </Card>

  {/* Field Type Pricing Tabs */}
  <Tabs>{/* ... existing tabs ... */}</Tabs>
</div>
```

**Recommendation**: Start with Option B (less disruptive), consider Option A if users still miss it.

---

### 1.3 Select Field Pricing - Show Options Preview

**Problem**: Users don't know what options exist before setting prices.

**Current Behavior**:

- Equation shown twice
- "Bulk Price Update: 0/5 priced" but options not visible
- Users must expand accordion to see options

**Recommendation**: **Always Show Options List**

```tsx
// In OptionPricingEditor component
<div className="space-y-4">
  {/* Field Header */}
  <div>
    <h3 className="text-lg font-semibold">{fieldConfig.label}</h3>
    <p className="text-sm text-muted-foreground">
      {options.length} option{options.length !== 1 ? "s" : ""} available
    </p>
  </div>

  {/* Options Preview - Always Visible */}
  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
    {options.map((option) => {
      const pricing = pricingMap[option];
      const hasPrice = pricing?.record;
      return (
        <Card
          key={option}
          className={
            hasPrice ? "border-primary/20 bg-primary/5" : "border-dashed"
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{option}</p>
                {hasPrice ? (
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(pricing.record.customer_price)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No price set</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingOption(option)}
              >
                {hasPrice ? "Edit" : "Set Price"}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    })}
  </div>

  {/* Bulk Actions - More Prominent */}
  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
    <div className="flex-1">
      <p className="text-sm font-medium">
        {pricedCount}/{options.length} options priced
      </p>
      <p className="text-xs text-muted-foreground">
        Set the same price for all unpriced options
      </p>
    </div>
    <Button variant="outline" size="sm" onClick={handleBulkSetUnpriced}>
      <Zap className="h-4 w-4 mr-2" />
      Set All Unpriced
    </Button>
  </div>
</div>
```

**Benefits**:

- Users see all options at a glance
- Clear visual indication of what's priced vs. unpriced
- Bulk actions are more discoverable

---

## Priority 2: Visual & Language Improvements (Medium Impact, Low Effort)

### 2.1 Replace Technical Equations with Natural Language

**Problem**: Monospace equations (`Total = invoice_total + amount`) are jarring and break the design language.

**Research Insight** (Design Studio UI/UX):

> "Label features in everyday language rather than product jargon... Keep answers short, specific, and jargon-free."

**Research Insight** (Eleken Wizard UI):

> "Contextual Help and Tips: Provide tips and examples in each section to help users make effective decisions."

**Current**:

```tsx
<div className="bg-muted/50 rounded-md p-2 text-sm">
  <span className="text-muted-foreground">Equation: </span>
  <span className="font-mono font-medium">Total = invoice_total + amount</span>
</div>
```

**Recommendation**: **Natural Language Examples**

```tsx
<div className="bg-muted/50 rounded-md p-3 text-sm">
  <div className="flex items-center gap-2">
    <Info className="h-4 w-4 text-muted-foreground" />
    <div>
      <p className="font-medium">How it works:</p>
      <p className="text-muted-foreground">
        Final invoice = Field totals +{" "}
        <span className="font-medium">$0.00</span> adjustment
      </p>
      <p className="text-xs text-muted-foreground mt-1 italic">
        Example: $150 field total + $25 call-out fee = $175 final invoice
      </p>
    </div>
  </div>
</div>
```

**For Multiplier**:

```tsx
<p className="text-muted-foreground">
  Final invoice = Field totals × <span className="font-medium">1.00</span> multiplier
</p>
<p className="text-xs text-muted-foreground mt-1 italic">
  Example: $100 field total × 1.15 = $115 final invoice (15% markup)
</p>
```

---

### 2.2 Improve Radio Button Labels with Examples

**Problem**: "Add Amount" vs "Multiply Invoice" is abstract.

**Current**:

```tsx
<label>
  <input type="radio" name="adjustment-type" value="add" />
  <span>Add Amount</span>
</label>
<label>
  <input type="radio" name="adjustment-type" value="multiply" />
  <span>Multiply Invoice</span>
</label>
```

**Recommendation**: **Add Contextual Examples**

```tsx
<div className="space-y-3">
  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
    <input type="radio" name="adjustment-type" value="add" className="mt-1" />
    <div className="flex-1">
      <div className="font-medium">Add Amount</div>
      <div className="text-sm text-muted-foreground">
        Add a fixed fee (e.g., $50 call-out fee, $25 travel charge)
      </div>
    </div>
  </label>
  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
    <input
      type="radio"
      name="adjustment-type"
      value="multiply"
      className="mt-1"
    />
    <div className="flex-1">
      <div className="font-medium">Multiply Invoice</div>
      <div className="text-sm text-muted-foreground">
        Apply a percentage multiplier (e.g., 1.15 = 15% markup, 1.2 = 20%
        markup)
      </div>
    </div>
  </label>
</div>
```

---

### 2.3 Make Field Type Icons More Distinct

**Problem**: Icons are subtle and hard to distinguish.

**Recommendation**: **Larger, Color-Coded Icons**

```tsx
// In tab triggers
<TabsTrigger value="number-pricing" className="cursor-pointer">
  <div className="flex items-center gap-2">
    <div className="h-5 w-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
      <Hash className="h-3 w-3 text-blue-600 dark:text-blue-400" />
    </div>
    <span>Number</span>
  </div>
</TabsTrigger>

<TabsTrigger value="boolean-pricing" className="cursor-pointer">
  <div className="flex items-center gap-2">
    <div className="h-5 w-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
      <CheckSquare className="h-3 w-3 text-green-600 dark:text-green-400" />
    </div>
    <span>Boolean</span>
  </div>
</TabsTrigger>
```

**Alternative**: Use colored badges instead of background circles.

---

## Priority 3: Navigation & Context (Medium Impact, Medium Effort)

### 3.1 Add Breadcrumb/Sub-Header Context

**Problem**: Users lose track of where they are in pricing configuration.

**Research Insight** (Eleken Wizard UI):

> "Progress Tracking and Step Highlights: A progress bar at the top of the interface shows users how far they've come and what remains, building momentum as they complete each section."

**Research Insight** (Design Studio UI/UX):

> "Hierarchy should also govern spacing and typography... Align currency symbols and decimals so prices are scannable."

**Recommendation**: **Contextual Sub-Header**

```tsx
<div className="mb-6">
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Link href="/dashboard/pricing" className="hover:text-foreground">
      Pricing
    </Link>
    <ChevronRight className="h-4 w-4" />
    <span className="text-foreground font-medium">Number Field Pricing</span>
  </div>
</div>
```

**Or simpler**: Add subtitle to page header:

```tsx
<h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
<p className="text-muted-foreground mt-2">
  Configure customer pricing and worker payments
  {activeSubTab && (
    <span className="text-foreground"> • {activeSubTab}</span>
  )}
</p>
```

---

### 3.2 Make Test Invoice Button Sticky

**Problem**: Test Invoice button is only visible at top, users scroll past it.

**Recommendation**: **Sticky Floating Button**

```tsx
// Add to pricing page
<div className="fixed bottom-6 right-6 z-50">
  <Button
    variant="default"
    size="lg"
    onClick={() => setTestInvoiceOpen(true)}
    className="shadow-lg gap-2"
  >
    <TestTube className="h-4 w-4" />
    Test Invoice
  </Button>
</div>
```

**Or**: Add to a persistent header bar that stays visible.

---

### 3.3 Improve Individual Group Prices Accordion

**Problem**: Collapsed accordion is mysterious.

**Recommendation**: **Show Preview in Header**

```tsx
<Collapsible>
  <CollapsibleTrigger className="w-full">
    <div className="flex items-center justify-between p-4">
      <div className="text-left">
        <div className="font-medium">Individual Group Prices</div>
        <div className="text-sm text-muted-foreground">
          {pricedCount}/{options.length} groups priced
          {pricedCount > 0 && (
            <span className="ml-2 text-primary">
              • {formatCurrency(averagePrice)} avg
            </span>
          )}
        </div>
      </div>
      <ChevronDown />
    </div>
  </CollapsibleTrigger>
  <CollapsibleContent>{/* Options list */}</CollapsibleContent>
</Collapsible>
```

---

## Priority 4: Progressive Disclosure & Onboarding (Medium-High Impact, High Effort)

### 4.1 Onboarding Checklist

**Research Insight** (Eleken Wizard UI):

> "Wizard UIs excel in scenarios where users need extra guidance and a structured flow to achieve a task... They reduce user overwhelm, improve accuracy, and enhance task flow."

**Research Insight** (Userpilot):

> "Segmented onboarding drives measurably higher activation rates by enabling users to encounter relevant features first."

**Key Wizard UI Best Practices** (Eleken):

1. **Step-by-step progression**: Each stage shown individually with clear navigation
2. **Progress indicators**: Numbered steps or progress bar to show where users are
3. **User-friendly navigation**: "Next," "Back," "Finish" buttons for user control
4. **Error handling**: Clear feedback on errors at each step

**Recommendation**: **Progress Indicator for First-Time Setup**

```tsx
// Show when user has < 50% of pricing configured
<Card className="border-primary/20 bg-primary/5 mb-6">
  <CardHeader>
    <CardTitle>Pricing Setup Progress</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {hasNumberPricing ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
        <span className={hasNumberPricing ? "" : "text-muted-foreground"}>
          Set up number field pricing
        </span>
      </div>
      {/* ... more checklist items ... */}
    </div>
  </CardContent>
</Card>
```

---

### 4.2 Templates/Presets

**Recommendation**: **Quick Start Templates**

```tsx
// Show for first-time users
<Card>
  <CardHeader>
    <CardTitle>Quick Start</CardTitle>
    <CardDescription>Choose a pricing model to get started</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="cursor-pointer hover:border-primary">
        <CardHeader>
          <CardTitle className="text-base">Per-Unit Pricing</CardTitle>
          <CardDescription>
            Charge per item (e.g., $5 per window)
          </CardDescription>
        </CardHeader>
      </Card>
      <Card className="cursor-pointer hover:border-primary">
        <CardHeader>
          <CardTitle className="text-base">Hourly Pricing</CardTitle>
          <CardDescription>Charge by time (e.g., $75/hour)</CardDescription>
        </CardHeader>
      </Card>
      <Card className="cursor-pointer hover:border-primary">
        <CardHeader>
          <CardTitle className="text-base">Custom</CardTitle>
          <CardDescription>Set up pricing manually</CardDescription>
        </CardHeader>
      </Card>
    </div>
  </CardContent>
</Card>
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)

1. ✅ Tab badges with field counts
2. ✅ Disable/gray out empty tabs
3. ✅ Natural language examples instead of equations
4. ✅ Radio button examples
5. ✅ Options preview in Select pricing

### Phase 2: Structural Improvements (3-5 days)

1. ✅ Invoice Adjustments prominence (Option B - card above tabs)
2. ✅ Sticky Test Invoice button
3. ✅ Breadcrumb/sub-header context
4. ✅ Improved accordion previews

### Phase 3: Onboarding (5-7 days)

1. ✅ Smart empty state for first-time users
2. ✅ Progress checklist
3. ✅ Quick start templates

---

## Additional Research-Backed Improvements

### A. Emotional Hooks in Empty States (Setproduct)

Add emotional patterns to build connection:

```tsx
// Reassurance pattern
<p className="text-muted-foreground">
  You're all caught up. Enjoy the calm.
</p>

// Encouragement pattern
<p className="text-muted-foreground">
  It all starts with your first price. Ready?
</p>

// Celebration pattern
<p className="text-muted-foreground">
  All fields priced! You've earned it. 🎉
</p>

// Curiosity pattern
<p className="text-muted-foreground">
  No fields priced... yet. Let's change that.
</p>
```

### B. Illustrations for Empty States (Setproduct)

Consider adding simple illustrations to empty states:

**Rules for illustrations**:

1. **Centralized, not overwhelming** - Keep visuals surrounded by breathing room
2. **Avoid generic stock graphics** - Use visuals that tie back to the action
3. **Keep consistent visual language** - Match your design system style

**Suggested illustrations**:

- Empty pricing: Calculator or price tag icon
- No fields: Mobile phone with form placeholder
- Success state: Checkmark or celebration icon

### C. Inline Error Validation (Eleken)

For pricing inputs, implement inline validation:

```tsx
// Instead of showing errors on submit, validate as user types
<Input
  type="number"
  value={price}
  onChange={(e) => {
    const value = parseFloat(e.target.value);
    if (value < 0) {
      setError("Price must be positive");
    } else if (value > 10000) {
      setError("Price seems unusually high. Please confirm.");
    } else {
      setError(null);
    }
    setPrice(e.target.value);
  }}
/>;
{
  error && <p className="text-sm text-destructive mt-1">{error}</p>;
}
```

### D. Personalization Based on Organization Type (Eleken)

Adapt the flow based on organization profile:

```tsx
// If organization has workers, show worker payment columns
// If organization has no workers, simplify to customer pricing only
{
  hasWorkers ? (
    <div className="grid grid-cols-2 gap-4">
      <div>Customer Price</div>
      <div>Worker Payment</div>
    </div>
  ) : (
    <div>
      <div>Customer Price</div>
      <p className="text-xs text-muted-foreground">
        Add workers to configure worker payments
      </p>
    </div>
  );
}
```

### E. Real-Time Preview (Airbnb Pattern from Eleken)

Show users how their pricing will appear on invoices:

```tsx
// Live preview panel
<Card className="sticky top-4">
  <CardHeader>
    <CardTitle className="text-base">Invoice Preview</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span>Window Cleaning (10 units)</span>
        <span>$50.00</span>
      </div>
      <div className="flex justify-between">
        <span>Call-out Fee</span>
        <span>$25.00</span>
      </div>
      <Separator />
      <div className="flex justify-between font-medium">
        <span>Total</span>
        <span>$75.00</span>
      </div>
    </div>
  </CardContent>
</Card>
```

### F. Mobile-First Considerations (Design Studio)

Ensure pricing configuration works on mobile:

```tsx
// Stack cards vertically on mobile
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards stack on mobile, grid on larger screens */}
</div>

// Large touch targets for inputs
<Input className="h-12 text-lg" />

// Sticky CTA on mobile
<div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden">
  <Button className="w-full" size="lg">
    Save Pricing
  </Button>
</div>
```

### G. FAQ Section for Pricing (Design Studio)

Add collapsible FAQ directly on pricing page:

```tsx
<Accordion type="single" collapsible className="mt-8">
  <AccordionItem value="how-pricing-works">
    <AccordionTrigger>How does pricing work?</AccordionTrigger>
    <AccordionContent>
      Prices are calculated based on the fields your workers fill in. Number
      fields multiply price × quantity. Boolean fields add a fixed amount when
      checked.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="worker-payments">
    <AccordionTrigger>How are workers paid?</AccordionTrigger>
    <AccordionContent>
      You can set worker payments separately from customer prices. Workers see
      their payment amounts in the app after completing jobs.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="change-pricing">
    <AccordionTrigger>Can I change pricing later?</AccordionTrigger>
    <AccordionContent>
      Yes! Changes apply to new jobs only. Existing jobs keep their original
      pricing. You can view pricing history in the History tab.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

## Research-Backed Design Principles Summary

### From Empty State Research (Setproduct)

| Principle                           | Application                                       |
| ----------------------------------- | ------------------------------------------------- |
| **Prioritize structure**            | Headline → Description → Icon → CTA               |
| **Respect visual hierarchy**        | Larger type for titles, lighter for descriptions  |
| **Keep it contextual**              | Different empty states for different features     |
| **Offer a clear next step**         | Every empty state answers "What should I do now?" |
| **Avoid blaming the user**          | "This space will hold..." not "You didn't add..." |
| **Be honest about what happened**   | Reflect back filters/search terms                 |
| **Show structure behind emptiness** | Grayed-out placeholders show what would appear    |

### From SaaS Pricing Research (Design Studio UI/UX)

| Principle                                  | Application                                   |
| ------------------------------------------ | --------------------------------------------- |
| **Keep pricing clear and transparent**     | Show headline price plainly, no hidden fees   |
| **Use strong visual hierarchy**            | Single "Recommended" plan with color/badge    |
| **Simplify comparison tables**             | Top 5-6 differentiators, collapsible details  |
| **Add social proof near pricing**          | Trust signals where decisions happen          |
| **Optimize CTA copy and placement**        | Direct, action-oriented: "Start free trial"   |
| **Prioritize simplicity and scannability** | Whitespace, no clutter, no auto-playing video |
| **Ensure mobile-first responsiveness**     | Stack cards vertically, large touch targets   |
| **Use localization**                       | Display prices in visitor's local currency    |
| **Add interactive toggles**                | Monthly vs Annual with savings highlighted    |
| **Include FAQ section**                    | Handle objections on the page                 |

### From Wizard UI Research (Eleken)

| Principle                                  | Application                                     |
| ------------------------------------------ | ----------------------------------------------- |
| **Map out user journey first**             | Identify key steps, pain points, guidance needs |
| **Prioritize essential steps only**        | Remove non-essential steps or fields            |
| **Incorporate progress indicators**        | Numbered steps or progress bar                  |
| **Offer clear, actionable error messages** | Specify the issue and how to fix it             |
| **Allow backward navigation**              | Users can modify previously entered info        |
| **Personalize when possible**              | Conditional logic based on user profile         |
| **Provide exit option with progress save** | "Save for Later" for lengthy processes          |
| **Conduct user testing and iterate**       | Watch drop-off rates, completion times          |

---

## Questions for Discussion

1. **Invoice Adjustments Placement**: Do you prefer Option A (top-level tab) or Option B (prominent card)?

   - _Research suggests_: Option B is less disruptive, but Option A provides equal prominence

2. **Empty State Strategy**: Should we hide empty tabs entirely, or show them grayed out with counts?

   - _Research suggests_: Show grayed out with counts—"Show structure behind the emptiness" (Setproduct)

3. **Onboarding Complexity**: Do you want full wizard-style onboarding, or simpler progressive disclosure?

   - _Research suggests_: Progressive disclosure first, wizard for first-time setup only

4. **Test Invoice Button**: Sticky floating button, or add to a persistent header?

   - _Research suggests_: Sticky/always visible—"Make it effortless to act" (Design Studio)

5. **Field Creation**: Should users be able to create fields directly from pricing page, or keep redirect to mobile-config?
   - _Research suggests_: Keep redirect but make it prominent—"One path is better than three vague options" (Setproduct)

---

## Pitfalls to Avoid (Research-Based)

Based on Eleken's Wizard UI research, avoid these common mistakes:

1. **Overcomplicating the process** - Limit each step to critical information only
2. **Lack of clear navigation** - Ensure "Next," "Back," "Finish" are visible and labeled
3. **Forcing a linear flow without flexibility** - Allow users to skip optional steps
4. **No progress indicator** - Always show where users are in the journey
5. **Inadequate error handling** - Clear, actionable messages with inline validation
6. **Failure to save progress** - Auto-save or manual save for long processes
7. **Not optimizing for mobile** - Large tap targets, responsive layouts
8. **Skipping usability testing** - Test with real users, observe hesitation points

---

## Next Steps

1. Review and prioritize recommendations based on research alignment
2. Choose implementation approach for each item
3. Create detailed implementation tickets
4. Implement Phase 1 (quick wins) first—highest research support
5. Test with users, iterate based on feedback
6. Measure: drop-off rates, completion times, support tickets
