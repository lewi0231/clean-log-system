"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkerRateCards } from "@/hooks/use-worker-rate-cards";
import { useWorkers } from "@/hooks/use-workers";
import type { WorkerRateCard } from "@/lib/services/worker-rate-card.service";
import { format } from "date-fns";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type RateCardFormData = {
  worker_id: string;
  hourly_rate: string;
  effective_from: string;
  effective_to: string;
  rate_type: "standard" | "overtime" | "holiday";
  role_title: string;
  notes: string;
};

const emptyFormData: RateCardFormData = {
  worker_id: "",
  hourly_rate: "",
  effective_from: new Date().toISOString().split("T")[0],
  effective_to: "",
  rate_type: "standard",
  role_title: "",
  notes: "",
};

export default function RateCardManager() {
  const { formatCurrency } = useOrganizationCurrency();
  const { workers } = useWorkers();
  const {
    rateCards,
    loading,
    createRateCard,
    updateRateCard,
    deactivateRateCard,
  } = useWorkerRateCards();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<WorkerRateCard | null>(null);
  const [formData, setFormData] = useState<RateCardFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  const activeRateCards = rateCards.filter((card) => card.is_active);

  const handleOpenCreate = () => {
    setEditingCard(null);
    setFormData(emptyFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (card: WorkerRateCard) => {
    setEditingCard(card);
    setFormData({
      worker_id: card.worker_id,
      hourly_rate: card.hourly_rate.toString(),
      effective_from: card.effective_from,
      effective_to: card.effective_to || "",
      rate_type: card.rate_type as "standard" | "overtime" | "holiday",
      role_title: card.role_title || "",
      notes: card.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.worker_id || !formData.hourly_rate) {
      toast.error("Please fill in required fields");
      return;
    }

    const hourlyRate = parseFloat(formData.hourly_rate);
    if (isNaN(hourlyRate) || hourlyRate <= 0) {
      toast.error("Hourly rate must be a positive number");
      return;
    }

    setSaving(true);
    try {
      if (editingCard) {
        await updateRateCard({
          id: editingCard.id,
          hourly_rate: hourlyRate,
          effective_from: formData.effective_from,
          effective_to: formData.effective_to || null,
          rate_type: formData.rate_type,
          role_title: formData.role_title || null,
          notes: formData.notes || null,
        });
        toast.success("Rate card updated");
      } else {
        await createRateCard({
          worker_id: formData.worker_id,
          hourly_rate: hourlyRate,
          effective_from: formData.effective_from,
          effective_to: formData.effective_to || null,
          rate_type: formData.rate_type,
          role_title: formData.role_title || null,
          notes: formData.notes || null,
        });
        toast.success("Rate card created");
      }
      setIsDialogOpen(false);
      setFormData(emptyFormData);
      setEditingCard(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save rate card"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (card: WorkerRateCard) => {
    if (
      !confirm(
        `Are you sure you want to deactivate the rate card for ${card.worker?.first_name} ${card.worker?.last_name}?`
      )
    ) {
      return;
    }

    try {
      await deactivateRateCard(card.id);
      toast.success("Rate card deactivated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to deactivate rate card"
      );
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1" />
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rate Card
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker Rate Cards</CardTitle>
          <CardDescription>
            Configure hourly rates for workers to enable rate-based payment
            splits
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading rate cards...
            </div>
          ) : activeRateCards.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No rate cards configured yet.</p>
              <p className="text-sm mt-1">
                Rate cards enable automatic payment splitting based on worker
                rates.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Hourly Rate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRateCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">
                      {card.worker
                        ? `${card.worker.first_name} ${card.worker.last_name}`
                        : "Unknown"}
                    </TableCell>
                    <TableCell>{card.role_title || "-"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(card.hourly_rate)}/hr
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{card.rate_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(card.effective_from), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {card.effective_to
                        ? format(new Date(card.effective_to), "MMM d, yyyy")
                        : "No end date"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(card)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivate(card)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCard ? "Edit Rate Card" : "Create Rate Card"}
            </DialogTitle>
            <DialogDescription>
              {editingCard
                ? "Update the rate card details below."
                : "Configure a payment rate for a worker."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="worker">
                Worker <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.worker_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, worker_id: value })
                }
                disabled={!!editingCard}
              >
                <SelectTrigger id="worker">
                  <SelectValue placeholder="Select a worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hourly-rate">
                  Hourly Rate <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="hourly-rate"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.hourly_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, hourly_rate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate-type">Rate Type</Label>
                <Select
                  value={formData.rate_type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      rate_type: value as "standard" | "overtime" | "holiday",
                    })
                  }
                >
                  <SelectTrigger id="rate-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="overtime">Overtime</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-title">Role / Title</Label>
              <Input
                id="role-title"
                placeholder="e.g., Supervisor, Senior Technician"
                value={formData.role_title}
                onChange={(e) =>
                  setFormData({ ...formData, role_title: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effective-from">Effective From</Label>
                <Input
                  id="effective-from"
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) =>
                    setFormData({ ...formData, effective_from: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effective-to">Effective To</Label>
                <Input
                  id="effective-to"
                  type="date"
                  value={formData.effective_to}
                  onChange={(e) =>
                    setFormData({ ...formData, effective_to: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for no end date
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingCard ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
