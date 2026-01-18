# User Stories

This directory contains user stories for new features and feature updates for the Clean Log System platform.

## Structure

Each user story is a self-contained markdown document following this naming convention:

- `###-feature-name.md` where `###` is a sequential number (001, 002, etc.)

## Current User Stories

### [001: Worker Creation Toast Notification](./001-worker-creation-toast-notification.md)

**Status**: Pending  
**Priority**: Medium  
**Complexity**: Low

Add toast notification feedback when admins create workers, confirming that an invitation email has been sent.

### [002: Notification System - Worker Becomes Active](./002-worker-active-notification-system.md)

**Status**: Pending  
**Priority**: Medium  
**Complexity**: Medium-High

Implement a notification system that alerts admins when workers complete onboarding and become active. This includes database schema, edge function updates, and frontend notification components.

## Worker Payment User Stories

### [003: Worker Payment Calculation Flow](./003-worker-payment-calculation-flow.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Streamlined workflow for calculating worker payments for completed jobs, including job selection, calculation preview, payment breakdown, and batch saving.

### [004: Worker Payment Summary Dashboard](./004-worker-payment-summary-dashboard.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Comprehensive dashboard view showing worker payment summaries, including total payments per worker, job counts, averages, and payment trends.

### [005: Worker Payment History](./005-worker-payment-history.md)

**Status**: In Progress  
**Priority**: High  
**Complexity**: Medium

Complete history of all payment calculations and batches with filtering, status tracking, detailed views, and export functionality.

### [006: Worker Payment Approval and Processing](./006-worker-payment-approval-and-processing.md)

**Status**: Pending  
**Priority**: High  
**Complexity**: Medium

Workflow to review, approve, and mark payments as paid with payment method tracking, supporting the payment lifecycle from calculation through completion.

### [007: Worker Payment Rates and Custom Splits](./007-worker-payment-rates-and-splits.md)

**Status**: Pending  
**Priority**: Medium-High  
**Complexity**: High

Configure different payment rates for workers (e.g., supervisor rates, apprentice rates) and customize payment splits when multiple workers are assigned to the same job.

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
