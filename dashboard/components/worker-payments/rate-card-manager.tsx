"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextualHelp } from "@/components/ui/contextual-help";
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
import type { FieldConfig } from "@clean-log/shared/types";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import {
  useWorkerRateCards,
  type ModifierType,
  type WorkerRateCard,
} from "@/hooks/use-worker-rate-cards";
import { useWorkers } from "@/hooks/use-workers";
import { format } from "date-fns";
import { Edit2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

type RateCardFormData = {
  worker_id: string;
  modifier_type: ModifierType;
  modifier_value: string;
  effective_from: string;
  effective_to: string;
  role_title: string;
  notes: string;
  field_config_ids: string[];
};

function createEmptyFormData(): RateCardFormData {
  return {
    worker_id: "",
    modifier_type: "flat",
    modifier_value: "",
    effective_from: new Date().toISOString().split("T")[0],
    effective_to: "",
    role_title: "",
    notes: "",
    field_config_ids: [],
  };
}

function workerDisplayName(worker: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const fromParts = [worker.first_name, worker.last_name].filter(Boolean).join(" ").trim();
  return fromParts || worker.name?.trim() || "Unnamed worker";
}

const modifierTypeLabels: Record<ModifierType, string> = {
  per_unit: "Per Unit Bonus",
  flat: "Flat Bonus",
  multiplier: "Multiplier",
  team_percentage: "Team Percentage",
  split_weight: "Split Weight (pool share)",
};

const modifierTypeDescriptions: Record<ModifierType, string> = {
  per_unit: "Bonus per unit of output (e.g., $0.50 per car). Added on top of time share.",
  flat: "Fixed bonus per job (e.g., $20). Added on top of time share.",
  multiplier: "Multiplies the worker's time-share (e.g., 1.2 = 20% more of the base payment).",
  team_percentage:
    "Percentage of other team members' earnings (e.g., 10% of team wages). Great for supervisors/team leads.",
  split_weight:
    "Relative share of the job worker payment pool. Default is 1.0 (full share). With clock times, pay splits by hours × weight (e.g. 0.6 for a trainee).",
};

interface RateCardManagerProps {
  fieldConfigs: FieldConfig[];
}

export default function RateCardManager({ fieldConfigs }: RateCardManagerProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const { workers } = useWorkers();
  const { rateCards, loading, createRateCard, updateRateCard, deactivateRateCard } =
    useWorkerRateCards();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<WorkerRateCard | null>(null);
  // Pass the factory directly (lazy useState init) so Fast Refresh remounts cleanly
  // after renames — avoids stale closures referencing a removed `emptyFormData`.
  const [formData, setFormData] = useState<RateCardFormData>(createEmptyFormData);
  const [saving, setSaving] = useState(false);

  const activeRateCards = rateCards.filter((card) => card.is_active);
  const selectableWorkers = workers.filter((worker) => worker.active !== false && !!worker.id);

  // Filter to numeric fields that could be used for per-unit bonuses
  const numericFieldConfigs = fieldConfigs.filter(
    (fc) => fc.field_type === "number" || fc.field_type === "grouped_breakdown"
  );

  const handleOpenCreate = () => {
    setEditingCard(null);
    setFormData(createEmptyFormData());
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (card: WorkerRateCard) => {
    setEditingCard(card);
    setFormData({
      worker_id: card.worker_id,
      modifier_type: card.modifier_type,
      modifier_value: card.modifier_value.toString(),
      effective_from: card.effective_from,
      effective_to: card.effective_to || "",
      role_title: card.role_title || "",
      notes: card.notes || "",
      field_config_ids: card.field_config_ids || [],
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!formData.worker_id) missing.push("Worker");
    if (!formData.modifier_value.trim()) missing.push("Amount / modifier value");
    if (!formData.effective_from) missing.push("Effective from");
    if (formData.modifier_type === "per_unit" && formData.field_config_ids.length === 0) {
      missing.push("Applies to fields");
    }

    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    const modifierValue = parseFloat(formData.modifier_value);
    if (isNaN(modifierValue) || modifierValue <= 0) {
      toast.error("Modifier value must be a positive number");
      return;
    }

    if (formData.modifier_type === "split_weight" && modifierValue > 10) {
      toast.error("Split weight must be 10 or less");
      return;
    }

    // Blank effective-to means open-ended (no end date)
    const effectiveTo = formData.effective_to.trim() ? formData.effective_to.trim() : null;

    setSaving(true);
    try {
      if (editingCard) {
        await updateRateCard({
          id: editingCard.id,
          modifier_type: formData.modifier_type,
          modifier_value: modifierValue,
          effective_from: formData.effective_from,
          effective_to: effectiveTo,
          role_title: formData.role_title.trim() || null,
          notes: formData.notes.trim() || null,
          field_config_ids: formData.modifier_type === "per_unit" ? formData.field_config_ids : [],
        });
        toast.success("Rate card updated");
      } else {
        await createRateCard({
          worker_id: formData.worker_id,
          modifier_type: formData.modifier_type,
          modifier_value: modifierValue,
          effective_from: formData.effective_from,
          effective_to: effectiveTo,
          role_title: formData.role_title.trim() || null,
          notes: formData.notes.trim() || null,
          field_config_ids: formData.modifier_type === "per_unit" ? formData.field_config_ids : [],
        });
        toast.success("Rate card created");
      }
      setIsDialogOpen(false);
      setFormData(createEmptyFormData());
      setEditingCard(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rate card");
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
      toast.error(error instanceof Error ? error.message : "Failed to deactivate rate card");
    }
  };

  const toggleFieldConfig = (fieldConfigId: string) => {
    setFormData((prev) => {
      const current = prev.field_config_ids;
      if (current.includes(fieldConfigId)) {
        return {
          ...prev,
          field_config_ids: current.filter((id) => id !== fieldConfigId),
        };
      } else {
        return {
          ...prev,
          field_config_ids: [...current, fieldConfigId],
        };
      }
    });
  };

  const formatModifierValue = (card: WorkerRateCard): string => {
    if (card.modifier_type === "multiplier") {
      return `${card.modifier_value}x`;
    }
    if (card.modifier_type === "team_percentage") {
      return `${card.modifier_value}%`;
    }
    if (card.modifier_type === "split_weight") {
      return `${card.modifier_value}`;
    }
    return `${formatCurrency(card.modifier_value)}`;
  };

  const getModifierDescription = (card: WorkerRateCard): string => {
    switch (card.modifier_type) {
      case "per_unit":
        return `${formatCurrency(card.modifier_value)} per unit`;
      case "flat":
        return `${formatCurrency(card.modifier_value)} per job`;
      case "multiplier": {
        const percentage = ((card.modifier_value - 1) * 100).toFixed(0);
        return percentage.startsWith("-")
          ? `${percentage}% of time share`
          : `+${percentage}% of time share`;
      }
      case "team_percentage":
        return `${card.modifier_value}% of team earnings`;
      case "split_weight":
        return `Weight ${card.modifier_value} (1.0 = full share)`;
      default:
        return "";
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <ContextualHelp label="How rate cards work" className="mt-0.5 max-w-2xl">
          <p>
            Rate cards attach <strong>per-worker modifiers</strong> to payment calculation: extras
            on top of worker amounts from your{" "}
            <Link
              href="/dashboard/pricing"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Pricing
            </Link>{" "}
            configuration.
          </p>
          <p>
            <strong>Flat</strong> and <strong>per unit</strong> add fixed amounts.{" "}
            <strong>Multiplier</strong> scales a worker relative to others.{" "}
            <strong>Team percentage</strong> is for leads (a cut of the team result).{" "}
            <strong>Split weight</strong> nudges how share is apportioned when you use that modifier
            type. Effective dates control when a card applies; deactivating stops new runs from
            using it.
          </p>
        </ContextualHelp>
        <Button onClick={handleOpenCreate} className="cursor-pointer shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Add Rate Card
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker Rate Cards</CardTitle>
          <CardDescription>
            Configure payment modifiers for workers to enable role-based bonuses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading rate cards...</div>
          ) : activeRateCards.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No rate cards configured yet.</p>
              <p className="text-sm mt-1">
                Rate cards enable bonuses and multipliers for specific workers.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Modifier Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
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
                    <TableCell>
                      <Badge variant="outline">{modifierTypeLabels[card.modifier_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono">{formatModifierValue(card)}</div>
                      <div className="text-xs text-muted-foreground">
                        {getModifierDescription(card)}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(card.effective_from), "MMM d, yyyy")}</TableCell>
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
                          className="cursor-pointer"
                          onClick={() => handleOpenEdit(card)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Rate Card" : "Create Rate Card"}</DialogTitle>
            <DialogDescription>
              {editingCard
                ? "Update the rate card details below."
                : "Configure a payment modifier for a worker."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="worker">
                Worker <span className="text-destructive">*</span>
              </Label>
              <Select
                // Radix rejects controlled value="" — use undefined so selection sticks.
                value={formData.worker_id || undefined}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, worker_id: value }))}
                disabled={!!editingCard}
              >
                <SelectTrigger id="worker" className="cursor-pointer">
                  <SelectValue placeholder="Select a worker" />
                </SelectTrigger>
                <SelectContent>
                  {selectableWorkers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No active workers available
                    </div>
                  ) : (
                    selectableWorkers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {workerDisplayName(worker)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modifier-type">
                Modifier Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.modifier_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    modifier_type: value as ModifierType,
                    field_config_ids: value !== "per_unit" ? [] : prev.field_config_ids,
                  }))
                }
              >
                <SelectTrigger id="modifier-type" className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Bonus (per job)</SelectItem>
                  <SelectItem value="per_unit">Per Unit Bonus (per output)</SelectItem>
                  <SelectItem value="multiplier">Multiplier (time share)</SelectItem>
                  <SelectItem value="team_percentage">
                    Team Percentage (supervisor bonus)
                  </SelectItem>
                  <SelectItem value="split_weight">Split weight (pool share)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {modifierTypeDescriptions[formData.modifier_type]}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modifier-value">
                {formData.modifier_type === "multiplier"
                  ? "Multiplier"
                  : formData.modifier_type === "team_percentage"
                    ? "Percentage"
                    : formData.modifier_type === "split_weight"
                      ? "Relative weight"
                      : "Amount"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="modifier-value"
                type="number"
                step={
                  formData.modifier_type === "multiplier"
                    ? "0.1"
                    : formData.modifier_type === "team_percentage"
                      ? "1"
                      : "0.01"
                }
                min="0.01"
                placeholder={
                  formData.modifier_type === "multiplier"
                    ? "1.2"
                    : formData.modifier_type === "team_percentage"
                      ? "10"
                      : formData.modifier_type === "split_weight"
                        ? "1.0"
                        : "0.00"
                }
                value={formData.modifier_value}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, modifier_value: e.target.value }))
                }
              />
              {formData.modifier_type === "multiplier" && (
                <p className="text-xs text-muted-foreground">
                  1.0 = no change, 1.2 = 20% more, 0.8 = 20% less
                </p>
              )}
              {formData.modifier_type === "team_percentage" && (
                <p className="text-xs text-muted-foreground">
                  10 = 10% of team earnings (excluding this worker)
                </p>
              )}
              {formData.modifier_type === "split_weight" && (
                <p className="text-xs text-muted-foreground">
                  1.0 = full share of the pool; 0.6 ≈ 60% of a full slot. Max 10.
                </p>
              )}
            </div>

            {/* Field selection for per_unit type */}
            {formData.modifier_type === "per_unit" && (
              <div className="space-y-2">
                <Label>
                  Applies to Fields <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select which fields this per-unit bonus applies to
                </p>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {numericFieldConfigs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No numeric fields configured</p>
                  ) : (
                    numericFieldConfigs.map((fc) => (
                      <div key={fc.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-${fc.id}`}
                          checked={formData.field_config_ids.includes(fc.id)}
                          onCheckedChange={() => toggleFieldConfig(fc.id)}
                        />
                        <label htmlFor={`field-${fc.id}`} className="text-sm cursor-pointer">
                          {fc.label} <span className="text-muted-foreground">({fc.name})</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role-title">Role / Title</Label>
              <Input
                id="role-title"
                placeholder="e.g., Supervisor, Senior Technician"
                value={formData.role_title}
                onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effective-from">Effective From</Label>
                <Input
                  id="effective-from"
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effective-to">Effective To</Label>
                <Input
                  id="effective-to"
                  type="date"
                  value={formData.effective_to}
                  onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave blank for no end date</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? "Saving..." : editingCard ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
