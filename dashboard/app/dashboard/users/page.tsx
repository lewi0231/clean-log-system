"use client";

import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { usersTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
import { Button } from "@/components/ui/button";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton-loaders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrganizationUserForm from "@/components/users/organization-user-form";
import OrganizationUserList from "@/components/users/organization-user-list";
import WorkerForm from "@/components/workers/worker-form";
import WorkerList from "@/components/workers/worker-list";
import { useOrganizationUsers } from "@/hooks/use-organization-users";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export default function UsersPage() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization();
  const {
    organizationUsers,
    loading: orgUsersLoading,
    error: orgUsersError,
    createOrganizationUser,
    updateOrganizationUser,
    deleteOrganizationUser,
    resendInvitation: resendOrgUserInvitation,
    convertToWorker,
  } = useOrganizationUsers();
  const {
    workers,
    loading: workersLoading,
    error: workersError,
    createWorker,
    updateWorker,
    deleteWorker,
    resendInvitation,
  } = useWorkers();
  const [isWorkerFormOpen, setIsWorkerFormOpen] = useState(false);
  const [isOrgUserFormOpen, setIsOrgUserFormOpen] = useState(false);

  const handleAddWorker = async (workerData: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  }) => {
    if (!organizationId) return;
    try {
      const { emailSent, emailError } = await createWorker({
        organization_id: organizationId,
        ...workerData,
      });
      if (emailSent) {
        toast.success(`Invitation email sent to ${workerData.email}`);
      } else {
        toast.warning(
          emailError
            ? `Worker created, but the invitation email could not be sent: ${emailError}`
            : `Worker created, but the invitation email could not be sent. Use Resend or check email settings.`
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create worker");
    }
  };

  const handleUpdateWorker = async (
    workerId: string,
    workerData: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      active?: boolean;
    }
  ) => {
    await updateWorker({
      id: workerId,
      ...workerData,
    });
  };

  const handleDeleteWorker = async (workerId: string) => {
    await deleteWorker({ id: workerId });
  };

  const handleAddOrgUser = async (userData: {
    email?: string;
    role: "admin" | "viewer";
    first_name?: string;
    last_name?: string;
    phone?: string | null;
  }) => {
    if (!organizationId) return;
    if (!userData.email || !userData.first_name || !userData.last_name) {
      toast.error("Email, first name, and last name are required");
      return;
    }
    try {
      await createOrganizationUser({
        organization_id: organizationId,
        email: userData.email,
        role: userData.role,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone: userData.phone || undefined,
      });
      toast.success(`Invitation sent to ${userData.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    }
  };

  const handleUpdateOrgUser = async (
    userId: string,
    userData: {
      role: "admin" | "viewer";
      first_name?: string;
      last_name?: string;
      phone?: string | null;
    }
  ) => {
    try {
      await updateOrganizationUser({
        id: userId,
        ...userData,
        // API type expects string | undefined (not null)
        phone: userData.phone ?? undefined,
      });
      toast.success("User updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    }
  };

  const handleDeleteOrgUser = async (userId: string) => {
    try {
      await deleteOrganizationUser({ id: userId });
      toast.success("User deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    }
  };

  const handleResendOrgUserInvitation = async (userId: string) => {
    if (!organizationId) return;
    try {
      await resendOrgUserInvitation(userId, organizationId);
      toast.success("Invitation resent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend invitation");
    }
  };

  const handleConvertToWorker = async (userId: string) => {
    if (!organizationId) return;
    try {
      const result = await convertToWorker(userId, organizationId);
      if (result.alreadyWorker) {
        toast.info("User is already a worker");
      } else {
        toast.success("User can now use the mobile app with their existing credentials");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to convert user to worker");
    }
  };

  if (orgLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="space-y-6">
          <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
          <TableSkeleton rows={5} columns={4} />
        </div>
      </>
    );
  }

  if (orgError || !organizationId) {
    return <ErrorState message={orgError || "Failed to load organization"} fullScreen />;
  }

  return (
    <PageTourWrapper pageId="users" steps={usersTourSteps}>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-2">
            Manage dashboard users and mobile app workers
          </p>
        </div>
        <TourTriggerButton />
      </div>

      <Tabs defaultValue="dashboard-users" className="space-y-6">
        <TabsList>
          <TabsTrigger
            value="dashboard-users"
            data-tour="dashboard-users-tab"
            className="cursor-pointer"
          >
            Dashboard Users
          </TabsTrigger>
          <TabsTrigger value="workers" data-tour="workers-tab" className="cursor-pointer">
            Workers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard-users" className="space-y-4">
          <div className="flex items-center justify-between mb-6 gap-2">
            <ContextualHelp label="Dashboard users">
              <p>
                These people sign in to <strong>this web dashboard</strong> (roles: admin or
                viewer). They are separate from <strong>workers</strong>, who use the mobile app to
                complete jobs.
              </p>
            </ContextualHelp>
            <Button
              className="cursor-pointer"
              onClick={() => setIsOrgUserFormOpen(true)}
              data-tour="add-dashboard-user-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Dashboard User
            </Button>
          </div>

          <OrganizationUserList
            organizationUsers={organizationUsers}
            loading={orgUsersLoading}
            error={orgUsersError}
            onDeleteUser={handleDeleteOrgUser}
            onUpdateUser={handleUpdateOrgUser}
            onResendInvitation={handleResendOrgUserInvitation}
            onConvertToWorker={handleConvertToWorker}
          />
        </TabsContent>

        <TabsContent value="workers" className="space-y-4">
          <div className="flex items-center justify-between mb-6 gap-2">
            <ContextualHelp label="Workers and the mobile app">
              <p>
                Workers complete jobs using the mobile app. Forms and fields are configured in{" "}
                <Link
                  href="/dashboard/mobile-config"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Mobile configuration
                </Link>
                .
              </p>
            </ContextualHelp>
            <Button
              className="cursor-pointer"
              onClick={() => setIsWorkerFormOpen(true)}
              data-tour="add-worker-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Worker
            </Button>
          </div>

          <WorkerList
            workers={workers}
            loading={workersLoading}
            error={workersError}
            onDeleteWorker={handleDeleteWorker}
            onUpdateWorker={handleUpdateWorker}
            onResendInvitation={async (workerId: string) => {
              if (!organizationId) return;
              await resendInvitation(workerId, organizationId);
            }}
            organizationId={organizationId}
          />
        </TabsContent>
      </Tabs>

      <WorkerForm
        open={isWorkerFormOpen}
        onOpenChange={setIsWorkerFormOpen}
        onSuccess={async (workerData, workerId) => {
          if (workerId) {
            await handleUpdateWorker(workerId, workerData);
          } else {
            await handleAddWorker(workerData);
          }
        }}
      />

      <OrganizationUserForm
        open={isOrgUserFormOpen}
        onOpenChange={setIsOrgUserFormOpen}
        onSuccess={async (userData, userId) => {
          if (userId) {
            await handleUpdateOrgUser(userId, userData);
          } else {
            if (userData?.email) {
              await handleAddOrgUser(userData as { email: string; role: "admin" | "viewer" });
            }
          }
        }}
      />
    </PageTourWrapper>
  );
}
