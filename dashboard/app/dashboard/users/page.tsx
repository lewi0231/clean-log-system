"use client";

import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { usersTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton-loaders";
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
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const {
    organizationUsers,
    loading: orgUsersLoading,
    error: orgUsersError,
    createOrganizationUser,
    updateOrganizationUser,
    deleteOrganizationUser,
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
      await createWorker({
        organization_id: organizationId,
        ...workerData,
      });
      toast.success(
        `Worker created. Invitation will be sent to ${workerData.email}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create worker"
      );
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
    email: string;
    role: "admin" | "viewer";
  }) => {
    if (!organizationId) return;
    await createOrganizationUser({
      organization_id: organizationId,
      ...userData,
    });
  };

  const handleUpdateOrgUser = async (
    userId: string,
    userData: {
      role: "admin" | "viewer";
    }
  ) => {
    await updateOrganizationUser({
      id: userId,
      ...userData,
    });
  };

  const handleDeleteOrgUser = async (userId: string) => {
    await deleteOrganizationUser({ id: userId });
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
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
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
          <TabsTrigger value="dashboard-users" data-tour="dashboard-users-tab">
            Dashboard Users
          </TabsTrigger>
          <TabsTrigger value="workers" data-tour="workers-tab">
            Workers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard-users" className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1" />
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
          />
        </TabsContent>

        <TabsContent value="workers" className="space-y-4">
          <div className="mb-4 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Workers complete jobs via our mobile application. Which you can
              configure{" "}
              <Link
                href="/dashboard/mobile-config"
                className="text-primary hover:underline font-medium"
              >
                here
              </Link>
              .
            </p>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1" />
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
          setIsWorkerFormOpen(false);
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
          setIsOrgUserFormOpen(false);
          if (userId) {
            await handleUpdateOrgUser(userId, userData);
          } else {
            if (userData?.email) {
              await handleAddOrgUser(
                userData as { email: string; role: "admin" | "viewer" }
              );
            }
          }
        }}
      />
    </PageTourWrapper>
  );
}
