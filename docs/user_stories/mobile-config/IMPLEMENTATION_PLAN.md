# Advanced Options Modal Implementation Plan

## Overview

Convert the Advanced Options section from a collapsible card at the bottom of the page to an accessible modal dialog with a visible button. This improves discoverability and makes the feature more intuitive.

## Design Changes

Based on the design images (`mutual_exclusion_advanced_no_option.png` and `mutual_exclusive_advanced.png`):
- **Current**: Collapsible card at bottom of page (hidden by default)
- **New**: Modal dialog with visible button in header/toolbar area
- **Design Layout**: 
  - Left panel: Configuration area (Dropdown Label, Available Options)
  - Right panel: Information panels ("How it works?", "Mobile App Preview")
  - Empty state: "Create First Option" button when no options exist
  - Populated state: List of options with field assignments and badges
- **Benefits**: 
  - Always visible button improves discoverability
  - Modal provides focused experience
  - Better accessibility with proper dialog semantics
  - More intuitive workflow
  - Matches design specifications with proper layout

## Implementation Steps

### 1. Update Mobile Config Page (`dashboard/app/dashboard/mobile-config/page.tsx`)

**Changes:**
- Remove `Collapsible` component
- Add visible "Advanced Options" button in header area (next to Tour button)
- Replace collapsible card with `Dialog` component
- Update state management from `advancedSectionOpen` to `advancedOptionsModalOpen`

**Button Placement:**
- In the header area, right side
- Icon: `Settings` or `Sliders` from lucide-react
- Label: "Advanced Options" or "Choose One Options"
- Visible at all times (not hidden)

**Modal Structure:**
```tsx
<Dialog open={advancedOptionsModalOpen} onOpenChange={setAdvancedOptionsModalOpen}>
  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Advanced Options</DialogTitle>
      <DialogDescription>
        Configure how workers select specific task options in the field
      </DialogDescription>
    </DialogHeader>
    <div className="grid grid-cols-[1fr_400px] gap-6">
      {/* Left Panel - Configuration */}
      <div className="space-y-4">
        {/* Dropdown Label Section */}
        {/* Available Options Section */}
        <MutuallyExclusiveGroupManager ... />
      </div>
      {/* Right Panel - Information & Preview */}
      <div className="space-y-4">
        {/* How it works? Panel */}
        {/* Mobile App Preview Panel */}
        {/* Pro-tip */}
      </div>
    </div>
  </DialogContent>
</Dialog>
```

### 2. Update MutuallyExclusiveGroupManager Component

**Changes:**
- Remove `Card` wrapper (modal provides container)
- Restructure layout to match design: left configuration panel, right info panels
- Implement empty state with "Create First Option" button (when no options exist)
- Implement populated state with options list showing field badges
- Add "How it works?" panel on right side
- Add "Mobile App Preview" panel on right side
- Add Pro-tip section at bottom
- Ensure content is scrollable within modal
- Maintain all existing functionality

**Layout Adjustments:**
- Remove outer Card component
- Split into two-column grid: configuration (left) and info/preview (right)
- Move "How it works?" content to right panel
- Move mobile preview to right panel
- Add Pro-tip section
- Adjust padding for modal context
- Ensure mobile preview works in modal
- Make content scrollable if needed

### 3. Update Field Settings Guidance

**Changes:**
- Update the helpful text in `section-editor.tsx` Advanced Options
- Change reference from "bottom of this page" to "Advanced Options button"
- Update link/guidance text to point to modal button

**Text Update:**
```tsx
💡 Need to create a new cluster name? Click the "Advanced Options" button 
at the top of the page to create option names first.
```

### 4. Update User Stories

**Files to Update:**
- `003-mutually-exclusive-groups-and-clusters.md`
- `006-advanced-field-options.md`
- `README.md`

**Key Changes:**
- Update references from "Advanced Options section at bottom" to "Advanced Options modal"
- Update workflow descriptions
- Update acceptance criteria
- Update technical details

## Technical Details

### Component Structure

```tsx
// Mobile Config Page
<div className="mb-6">
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1 min-w-0">
      {/* Title and description */}
    </div>
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => setAdvancedOptionsModalOpen(true)}
        className="cursor-pointer"
      >
        <Settings className="w-4 h-4 mr-2" />
        Advanced Options
      </Button>
      <TourTriggerButton />
    </div>
  </div>
</div>

{/* Modal */}
<Dialog open={advancedOptionsModalOpen} onOpenChange={setAdvancedOptionsModalOpen}>
  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Advanced Options</DialogTitle>
      <DialogDescription>
        Configure how workers select specific task options in the field
      </DialogDescription>
    </DialogHeader>
    <div className="grid grid-cols-[1fr_400px] gap-6 py-4">
      {/* Left: Configuration */}
      <div className="space-y-4">
        {/* Dropdown Label Card */}
        {/* Available Options Card */}
        <MutuallyExclusiveGroupManager ... />
      </div>
      {/* Right: Info & Preview */}
      <div className="space-y-4">
        {/* How it works? Card */}
        {/* Mobile App Preview Card */}
        {/* Pro-tip Card */}
      </div>
    </div>
  </DialogContent>
</Dialog>
```

### State Management

```tsx
const [advancedOptionsModalOpen, setAdvancedOptionsModalOpen] = useState(false);
```

### Accessibility

- Proper dialog semantics (Dialog component handles this)
- Focus management (Dialog component handles this)
- Keyboard navigation (ESC to close)
- Screen reader support (DialogTitle, DialogDescription)

## Testing Considerations

1. **Button Visibility**
   - Button is always visible in header
   - Button has proper styling and hover states
   - Button is accessible via keyboard

2. **Modal Functionality**
   - Modal opens when button clicked
   - Modal closes when X clicked or ESC pressed
   - Modal closes when clicking outside (if configured)
   - Focus is properly managed

3. **Content Display**
   - Two-column layout displays correctly (configuration left, info/preview right)
   - Empty state shows "Create First Option" button when no options exist
   - Populated state shows options list with field badges
   - Dropdown Label section displays at top of left panel
   - "How it works?" panel displays on right
   - Mobile App Preview panel displays on right
   - Pro-tip section displays at bottom
   - Content is scrollable if needed
   - Mobile preview works in modal
   - All interactions work within modal

4. **User Workflow**
   - Users can discover Advanced Options easily
   - Creating clusters works as expected
   - Field assignment guidance is accurate
   - Overall workflow is intuitive

## Migration Notes

- No database changes required
- No API changes required
- Existing functionality preserved
- Only UI/UX changes

## Benefits

1. **Discoverability**: Button is always visible, not hidden at bottom
2. **Focus**: Modal provides focused experience without page scroll
3. **Accessibility**: Proper dialog semantics improve screen reader support
4. **Intuitive**: Clear button label and placement
5. **Consistent**: Follows common modal pattern used elsewhere in app

## Rollout Plan

1. Implement modal structure
2. Add visible button
3. Update guidance text
4. Test functionality
5. Update user stories
6. Deploy
