"use client";

import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useJobs } from "@/hooks/use-jobs";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import type { CreateJobRequest } from "@/lib/types/api";
import type { ConditionalLogic, FieldConfig } from "@clean-log/shared/types";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface GroupedBreakdownItem {
  brand: string;
  quantity: number;
}

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Helper to evaluate conditional logic
function evaluateCondition(
  logic: ConditionalLogic | null,
  fieldValues: Record<string, unknown>,
  fieldConfigs: FieldConfig[]
): boolean {
  if (!logic || !logic.conditions || logic.conditions.length === 0) {
    return true; // No conditions = always visible
  }

  const { conditions, match_type = "all" } = logic;

  const results = conditions.map((condition) => {
    // Find the source field
    const sourceField = fieldConfigs.find((f) => f.id === condition.field_id);
    if (!sourceField) return true; // If field not found, show by default

    const sourceValue = fieldValues[sourceField.id];

    switch (condition.operator) {
      case "equals":
        return sourceValue === condition.value;
      case "not_equals":
        return sourceValue !== condition.value;
      case "is_empty":
        return (
          sourceValue === undefined ||
          sourceValue === null ||
          sourceValue === "" ||
          sourceValue === 0
        );
      case "is_not_empty":
        return (
          sourceValue !== undefined &&
          sourceValue !== null &&
          sourceValue !== "" &&
          sourceValue !== 0
        );
      case "contains":
        return String(sourceValue || "").includes(String(condition.value));
      case "greater_than":
        return Number(sourceValue) > Number(condition.value);
      case "less_than":
        return Number(sourceValue) < Number(condition.value);
      default:
        return true;
    }
  });

  return match_type === "all" ? results.every(Boolean) : results.some(Boolean);
}

// Grouped Breakdown Field Component
interface GroupedBreakdownFieldProps {
  field: FieldConfig;
  value: GroupedBreakdownItem[];
  onChange: (items: GroupedBreakdownItem[]) => void;
  error?: string;
}

