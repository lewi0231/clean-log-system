# Admin Users User Stories

This directory contains user stories for dashboard user management functionality, covering admin and viewer user accounts within the Tally Runner system.

## Overview

Dashboard users (admins and viewers) are team members who access the web dashboard to manage workers, jobs, and invoices. These user stories focus on the complete lifecycle of dashboard user accounts.

## User Stories

### 001 - Admin User Invitation Creation

**Focus**: Inviting new dashboard users with email notifications

- Adding admin/viewer users with complete contact information
- Email invitation system with activation links
- Form validation and success feedback

### 002 - Admin User Activation Process

**Focus**: Secure account activation and status tracking

- Email-based activation with secure tokens
- Password setup and account activation
- Status tracking (pending → active)
- Error handling for expired/invalid links

### 003 - Admin User Contact Information

**Focus**: Collecting and validating complete user details

- First name, last name, phone number collection
- Phone number validation and formatting
- Consistency with worker data collection patterns

### 004 - Admin User Information Display

**Focus**: Comprehensive user information display

- Names, contact details, and status visualization
- Status badges (Active/Pending/Inactive)
- Enhanced table with sorting and responsive design

### 005 - Admin to Worker Conversion

**Focus**: Flexible role conversion for workforce management

- Dashboard users becoming mobile app workers
- Maintaining dual access (dashboard + mobile)
- Seamless conversion with data synchronization

### 006 - Admin In-App Notifications

**Focus**: When and who gets notified for organization events

- Worker creates job → all admins
- Admin creates job / invoice → other admins
- Payment received / client review → all admins
- Admin changes settings, form fields, pricing, locations, users → other admins
- Defines new notification types and "other admins only" pattern

## Key Features Covered

- **Multi-role Support**: Admin and Viewer user types with different permissions
- **Secure Invitations**: Email-based onboarding with secure activation links
- **Status Tracking**: Clear visibility into user account states
- **Contact Management**: Complete contact information for all team members
- **Role Flexibility**: Easy conversion between dashboard and mobile worker roles
- **In-App Notifications**: Admins notified for jobs, payments, reviews, and configuration changes (see [006](./006-admin-notifications.md))

## Dependencies

These user stories depend on:

- Supabase authentication system
- Email service integration (SendGrid/Mailgun)
- Database schema updates for organization_users table
- Mobile app authentication compatibility

## Testing Considerations

- Email sending and delivery verification
- Token security and expiration handling
- Cross-platform authentication (dashboard + mobile)
- Data consistency between user types
- Permission and role-based access control

## Priority Order

1. **001** - Core invitation functionality (Foundation)
2. **002** - Account activation (Security/Essential)
3. **003** - Contact information (Data completeness)
4. **004** - Information display (UX improvement)
5. **005** - Role conversion (Advanced feature)
6. **006** - Admin in-app notifications (When/who gets notified; extend existing notification system)

## Related Areas

- **Workers**: Mobile app user management; [Worker notification system (worker becomes active)](../workers/002-worker-active-notification-system.md)
- **Authentication**: Login and security systems
- **Email System**: Notification and invitation delivery
- **Database**: User data storage and relationships
- **Notification system**: [Architecture and reliability](../../decisions/notification-system.md)
