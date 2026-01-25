# Mobile Configuration User Stories

This directory contains user stories for the Mobile Application Configuration page, covering field configuration, form building, sections, location restrictions, and mutually exclusive groups.

## Overview

The Mobile Configuration page allows admins to configure the form fields that workers use in the mobile app to complete jobs. This includes creating fields, organizing them into sections, setting up location restrictions, and configuring mutually exclusive groups.

## User Stories

### 001 - Field Creation and Configuration
**Focus**: Creating and configuring form fields for mobile app
- Adding fields with different types (text, number, select, etc.)
- Setting field labels, names, descriptions
- Configuring field requirements and validation
- Assigning fields to sections

### 002 - Location-Based Field Restrictions
**Focus**: Restricting fields to specific locations
- Enabling location restrictions for fields
- Selecting which locations a field appears at
- Consistent UI for location selection (add vs edit)
- Visual indicators for restricted fields

### 003 - Mutually Exclusive Groups and Clusters
**Focus**: Creating "choose one" options for workers
- Accessing Advanced Options via visible button in page header
- Creating cluster/option names in Advanced Options modal
- Assigning fields to clusters in field settings
- Understanding where to create vs assign clusters
- Visual feedback and tooltips for cluster assignments

### 004 - Form Sections Management
**Focus**: Organizing fields into collapsible sections
- Creating and editing form sections
- Assigning fields to sections
- Reordering sections and fields
- Section collapse behavior configuration

### 005 - Field Editing and Updates
**Focus**: Modifying existing field configurations
- Editing field properties (label, type, options)
- Updating location restrictions
- Changing section assignments
- Consistent editing experience across dialogs

### 006 - Advanced Field Options
**Focus**: Conditional logic and advanced configurations
- Accessing Advanced Options via visible modal button
- Setting up conditional field visibility
- Configuring mutually exclusive clusters in modal
- Understanding cluster creation workflow
- Links and guidance for advanced features

## Key Features Covered

- **Field Types**: Text, Number, Email, Phone, Select, Textarea, Date, Time, Boolean, Image, Address, Grouped Breakdown
- **Location Restrictions**: Restrict fields to specific customer locations
- **Mutually Exclusive Groups**: Create "choose one" options where workers select a single option
- **Form Sections**: Organize fields into collapsible sections for better mobile UX
- **Conditional Logic**: Show/hide fields based on other field values
- **Visual Form Builder**: Drag-and-drop interface for organizing fields

## Dependencies

These user stories depend on:
- Field configuration database schema
- Location management system
- Form section management
- Mobile app form rendering
- Edge functions for field config CRUD operations

## Testing Considerations

- Field creation and validation
- Location restriction functionality
- Mutually exclusive group behavior
- Section organization and ordering
- Conditional logic execution
- Mobile app form rendering accuracy
- Data consistency between dashboard and mobile app

## Priority Order

1. **001** - Core field creation (Foundation)
2. **004** - Section management (Organization)
3. **002** - Location restrictions (Business logic)
4. **003** - Mutually exclusive groups (Advanced feature)
5. **005** - Field editing (UX improvement)
6. **006** - Advanced options (Power user feature)

## Related Areas

- **Mobile App**: Form rendering and field display
- **Locations**: Customer location management
- **Jobs**: Job completion and data collection
- **Pricing**: Field-based pricing rules
- **Invoices**: Field values in invoice calculations
