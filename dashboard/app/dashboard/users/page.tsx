"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrganizationUserForm from "@/components/users/organization-user-form";
import OrganizationUserList from "@/components/users/organization-user-list";
import WorkerForm from "@/components/workers/worker-form";
import WorkerList from "@/components/workers/worker-list";
import { useOrganizationUsers } from "@/hooks/use-organization-users";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { Plus } from "lucide-react";
import { useState } from "react";

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
    name: string;
    email: string;
    phone: string;
  }) => {
    if (!organizationId) return;
    await createWorker({
      organization_id: organizationId,
      ...workerData,
    });
  };

  const handleUpdateWorker = async (
    workerId: string,
    workerData: {
      name: string;
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
    return <LoadingState message="Loading users..." fullScreen />;
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
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-2">
          Manage dashboard users and mobile app workers
        </p>
      </div>

      <Tabs defaultValue="dashboard-users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard-users">Dashboard Users</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard-users" className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1" />
            <Button
              className="cursor-pointer"
              onClick={() => setIsOrgUserFormOpen(true)}
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1" />
            <Button
              className="cursor-pointer"
              onClick={() => setIsWorkerFormOpen(true)}
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
    </>
  );
}
