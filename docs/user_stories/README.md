# User Stories

This directory contains user stories for new features and feature updates for the Clean Log System platform.

## Structure

Each user story is a self-contained markdown document following this naming convention:

- `###-feature-name.md` where `###` is a sequential number (001, 002, etc.)

## Current User Stories

### [001: Worker Creation Toast Notification](./workers/001-worker-creation-toast-notification.md)

**Status**: Pending  
**Priority**: Medium  
**Complexity**: Low

Add toast notification feedback when admins create workers, confirming that an invitation email will be sent.

### [002: Notification System - Worker Becomes Active](./workers/002-worker-active-notification-system.md)

**Status**: Pending  
**Priority**: Medium  
**Complexity**: Medium-High

Implement a notification system that alerts admins when workers complete onboarding and become active. This includes database schema, edge function updates, and frontend notification components.

## Worker Payment User Stories

### [003: Worker Payment Calculation Flow](./workers/003-worker-payment-calculation-flow.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Streamlined workflow for calculating worker payments for completed jobs, including job selection, calculation preview, payment breakdown, and batch saving.

### [004: Worker Payment Summary Dashboard](./workers/004-worker-payment-summary-dashboard.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Comprehensive dashboard view showing worker payment summaries, including total payments per worker, job counts, averages, and payment trends.

### [005: Worker Payment History](./workers/005-worker-payment-history.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Complete history of all payment calculations and batches with filtering, status tracking, detailed views, and export functionality.

### [006: Worker Payment Approval and Processing](./workers/006-worker-payment-approval-and-processing.md)

**Status**: Pending  
**Priority**: High  
**Complexity**: Medium

Workflow to review, approve, and mark payments as paid with payment method tracking, supporting the payment lifecycle from calculation through completion.

### [007: Worker Payment Rates and Custom Splits](./workers/007-worker-payment-rates-and-splits.md)

**Status**: Pending  
**Priority**: Medium-High  
**Complexity**: High

Configure different payment rates for workers (e.g., supervisor rates, apprentice rates) and customize payment splits when multiple workers are assigned to the same job.

## Invoice User Stories

### [001: Invoice Creation and Calculation](./invoices/001-invoice-creation-and-calculation.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: High

Create invoices for completed jobs with automatic pricing calculations based on configured pricing rules, including line items, adjustments, and totals.

### [002: Invoice List and Filtering](./invoices/002-invoice-list-and-filtering.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

View and filter all invoices with status indicators, date ranges, and quick actions for efficient invoice management.

### [003: Invoice Detail View](./invoices/003-invoice-detail-view.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

View detailed invoice information including line items, calculations, payment history, and invoice status for both admins and customers.

### [004: Invoice Sending and Email](./invoices/004-invoice-sending-and-email.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Send invoices to customers via email with payment links, including email delivery, payment link creation, and resend functionality.

### [005: Invoice Approval Workflow](./invoices/005-invoice-approval-workflow.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Review and approve auto-generated invoices before sending, including approve/reject actions and workflow management.

### [006: Auto-Generation of Invoices](./invoices/006-auto-generation-of-invoices.md)

**Status**: In Progress  
**Priority**: Medium-High  
**Complexity**: High

Automatically generate invoices for completed jobs based on configured schedules (daily, weekly, monthly) with grouping options.

### [007: Invoice Template Customization](./invoices/007-invoice-template-customization.md)

**Status**: In Progress  
**Priority**: Medium  
**Complexity**: Medium

Customize invoice appearance including branding, layout, and information display to match company requirements.

### [008: Payment Tracking and History](./invoices/008-payment-tracking-and-history.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Track payments for invoices including payment status, methods, amounts, and history for payment reconciliation.

### [009: Overdue Invoice Management](./invoices/009-overdue-invoice-management.md)

**Status**: Pending  
**Priority**: Medium-High  
**Complexity**: Medium

Identify, track, and manage overdue invoices with automatic detection, reminders, and collection tools.

### [010: Invoice Export and Print](./invoices/010-invoice-export-and-print.md)

**Status**: In Progress  
**Priority**: Medium  
**Complexity**: Low-Medium

Export and print invoices in professional formats for record-keeping, accounting, and customer records.

## User Story Template

When creating new user stories, use this structure:

```markdown
# User Story ###: [Feature Name]

## Overview

Brief description of what this feature accomplishes.

## User Story

**As a** [user type]  
**I want to** [action/goal]  
**So that** [benefit/reason]

## Acceptance Criteria

1. [Criterion 1]
2. [Criterion 2]
   ...

## Technical Details

[Implementation details, architecture, file locations, etc.]

## Testing Considerations

[What needs to be tested]

## Priority

**Priority**: [High/Medium/Low]  
**Complexity**: [High/Medium/Low]  
**Estimated Effort**: [Time estimate]

## Notes

[Additional context, considerations, etc.]
```

## Best Practices

1. **Be Specific**: Clearly define what needs to be built and why
2. **Include Acceptance Criteria**: Define what "done" means
3. **Technical Details**: Include relevant implementation details, file paths, and architecture decisions
4. **Testing**: Specify what needs to be tested
5. **Priority & Complexity**: Help prioritize and estimate work
6. **Research**: Include references to best practices and patterns when relevant

## Updating Stories

- Update status as stories progress (Pending → In Progress → Completed)
- Add implementation notes when work begins
- Reference related PRs/issues when applicable
