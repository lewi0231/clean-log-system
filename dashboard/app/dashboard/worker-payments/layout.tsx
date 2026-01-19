"use client";

import CalculatePaymentDialog from "@/components/worker-payments/calculate-payment-dialog";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import useOrganization from "@/hooks/useOrganization";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { createContext, ReactNode, useContext, useState } from "react";

type CalculatePaymentsContextType = {
  openDialog: () => void;
};

const CalculatePaymentsContext = createContext<CalculatePaymentsContextType | null>(null);

export function useCalculatePayments() {
  const context = useContext(CalculatePaymentsContext);
  if (!context) {
    throw new Error("useCalculatePayments must be used within WorkerPaymentsLayout");
  }
  return context;
}

export default function WorkerPaymentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { organizationId } = useOrganization();
  const { calculatePayments } = useWorkerPayments();
  const { addPayment } = useWorkerPaymentHistory();
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);

  const handleCalculatePayments = async (jobIds: string[]) => {
    if (!organizationId) return;

    const result = await calculatePayments(jobIds);
    if (result?.calculation) {
      // Save to database via service
      try {
        await WorkerPaymentService.savePayment(organizationId, result, jobIds);
        // Payment saved to database with batch_id
        // Payment history is now fetched from database via useWorkerPaymentHistory hook
        // For now, localStorage records won't have batch_id, but database records will
        addPayment(result, jobIds);
      } catch (error) {
        console.error("Failed to save payment:", error);
        // Still add to local state for now, but log error
        addPayment(result, jobIds);
      }
    }
  };

  const openDialog = () => setIsCalculateDialogOpen(true);

  return (
    <CalculatePaymentsContext.Provider value={{ openDialog }}>
      {children}

      <CalculatePaymentDialog
        open={isCalculateDialogOpen}
        onOpenChange={setIsCalculateDialogOpen}
        onCalculate={handleCalculatePayments}
      />
    </CalculatePaymentsContext.Provider>
  );
}