function GroupedBreakdownField({
  field,
  value = [],
  onChange,
  error,
}: GroupedBreakdownFieldProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [quantity, setQuantity] = useState("");

  const options = field.options || [];
  const validationRules = field.validation_rules;
  const maxItems = validationRules?.max_items ?? options.length;
  const minItems = validationRules?.min_items ?? 0;
  const allowZeroQuantities = validationRules?.allow_zero_quantities ?? false;

  // Get available brands (not already selected)
  const availableBrands = options.filter(
    (option) => !value.some((item) => item.brand === option)
  );

  const handleAddItem = () => {
    if (!selectedBrand || !quantity) return;

    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 0) return;
    if (!allowZeroQuantities && quantityNum === 0) return;

    // Check if we've reached max items
    if (value.length >= maxItems) return;

    const newItems = [
      ...value,
      { brand: selectedBrand, quantity: quantityNum },
    ];
    onChange(newItems);
    setSelectedBrand("");
    setQuantity("");
    setIsAddDialogOpen(false);
  };

  const handleRemoveItem = (brand: string) => {
    onChange(value.filter((item) => item.brand !== brand));
  };

  const handleUpdateQuantity = (brand: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    if (!allowZeroQuantities && newQuantity === 0) {
      // Remove item instead of setting to 0
      handleRemoveItem(brand);
      return;
    }

    onChange(
      value.map((item) =>
        item.brand === brand ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const canAddMore = value.length < maxItems && availableBrands.length > 0;

  return (
    <div className="space-y-3">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>

      {/* Display added items */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item) => (
            <div
              key={item.brand}
              className="flex items-center justify-between gap-3 border rounded-md p-3 bg-muted/50"
            >
              <span className="font-medium flex-1">{item.brand}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={String(item.quantity)}
                  onChange={(e) => {
                    const num =
                      e.target.value === ""
                        ? 0
                        : parseInt(e.target.value, 10) || 0;
                    handleUpdateQuantity(item.brand, num);
                  }}
                  className="w-20 text-center"
                  min="0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(item.brand)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Entry button */}
      {canAddMore && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsAddDialogOpen(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      )}

      {/* Validation messages */}
      {value.length < minItems && (
        <p className="text-sm text-orange-500">
          At least {minItems} item(s) required
        </p>
      )}
      {value.length >= maxItems && (
        <p className="text-sm text-muted-foreground">
          Maximum {maxItems} item(s) reached
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {field.description && !error && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {field.label}</DialogTitle>
            <DialogDescription>
              Select a brand and enter the quantity
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Option Select */}
            <div className="space-y-2">
              <Label htmlFor="add-brand">Option</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger id="add-brand">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {availableBrands.map((brand: string) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity Input */}
            <div className="space-y-2">
              <Label htmlFor="add-quantity">Quantity</Label>
              <Input
                id="add-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                min="0"
              />
              {!allowZeroQuantities && (
                <p className="text-xs text-muted-foreground">
                  Zero quantities are not allowed
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setSelectedBrand("");
                setQuantity("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={
                !selectedBrand ||
                !quantity ||
                parseInt(quantity, 10) < 0 ||
                (!allowZeroQuantities && parseInt(quantity, 10) === 0)
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CreateJobDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateJobDialogProps) {
  const { organizationId } = useOrganization();
  const { settings } = useOrganizationSettings();
  const { fieldConfigs } = useFieldConfigs();
  const { locations } = useLocations();
  const { workers } = useWorkers();
  const { createJob } = useJobs();

  const [locationId, setLocationId] = useState<string>("");
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [startDateTime, setStartDateTime] = useState<string>("");
  const [finishDateTime, setFinishDateTime] = useState<string>(
    new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm format
  );
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Track selected clusters for mutual exclusion groups
  const [selectedClusters, setSelectedClusters] = useState<
    Record<string, string | null>
  >({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setLocationId("");
      setSelectedWorkerIds([]);
      setStartDateTime("");
      setFinishDateTime(new Date().toISOString().slice(0, 16));
      setFieldValues({});
      setErrors({});
      setSelectedClusters({});
    }
  }, [open]);

  // Check if location is required
  const locationRequired = settings?.use_predefined_locations ?? true;

  // Filter active field configs
  const activeFieldConfigs = useMemo(
    () => fieldConfigs.filter((fc) => fc.active && !fc.archived_at),
    [fieldConfigs]
  );

  // Check if a field should be visible based on conditional logic
  const isFieldVisible = useCallback(
    (field: FieldConfig): boolean => {
      return evaluateCondition(
        field.conditional_logic,
        fieldValues,
        activeFieldConfigs
      );
    },
    [fieldValues, activeFieldConfigs]
  );

  // Get visible fields
  const visibleFields = useMemo(
    () => activeFieldConfigs.filter(isFieldVisible),
    [activeFieldConfigs, isFieldVisible]
  );

  // Helper: Get cluster identifier for a field
  const getFieldCluster = useCallback((field: FieldConfig): string | null => {
    return field.group_cluster || null;
  }, []);

  // Group fields by mutually exclusive groups
  const groupedFields = useMemo(() => {
    const groups = new Map<string, FieldConfig[]>();
    const regularFields: FieldConfig[] = [];

    visibleFields.forEach((field) => {
      if (field.mutually_exclusive_group) {
        const groupId = field.mutually_exclusive_group;
        if (!groups.has(groupId)) {
          groups.set(groupId, []);
        }
        groups.get(groupId)!.push(field);
      } else {
        regularFields.push(field);
      }
    });

    return { groups, regularFields };
  }, [visibleFields]);

  // Get unique clusters for each mutual exclusion group
  const getClustersForGroup = useCallback(
    (groupId: string): string[] => {
      const fields = groupedFields.groups.get(groupId) || [];
      const clusters = new Set<string>();
      fields.forEach((field) => {
        const cluster = getFieldCluster(field);
        if (cluster) {
          clusters.add(cluster);
        }
      });
      return Array.from(clusters).sort();
    },
    [groupedFields.groups, getFieldCluster]
  );

  // Format cluster name from snake_case to Title Case
  const formatClusterName = useCallback((clusterId: string): string => {
    return clusterId
      .split("_")
      .map(
        (word: string) =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(" ");
  }, []);

  // Update field value
  const updateFieldValue = useCallback(
    (fieldId: string, value: unknown) => {
      setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
      // Clear error for this field
      if (errors[fieldId]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      }
    },
    [errors]
  );

  // Handle cluster selection
  const handleClusterSelect = useCallback(
    (groupId: string, clusterId: string | null) => {
      setSelectedClusters((prev) => ({
        ...prev,
        [groupId]: clusterId,
      }));

      // Clear values from other clusters in the same group
      const fields = groupedFields.groups.get(groupId) || [];
      fields.forEach((field) => {
        const fieldCluster = getFieldCluster(field);
        if (fieldCluster !== clusterId) {
          // Clear the field value based on its type
          if (field.field_type === "boolean") {
            updateFieldValue(field.id, false);
          } else if (field.field_type === "number") {
            updateFieldValue(field.id, 0);
          } else if (field.field_type === "grouped_breakdown") {
            updateFieldValue(field.id, []);
          } else {
            updateFieldValue(field.id, "");
          }
        }
      });
    },
    [groupedFields.groups, getFieldCluster, updateFieldValue]
  );

  // Get fields to render (only from selected clusters)
  const fieldsToRender = useMemo(() => {
    const fields: FieldConfig[] = [];

    // Add regular fields (not in mutually exclusive groups)
    fields.push(...groupedFields.regularFields);

    // Add fields from selected clusters
    groupedFields.groups.forEach((groupFields, groupId) => {
      const selectedCluster = selectedClusters[groupId];
      if (selectedCluster) {
        const clusterFields = groupFields.filter(
          (field) => getFieldCluster(field) === selectedCluster
        );
        fields.push(...clusterFields);
      }
    });

    return fields;
  }, [groupedFields, selectedClusters, getFieldCluster]);

  // Toggle worker selection
  const toggleWorker = useCallback((workerId: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
  }, []);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate location if required
    if (locationRequired && !locationId) {
      newErrors.location = "Location is required";
    }

    // Validate at least one worker
    if (selectedWorkerIds.length === 0) {
      newErrors.workers = "At least one worker is required";
    }

    // Validate required fields (only from fields to render)
    fieldsToRender.forEach((field) => {
      if (field.required) {
        const value = fieldValues[field.id];
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        ) {
          newErrors[field.id] = `${field.label} is required`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    locationRequired,
    locationId,
    selectedWorkerIds,
    fieldsToRender,
    fieldValues,
  ]);

  // Build submission data
  const buildSubmissionData = useCallback((): Record<string, unknown> => {
    const submissionData: Record<string, unknown> = {};

    fieldsToRender.forEach((config) => {
      const value = fieldValues[config.id];
      if (config.field_type === "grouped_breakdown") {
        // Ensure grouped_breakdown is always an array
        submissionData[config.name] = Array.isArray(value) ? value : [];
      } else if (config.field_type === "time") {
        // Ensure time is always a string in HH:mm format
        if (typeof value === "string" && value !== "") {
          submissionData[config.name] = value;
        } else {
          // If no value, use current time
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, "0");
          const minutes = now.getMinutes().toString().padStart(2, "0");
          submissionData[config.name] = `${hours}:${minutes}`;
        }
      } else {
        submissionData[config.name] = value ?? (config.required ? null : "");
      }
    });

    // Add start_time if provided (store as ISO datetime string)
    if (startDateTime && startDateTime.trim() !== "") {
      // Convert datetime-local format to ISO string
      const startDate = new Date(startDateTime);
      if (!isNaN(startDate.getTime())) {
        submissionData.start_time = startDate.toISOString();
      }
    }

    // Add finish_time if provided (store as ISO datetime string)
    if (finishDateTime && finishDateTime.trim() !== "") {
      // Convert datetime-local format to ISO string
      const finishDate = new Date(finishDateTime);
      if (!isNaN(finishDate.getTime())) {
        submissionData.finish_time = finishDate.toISOString();
      }
    }

    return submissionData;
  }, [fieldsToRender, fieldValues, startDateTime, finishDateTime]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!organizationId) {
      setErrors({ general: "Organization ID is required" });
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionData = buildSubmissionData();

      // Use finishDateTime for completed_at, or current time if not provided
      const completedAtDate = finishDateTime
        ? new Date(finishDateTime)
        : new Date();

      const request: CreateJobRequest = {
        organization_id: organizationId,
        location_id: locationId || null,
        worker_ids: selectedWorkerIds,
        submission_data: submissionData,
        completed_at: completedAtDate.toISOString(),
      };

      log.debug("CreateJobDialog: Submitting job", {
        organizationId,
        locationId,
        workerIdsCount: selectedWorkerIds.length,
        fieldCount: Object.keys(submissionData).length,
      });

      await createJob(request);

      log.info("CreateJobDialog: Job created successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      log.error("CreateJobDialog: Failed to create job", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrors({
        general: err instanceof Error ? err.message : "Failed to create job",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    organizationId,
    locationId,
    selectedWorkerIds,
    finishDateTime,
    validate,
    buildSubmissionData,
    createJob,
    onOpenChange,
    onSuccess,
  ]);

  // Render field input based on field type
  const renderField = (field: FieldConfig) => {
    const value = fieldValues[field.id];
    const error = errors[field.id];

    switch (field.field_type) {
      case "text":
      case "email":
      case "phone":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id={field.id}
              type={field.field_type === "email" ? "email" : "text"}
              value={String(value || "")}
              onChange={(e) => updateFieldValue(field.id, e.target.value)}
              placeholder={field.description || field.label}
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {field.description && !error && (
              <p className="text-xs text-muted-foreground">
                {field.description}
              </p>
            )}
          </div>
        );

      case "number":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id={field.id}
              type="number"
              value={String(value || "0")}
              onChange={(e) =>
                updateFieldValue(
                  field.id,
                  e.target.value === "" ? 0 : Number(e.target.value) || 0
                )
              }
              placeholder={field.description || field.label}
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {field.description && !error && (
              <p className="text-xs text-muted-foreground">
                {field.description}
              </p>
            )}
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              id={field.id}
              value={String(value || "")}
              onChange={(e) => updateFieldValue(field.id, e.target.value)}
              placeholder={field.description || field.label}
              rows={4}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {field.description && !error && (
              <p className="text-xs text-muted-foreground">
                {field.description}
              </p>
            )}
          </div>
        );

      case "select":
        if (!field.options || field.options.length === 0) {
          return (
            <div key={field.id} className="space-y-2">
              <Label>{field.label}</Label>
              <p className="text-sm text-destructive">
                No options configured for {field.label}
              </p>
            </div>
          );
        }
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            <Select
              value={String(value || "")}
              onValueChange={(val) => updateFieldValue(field.id, val)}
            >
              <SelectTrigger id={field.id}>
                <SelectValue placeholder={`Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {field.description && !error && (
              <p className="text-xs text-muted-foreground">
                {field.description}
              </p>
            )}
          </div>
        );

      case "boolean":
        return (
          <div
            key={field.id}
            className="flex items-center justify-between space-x-2"
          >
            <div className="space-y-0.5">
              <Label htmlFor={field.id}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              {field.description && (
                <p className="text-xs text-muted-foreground">
                  {field.description}
                </p>
              )}
            </div>
            <Switch
              id={field.id}
              checked={Boolean(value)}
              onCheckedChange={(checked) => updateFieldValue(field.id, checked)}
            />
            {error && (
              <p className="text-sm text-destructive absolute bottom-0 left-0">
                {error}
              </p>
            )}
          </div>
        );

      case "date":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id={field.id}
              type="date"
              value={
                value && typeof value === "string" ? value.split("T")[0] : ""
              }
              onChange={(e) => updateFieldValue(field.id, e.target.value)}
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {field.description && !error && (
              <p className="text-xs text-muted-foreground">
                {field.description}
              </p>
            )}
          </div>
        );

      case "time":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id={field.id}
              type="time"
              value={
                value && typeof value === "string"
                  ? value.includes(":")
                    ? value
                    : ""
                  : ""
              }
              onChange={(e) => updateFieldValue(field.id, e.target.value)}
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {field.description && !error && (
              <p className="text-xs text-muted-foreground">
                {field.description}
              </p>
            )}
          </div>
        );

      case "grouped_breakdown":
        return (
          <GroupedBreakdownField
            key={field.id}
            field={field}
            value={(fieldValues[field.id] as GroupedBreakdownItem[]) || []}
            onChange={(items) => updateFieldValue(field.id, items)}
            error={error}
          />
        );

      default:
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.label}</Label>
            <p className="text-sm text-destructive">
              Unsupported field type: {field.field_type}
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Completed Job</DialogTitle>
          <DialogDescription>
            Manually create a completed job for testing or sanity checking
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {errors.general && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.general}
            </div>
          )}

          {/* Location Selector */}
          <div className="space-y-2">
            <Label htmlFor="location">
              Location
              {locationRequired && <span className="text-destructive"> *</span>}
            </Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="location">
                <SelectValue
                  placeholder={
                    locationRequired
                      ? "Select a location"
                      : "Select a location (optional)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locations
                  .filter((loc) => loc.active)
                  .map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.location && (
              <p className="text-sm text-destructive">{errors.location}</p>
            )}
          </div>

          {/* Worker Multi-Select */}
          <div className="space-y-2">
            <Label>
              Workers <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {workers
                .filter((worker) => worker.active)
                .map((worker) => (
                  <div key={worker.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`worker-${worker.id}`}
                      checked={selectedWorkerIds.includes(worker.id)}
                      onChange={() => toggleWorker(worker.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label
                      htmlFor={`worker-${worker.id}`}
                      className="font-normal cursor-pointer"
                    >
                      {worker.name}
                    </Label>
                  </div>
                ))}
            </div>
            {errors.workers && (
              <p className="text-sm text-destructive">{errors.workers}</p>
            )}
          </div>

          {/* Start DateTime */}
          <div className="space-y-2">
            <Label htmlFor="start_datetime">Start Date & Time</Label>
            <Input
              id="start_datetime"
              type="datetime-local"
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional: The date and time when the job started. Useful for
              backdating jobs created later.
            </p>
          </div>

          {/* Finish DateTime */}
          <div className="space-y-2">
            <Label htmlFor="finish_datetime">Finish Date & Time</Label>
            <Input
              id="finish_datetime"
              type="datetime-local"
              value={finishDateTime}
              onChange={(e) => setFinishDateTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The date and time when the job was completed. This also sets the
              job&apos;s completed_at timestamp.
            </p>
          </div>

          {/* Dynamic Fields */}
          {(groupedFields.groups.size > 0 ||
            groupedFields.regularFields.length > 0) && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Job Data</h3>

              {/* Render mutual exclusion groups with select dropdowns */}
              {Array.from(groupedFields.groups.keys()).map((groupId) => {
                const fields = groupedFields.groups.get(groupId) || [];
                const clusters = getClustersForGroup(groupId);
                const selectedCluster = selectedClusters[groupId] || null;

                // Use custom label for default_exclusive_group if available
                const firstField = fields[0];
                const isDefaultGroup = groupId === "default_exclusive_group";
                const groupLabel =
                  isDefaultGroup && settings?.default_exclusive_group_label
                    ? settings.default_exclusive_group_label
                    : firstField.mutually_exclusive_group
                        ?.split("_")
                        .map(
                          (word: string) =>
                            word.charAt(0).toUpperCase() +
                            word.slice(1).toLowerCase()
                        )
                        .join(" ") || "Select Option";

                return (
                  <div key={groupId} className="space-y-2">
                    <Label htmlFor={`group-${groupId}`}>{groupLabel}</Label>
                    <Select
                      value={selectedCluster || ""}
                      onValueChange={(value) =>
                        handleClusterSelect(groupId, value || null)
                      }
                    >
                      <SelectTrigger id={`group-${groupId}`}>
                        <SelectValue placeholder={`Select ${groupLabel}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {clusters.map((clusterId) => (
                          <SelectItem key={clusterId} value={clusterId}>
                            {formatClusterName(clusterId)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Render fields only for the selected cluster */}
                    {selectedCluster &&
                      fields
                        .filter(
                          (field) => getFieldCluster(field) === selectedCluster
                        )
                        .map((field) => renderField(field))}
                  </div>
                );
              })}

              {/* Render regular fields (not in mutual exclusion groups) */}
              {groupedFields.regularFields.map((field) => renderField(field))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
