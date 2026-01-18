# useAlertDialog Test Plan

## Overview

The `useAlertDialog` hook manages alert dialog state and navigation in the mobile app. This document outlines what needs to be tested to ensure the dialog persistence bug is fixed.

## Test Scenarios

### 1. Dialog State Management

**Test**: Dialog state initializes correctly

- ✅ Dialog should start closed
- ✅ Title and message should be empty strings

### 2. showAlert Function

**Test**: Can show alert with title and message

- ✅ Sets alertOpen to true
- ✅ Sets correct title and message
- ✅ Accepts optional callback

### 3. showSuccessAndNavigate Function

**Test**: Success dialog with navigation

- ✅ Shows success alert with correct message
- ✅ Sets up navigation callback
- ✅ Navigation only happens when OK is clicked
- ✅ Navigation does NOT happen if dialog is closed without OK

### 4. Focus Effect (Critical for Bug Fix)

**Test**: Dialog state clears when screen comes into focus

- ✅ When screen gains focus, dialog state is cleared
- ✅ This prevents dialog from persisting when navigating back
- ✅ All state (open, title, message, callback) is reset

### 5. OK Button Press Handling

**Test**: OK button press triggers callback correctly

- ✅ Sets okButtonPressedRef flag
- ✅ Closes dialog
- ✅ Callback executes after delay
- ✅ Callback is cleared after execution

### 6. Dialog Close Without OK

**Test**: Closing dialog without OK doesn't trigger callback

- ✅ If dialog closes without OK press, callback is not executed
- ✅ State is properly cleared

## Integration Test Scenarios

### 7. Full Success Flow

**Test**: Complete success submission flow

1. Submit form successfully
2. Success dialog appears
3. User clicks OK
4. Navigation happens
5. User navigates back to screen
6. Dialog should NOT be visible

### 8. Error Handling

**Test**: Error dialogs don't navigate

- ✅ Error alerts don't have navigation callbacks
- ✅ Dialog can be dismissed normally

## Implementation Status

- ✅ Hook created with testable structure
- ✅ Focus effect implemented to clear state
- ✅ Navigation callback only executes on OK click
- ✅ Component refactored to use hook
- ⏳ Tests need to be written and run
- ⏳ Integration testing needed

## Known Issues Fixed

1. **Dialog Persistence**: Fixed by using `useFocusEffect` to clear state on screen focus
2. **Premature Navigation**: Fixed by ensuring callback only executes when OK is clicked
3. **State Management**: Extracted to testable hook for better maintainability
