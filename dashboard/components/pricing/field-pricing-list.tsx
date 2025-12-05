"use client";

import { ConditionalRuleChips } from "@/components/pricing/conditional-rule-chips";
import {
  LocationOverridesMatrix,
  type LocationOverrideRow,
} from "@/components/pricing/location-overrides-matrix";
import {
  actionLabels,
  operatorLabels,
  serializeCondition,
} from "@/components/pricing/pricing-condition-helpers";
import { usePricingScope } from "@/components/pricing/pricing-scope-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { LoadingState } from "@/components/ui/loading-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useFieldPricing } from "@/hooks/use-field-pricing";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import {
  buildScopedPricingMap,
  getPricingScopeSource,
  isEntryForScope,
} from "@/lib/pricing-scope";
import type { FieldPricing, PricingCondition, PricingType } from "@/lib/types";
import { isPricingRulesEnabled } from "@/lib/utils";
import type { FieldConfig, FieldType } from "@clean-log/shared";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Save,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

// Field types that support pricing (only number and boolean - select and grouped_breakdown use option pricing)
const PRICING_SUPPORTED_TYPES: FieldType[] = ["number", "boolean"];

// Helper to get equation preview for field type
const getEquationPreview = (fieldType: FieldType): string => {
  switch (fieldType) {
    case "number":
      return "Total = price_per_unit × quantity";
    case "boolean":
      return "Total = base_price (when field is true)";
    default:
      return "";
  }
};

interface FieldPricingListProps {
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
  pricingContext?: "customer" | "worker"; // Defaults to 'customer'
}

export default function FieldPricingList({
  locationHierarchyId = null,
  locationId = null,
  effectiveAt = null,
  refreshToken,
  pricingContext = "customer",
}: FieldPricingListProps) {
  const { fieldConfigs, loading: configsLoading } = useFieldConfigs();
  const {
    fieldPricing,
    loading: pricingLoading,
    error: pricingError,
    upsertPricing,
    deletePricing,
  } = useFieldPricing({
    locationHierarchyId,
    locationId,
    effectiveAt,
    refreshToken,
    pricingContext,
  });
  const { setSelectedFieldId, expirationDate } = usePricingScope();
  const { formatCurrency } = useOrganizationCurrency();

  const [editingPrices, setEditingPrices] = useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {}
  );
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [ruleModalField, setRuleModalField] = useState<FieldConfig | null>(
    null
  );
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<ConditionalRuleForm>({
    conditionFieldId: "",
    operator: "greater_than",
    conditionValue: "",
    actionType: "add",
    actionValue: "",
  });

  // Filter to only field types that support pricing
  const pricingFieldConfigs = useMemo(() => {
    return fieldConfigs.filter((fc) =>
      PRICING_SUPPORTED_TYPES.includes(fc.field_type)
    );
  }, [fieldConfigs]);

  const scopeParams = useMemo(
    () => ({ locationId, locationHierarchyId }),
    [locationId, locationHierarchyId]
  );
  const scopeSource = getPricingScopeSource(scopeParams);

  const pricingMap = useMemo(() => {
    return buildScopedPricingMap(
      fieldPricing,
      scopeParams,
      (pricing) => pricing.field_config_id || null
    );
  }, [fieldPricing, scopeParams]);

  const fieldLabelLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    fieldConfigs.forEach((fc) => {
      lookup[fc.id] = fc.label;
    });
    return lookup;
  }, [fieldConfigs]);

  const handlePriceChange = (fieldConfigId: string, value: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [fieldConfigId]: value,
    }));
    setSelectedFieldId(fieldConfigId);
  };

  const handleSave = async (fieldConfig: FieldConfig) => {
    const priceValue = editingPrices[fieldConfig.id];
    if (!priceValue || priceValue.trim() === "") {
      return;
    }

    const customerPrice = parseFloat(priceValue);
    if (isNaN(customerPrice) || customerPrice < 0) {
      return;
    }

    setSaving((prev) => ({ ...prev, [fieldConfig.id]: true }));
    try {
      const pricingEntry = pricingMap[fieldConfig.id];
      await upsertPricing(fieldConfig.id, customerPrice, {
        appliesToFieldType: fieldConfig.field_type,
        pricingType: fieldConfig.field_type === "boolean" ? "fixed" : "unit",
        locationHierarchyId,
        locationId,
        conditions:
          pricingEntry?.record?.source_rule?.conditions?.map(
            serializeCondition
          ),
        expirationDate,
        pricingContext,
      });
      setEditingPrices((prev) => {
        const next = { ...prev };
        delete next[fieldConfig.id];
        return next;
      });
      setSelectedFieldId(fieldConfig.id);
    } catch (error) {
      console.error("Failed to save pricing", error);
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next[fieldConfig.id];
        return next;
      });
    }
  };

  const openConditionalModal = (field: FieldConfig) => {
    setRuleModalField(field);
    setRuleForm((prev) => ({
      ...prev,
      conditionFieldId: field.id,
    }));
    setRuleError(null);
    setSelectedFieldId(field.id);
  };

  const closeConditionalModal = () => {
    setRuleModalField(null);
    setRuleSaving(false);
    setRuleError(null);
    setRuleForm({
      conditionFieldId: "",
      operator: "greater_than",
      conditionValue: "",
      actionType: "add",
      actionValue: "",
    });
  };

  const handleConditionalRuleSave = async () => {
    if (!ruleModalField) return;

    const pricingEntry = pricingMap[ruleModalField.id];
    const existingPricing = pricingEntry?.record;
    if (!existingPricing) {
      setRuleError("Save a base price before adding rules.");
      return;
    }

    const actionValue = parseFloat(ruleForm.actionValue);
    if (isNaN(actionValue)) {
      setRuleError("Enter a valid adjustment amount.");
      return;
    }

    const existingConditions =
      existingPricing.source_rule.conditions?.map(serializeCondition) ?? [];

    const nextConditions = [
      ...existingConditions,
      {
        condition_field_config_id: ruleForm.conditionFieldId,
        operator: ruleForm.operator,
        condition_value: ruleForm.conditionValue,
        action_type: ruleForm.actionType,
        action_value: actionValue,
        metadata: { created_in_dashboard: true },
        priority: existingConditions.length + 1,
      },
    ];

    setRuleSaving(true);
    setRuleError(null);
    try {
      await upsertPricing(ruleModalField.id, existingPricing.customer_price, {
        appliesToFieldType: ruleModalField.field_type,
        pricingType: existingPricing.pricing_type as PricingType,
        locationHierarchyId,
        locationId,
        conditions: nextConditions,
        pricingContext,
      });
      closeConditionalModal();
    } catch (error) {
      console.error("Failed to add rule", error);
      setRuleError(
        error instanceof Error ? error.message : "Failed to add rule."
      );
    } finally {
      setRuleSaving(false);
    }
  };

  const getFieldTypeDescription = (fieldConfig: FieldConfig): string => {
    switch (fieldConfig.field_type) {
      case "number":
        return "Price per unit. Multiply by the quantity entered in the field.";
      case "boolean":
        return "Fixed price charged when this field is checked.";
      default:
        return "";
    }
  };

  const loading = configsLoading || pricingLoading;

  if (loading) {
    return <LoadingState message="Loading field pricing..." />;
  }

  if (pricingError) {
    return (
      <div className="text-center py-8 text-destructive">
        Error: {pricingError}
      </div>
    );
  }

  if (pricingFieldConfigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Fields Available for Pricing</CardTitle>
          <CardDescription>
            Create number or boolean field configurations in Mobile Application
            to set pricing. Select and grouped breakdown fields use option
            pricing instead.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {pricingFieldConfigs.map((fieldConfig) => {
          const pricingEntry = pricingMap[fieldConfig.id];
          const scopedPricing = pricingEntry?.record;
          const defaultPrice = scopedPricing?.customer_price ?? 0;
          const currentPrice =
            editingPrices[fieldConfig.id] !== undefined
              ? editingPrices[fieldConfig.id]
              : scopedPricing
              ? scopedPricing.customer_price.toString()
              : "";
          const hasChanges =
            editingPrices[fieldConfig.id] !== undefined &&
            editingPrices[fieldConfig.id] !==
              (scopedPricing?.customer_price.toString() || "");
          const isSaving = saving[fieldConfig.id] || false;
          const overrides = getLocationOverrides(
            fieldPricing,
            fieldConfig.id,
            locationId,
            locationHierarchyId
          );
          const conditions = scopedPricing?.source_rule?.conditions ?? [];
          const isExpanded = expandedCards[fieldConfig.id] ?? true;
          const hasScopedValue = isEntryForScope(pricingEntry, scopeSource);

          return (
            <Collapsible
              key={fieldConfig.id}
              open={isExpanded}
              onOpenChange={(open) =>
                setExpandedCards((prev) => ({
                  ...prev,
                  [fieldConfig.id]: open,
                }))
              }
            >
              <Card className="">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-base">
                          {fieldConfig.label}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground font-mono">
                          ({fieldConfig.field_type})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {scopedPricing ? (
                          <span className="text-sm font-medium text-primary">
                            {formatCurrency(scopedPricing.customer_price)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No price set
                          </span>
                        )}
                      </div>
                    </div>
                    {fieldConfig.description && (
                      <CardDescription className="ml-6">
                        {fieldConfig.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    <div className="bg-muted/50 rounded-md p-2 text-sm">
                      <span className="text-muted-foreground">Equation: </span>
                      <span className="font-mono font-medium">
                        {getEquationPreview(fieldConfig.field_type)}
                      </span>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[2fr_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label
                          htmlFor={`price-${fieldConfig.id}`}
                          className="text-sm"
                        >
                          Price per Unit
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id={`price-${fieldConfig.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={currentPrice}
                            onChange={(e) =>
                              handlePriceChange(fieldConfig.id, e.target.value)
                            }
                            className="pl-8"
                            disabled={isSaving}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {getFieldTypeDescription(fieldConfig)}
                        </p>
                      </div>
                      <FieldPricePreview
                        fieldType={fieldConfig.field_type}
                        price={parseFloat(currentPrice) || defaultPrice}
                        formatCurrency={formatCurrency}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(fieldConfig)}
                        disabled={
                          !hasChanges ||
                          !currentPrice ||
                          isNaN(parseFloat(currentPrice)) ||
                          parseFloat(currentPrice) < 0 ||
                          isSaving
                        }
                      >
                        {isSaving ? (
                          "Saving..."
                        ) : hasScopedValue ? (
                          "Update"
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </>
                        )}
                      </Button>
                      {isPricingRulesEnabled() && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!scopedPricing}
                                onClick={() =>
                                  openConditionalModal(fieldConfig)
                                }
                                className="gap-2"
                              >
                                <Sparkles className="h-4 w-4" />
                                Add rule
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>
                                Click to create if/then adjustments for this
                                price. Rules appear as chips below the price
                                input.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {overrides.length > 0 && (
                      <LocationOverridesMatrix
                        rows={overrides}
                        emptyMessage="No location overrides yet. Select a location in 'Where to Apply Pricing' above, then edit this field's price to create an override."
                        onDelete={async (id) => {
                          setDeletingIds((prev) => new Set(prev).add(id));
                          try {
                            await deletePricing(id);
                          } finally {
                            setDeletingIds((prev) => {
                              const next = new Set(prev);
                              next.delete(id);
                              return next;
                            });
                          }
                        }}
                        deletingIds={deletingIds}
                      />
                    )}

                    {isPricingRulesEnabled() && (
                      <ConditionalRuleChips
                        conditions={conditions}
                        fieldLabels={fieldLabelLookup}
                      />
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {isPricingRulesEnabled() && (
        <ConditionalRuleDialog
          field={ruleModalField}
          fieldOptions={fieldConfigs}
          open={Boolean(ruleModalField)}
          onClose={closeConditionalModal}
          form={ruleForm}
          setForm={setRuleForm}
          onSubmit={handleConditionalRuleSave}
          saving={ruleSaving}
          error={ruleError}
        />
      )}
    </>
  );
}

interface ConditionalRuleForm {
  conditionFieldId: string;
  operator: PricingCondition["operator"];
  conditionValue: string;
  actionType: PricingCondition["action_type"];
  actionValue: string;
}

function FieldPricePreview({
  fieldType,
  price,
  formatCurrency,
}: {
  fieldType: FieldType;
  price: number;
  formatCurrency: (value: number) => string;
}) {
  const quantity = fieldType === "number" ? 10 : 1;
  const total =
    fieldType === "number" ? Number(price) * quantity : Number(price);

  return (
    <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Quick preview</p>
      <p className="font-mono">
        {fieldType === "number"
          ? `${quantity} × ${formatCurrency(price)}`
          : `${formatCurrency(price)} when true`}
      </p>
      <p className="font-semibold text-foreground">
        {formatCurrency(isNaN(total) ? 0 : total)}
      </p>
    </div>
  );
}

function ConditionalRuleDialog({
  field,
  fieldOptions,
  open,
  onClose,
  form,
  setForm,
  onSubmit,
  saving,
  error,
}: {
  field: FieldConfig | null;
  fieldOptions: FieldConfig[];
  open: boolean;
  onClose: () => void;
  form: ConditionalRuleForm;
  setForm: Dispatch<SetStateAction<ConditionalRuleForm>>;
  onSubmit: () => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add conditional rule</DialogTitle>
          <DialogDescription>
            Apply adjustments when another field meets specific criteria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Trigger field</Label>
            <Select
              value={form.conditionFieldId || field?.id || ""}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, conditionFieldId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a field" />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((fc) => (
                  <SelectItem key={fc.id} value={fc.id}>
                    {fc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Operator</Label>
              <Select
                value={form.operator}
                onValueChange={(value: PricingCondition["operator"]) =>
                  setForm((prev) => ({ ...prev, operator: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose operator" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(operatorLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Compare value</Label>
              <Input
                value={form.conditionValue}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    conditionValue: e.target.value,
                  }))
                }
                placeholder="e.g. 5"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Adjustment</Label>
              <Select
                value={form.actionType}
                onValueChange={(value: PricingCondition["action_type"]) =>
                  setForm((prev) => ({ ...prev, actionType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose action" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Adjustment value</Label>
              <Input
                value={form.actionValue}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    actionValue: e.target.value,
                  }))
                }
                placeholder="e.g. 3"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getLocationOverrides(
  allPricing: FieldPricing[],
  fieldConfigId: string,
  currentLocationId: string | null = null,
  currentLocationHierarchyId: string | null = null
) {
  const now = new Date().toISOString();

  return allPricing
    .filter(
      (pricing) =>
        pricing.field_config_id === fieldConfigId &&
        (pricing.location_id || pricing.location_hierarchy_id) &&
        // Exclude current scope to avoid showing it as an override
        !(
          (currentLocationId && pricing.location_id === currentLocationId) ||
          (currentLocationHierarchyId &&
            pricing.location_hierarchy_id === currentLocationHierarchyId) ||
          (!currentLocationId &&
            !currentLocationHierarchyId &&
            !pricing.location_id &&
            !pricing.location_hierarchy_id)
        )
    )
    .map<LocationOverrideRow>((pricing) => {
      const effectiveAt = pricing.source_rule?.effective_at;
      const expiresAt = pricing.source_rule?.expires_at || null;
      const isActive = effectiveAt
        ? effectiveAt <= now && (!expiresAt || expiresAt > now)
        : undefined;
      const isFuture = effectiveAt ? effectiveAt > now : undefined;

      return {
        id: pricing.id,
        scopeLabel:
          pricing.location?.name ||
          pricing.location_node?.name ||
          pricing.location_id ||
          pricing.location_hierarchy_id ||
          "Custom scope",
        scopeType: pricing.location ? "location" : "hierarchy",
        price: pricing.customer_price,
        workerPayment: pricing.worker_payment_value,
        effectiveAt,
        expiresAt,
        isActive,
        isFuture,
      };
    });
}

// formatCurrency is now provided via useOrganizationCurrency hook
