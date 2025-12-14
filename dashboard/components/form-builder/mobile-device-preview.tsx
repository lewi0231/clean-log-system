"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useWorkers } from "@/hooks/use-workers";
import { FieldConfig, FormSectionWithFields } from "@clean-log/shared";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Smartphone,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface MobileDevicePreviewProps {
  fields: FieldConfig[];
  sections: FormSectionWithFields[];
  formTitle?: string;
  formDescription?: string;
  // Mock values to test conditional logic
  mockValues?: Record<string, string | number | boolean>;
}

interface GroupedBreakdownItem {
  brand: string;
  quantity: number;
}

// Helper functions from mobile app
function getFieldCluster(field: FieldConfig): string | null {
  return field.group_cluster || null;
}

function hasValue(value: unknown, fieldType: string): boolean {
  if (value === null || value === undefined) return false;

  switch (fieldType) {
    case "boolean":
      return value === true;
    case "number":
      return typeof value === "number" && value > 0;
    case "grouped_breakdown":
      return Array.isArray(value) && value.length > 0;
    case "text":
    case "textarea":
    case "email":
    case "phone":
      return typeof value === "string" && value.trim().length > 0;
    case "date":
    case "time":
    case "select":
      return typeof value === "string" && value.length > 0;
    default:
      return false;
  }
}

function formatClusterName(clusterId: string): string {
  return clusterId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function MobileDevicePreview({
  fields,
  sections,
  formTitle = "New Entry",
  formDescription = "Fill out the form below",
  mockValues = {},
}: MobileDevicePreviewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { workers } = useWorkers();
  const { locations } = useLocations();
  const { settings } = useOrganizationSettings();

  // Interactive state
  const [selectedColleagues, setSelectedColleagues] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [startTime, setStartTime] = useState<Date | undefined>(() => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    return now;
  });
  const [finishTime, setFinishTime] = useState<Date>(() => new Date());
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | number | boolean | GroupedBreakdownItem[]>
  >({});
  const [selectedClusters, setSelectedClusters] = useState<
    Record<string, string | null>
  >({});
  // State for grouped breakdown fields (selectedBrand and quantity for each field)
  const [groupedBreakdownState, setGroupedBreakdownState] = useState<
    Record<string, { selectedBrand: string; quantity: string }>
  >({});

  // Organize fields by section
  const organizedFields = useMemo(() => {
    const sectionMap = new Map<string | null, FieldConfig[]>();
    sectionMap.set(null, []);

    fields.forEach((field) => {
      const sectionId = field.section_id;
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, []);
      }
      sectionMap.get(sectionId)!.push(field);
    });

    return sectionMap;
  }, [fields]);

  // Check if a field should be visible based on conditional logic
  const isFieldVisible = useCallback(
    (field: FieldConfig): boolean => {
      if (!field.conditional_logic) return true;

      const { conditions, match_type = "all" } = field.conditional_logic;

      const results = conditions.map((condition) => {
        // Check both mockValues and fieldValues
        const sourceValue =
          mockValues[condition.field_id] ?? fieldValues[condition.field_id];

        switch (condition.operator) {
          case "equals":
            return sourceValue === condition.value;
          case "not_equals":
            return sourceValue !== condition.value;
          case "is_empty":
            return (
              sourceValue === undefined ||
              sourceValue === null ||
              sourceValue === ""
            );
          case "is_not_empty":
            return (
              sourceValue !== undefined &&
              sourceValue !== null &&
              sourceValue !== ""
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

      return match_type === "all"
        ? results.every(Boolean)
        : results.some(Boolean);
    },
    [mockValues, fieldValues]
  );

  // Calculate steps: Step 0 = Basic Info, Step 1+ = Sections, Final = Summary
  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => a.order_position - b.order_position);
  }, [sections]);

  const visibleSections = useMemo(() => {
    return sortedSections.filter((section) => {
      const sectionFields = organizedFields.get(section.id) || [];
      return sectionFields.filter(isFieldVisible).length > 0;
    });
  }, [sortedSections, organizedFields, isFieldVisible]);

  const totalSteps = useMemo(() => {
    let steps = 1; // Step 0: Basic info
    steps += visibleSections.length; // One step per visible section
    steps += 1; // Final step: Summary
    return steps;
  }, [visibleSections.length]);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  // Get current section for current step
  const getCurrentSection = (): FormSectionWithFields | null => {
    if (currentStep === 0) return null;
    const sectionIndex = currentStep - 1;
    if (sectionIndex < visibleSections.length) {
      return visibleSections[sectionIndex];
    }
    return null;
  };

  const currentSection = getCurrentSection();
  const isLastStep = currentStep === totalSteps - 1;
  const progressPercentage = Math.round(((currentStep + 1) / totalSteps) * 100);

  // Update field value
  const updateFieldValue = (
    fieldId: string,
    value: string | number | boolean | GroupedBreakdownItem[]
  ) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  // Handle cluster selection for mutual exclusion groups
  const handleClusterSelect = (
    groupId: string,
    clusterId: string | null,
    sectionFields: FieldConfig[]
  ) => {
    setSelectedClusters((prev) => ({
      ...prev,
      [groupId]: clusterId,
    }));

    // Clear values from other clusters in the same group
    const groupFields = sectionFields.filter(
      (f) => f.mutually_exclusive_group === groupId
    );
    groupFields.forEach((field) => {
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
  };

  // Render grouped breakdown field (matching mobile app)
  const renderGroupedBreakdown = (field: FieldConfig) => {
    const value = (fieldValues[field.id] as GroupedBreakdownItem[]) || [];
    const options = field.options || [];
    const validationRules = field.validation_rules;
    const maxItems = validationRules?.max_items ?? options.length;
    const allowZeroQuantities = validationRules?.allow_zero_quantities ?? false;

    // Get available brands (not already selected)
    const availableBrands = options.filter(
      (option) => !value.some((item) => item.brand === option)
    );

    const fieldState = groupedBreakdownState[field.id] || {
      selectedBrand: "",
      quantity: "",
    };
    const selectedBrand = fieldState.selectedBrand || "";
    const quantity = fieldState.quantity || "";

    const setSelectedBrand = (brand: string) => {
      setGroupedBreakdownState((prev) => ({
        ...prev,
        [field.id]: { ...prev[field.id], selectedBrand: brand },
      }));
    };

    const setQuantity = (qty: string) => {
      setGroupedBreakdownState((prev) => ({
        ...prev,
        [field.id]: {
          ...(prev[field.id] || { selectedBrand: "" }),
          quantity: qty,
        },
      }));
    };

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
      updateFieldValue(field.id, newItems);
      setGroupedBreakdownState((prev) => ({
        ...prev,
        [field.id]: { selectedBrand: "", quantity: "" },
      }));
    };

    const handleRemoveItem = (brand: string) => {
      updateFieldValue(
        field.id,
        value.filter((item) => item.brand !== brand)
      );
    };

    const handleUpdateQuantity = (brand: string, newQuantity: number) => {
      if (newQuantity < 0) return;
      if (!allowZeroQuantities && newQuantity === 0) {
        handleRemoveItem(brand);
        return;
      }

      updateFieldValue(
        field.id,
        value.map((item) =>
          item.brand === brand ? { ...item, quantity: newQuantity } : item
        )
      );
    };

    const canAddMore = value.length < maxItems && availableBrands.length > 0;

    return (
      <div className="space-y-3">
        {/* Display added items */}
        {value.length > 0 && (
          <div className="space-y-2">
            {value.map((item) => (
              <div
                key={item.brand}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-900 flex-1">
                  {item.brand}
                </span>
                <div className="flex items-center gap-3">
                  {/* Quantity input */}
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const num =
                        e.target.value === ""
                          ? 0
                          : parseInt(e.target.value, 10) || 0;
                      handleUpdateQuantity(item.brand, num);
                    }}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center text-sm text-gray-900 min-w-[60px] w-16"
                    min="0"
                  />
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.brand)}
                    className="ml-2 p-1 hover:opacity-70"
                  >
                    <X className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Brand section */}
        {canAddMore && (
          <div className="space-y-2 border-2 border-dashed border-gray-300 rounded-xl p-4">
            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Brand
              </label>
              <Select
                value={selectedBrand || undefined}
                onValueChange={setSelectedBrand}
              >
                <SelectTrigger className="rounded-xl h-12 bg-white border border-gray-200">
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {availableBrands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Quantity
              </label>
              <input
                type="number"
                value={quantity || ""}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
              {!allowZeroQuantities && (
                <p className="text-xs text-gray-500 mt-1">
                  Zero quantities are not allowed
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleAddItem}
              disabled={
                !selectedBrand ||
                !quantity ||
                parseInt(quantity, 10) < 0 ||
                (!allowZeroQuantities && parseInt(quantity, 10) === 0)
              }
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </div>
        )}

        {/* Validation messages */}
        {validationRules?.min_items &&
          value.length < validationRules.min_items && (
            <p className="text-sm text-orange-500">
              At least {validationRules.min_items} item(s) required
            </p>
          )}
        {value.length >= maxItems && (
          <p className="text-sm text-gray-500">
            Maximum {maxItems} item(s) reached
          </p>
        )}
      </div>
    );
  };

  // Render field preview
  const renderFieldPreview = (field: FieldConfig) => {
    const baseClasses =
      "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    if (!isFieldVisible(field)) {
      return null;
    }

    const value = fieldValues[field.id] ?? "";

    switch (field.field_type) {
      case "textarea":
        return (
          <textarea
            value={String(value)}
            onChange={(e) => updateFieldValue(field.id, e.target.value)}
            placeholder={field.description || `Enter ${field.label}`}
            className={`${baseClasses} min-h-[80px] resize-none`}
          />
        );
      case "select":
        return (
          <select
            value={String(value)}
            onChange={(e) => updateFieldValue(field.id, e.target.value)}
            className={`${baseClasses} appearance-none`}
          >
            <option value="">
              {field.description || `Select ${field.label.toLowerCase()}`}
            </option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "boolean":
        const boolValue = Boolean(value);
        return (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-gray-900">
              {field.label}
            </span>
            <button
              type="button"
              onClick={() => updateFieldValue(field.id, !boolValue)}
              className={`w-11 h-6 rounded-full relative transition-colors ${
                boolValue ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  boolValue ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        );
      case "grouped_breakdown":
        return renderGroupedBreakdown(field);
      case "date":
        return (
          <input
            type="date"
            value={String(value)}
            onChange={(e) => updateFieldValue(field.id, e.target.value)}
            className={baseClasses}
          />
        );
      case "time":
        return (
          <input
            type="time"
            value={String(value)}
            onChange={(e) => updateFieldValue(field.id, e.target.value)}
            className={baseClasses}
          />
        );
      default:
        return (
          <input
            type={field.field_type}
            value={String(value)}
            onChange={(e) => updateFieldValue(field.id, e.target.value)}
            placeholder={field.description || `Enter ${field.label}`}
            className={baseClasses}
          />
        );
    }
  };

  const renderField = (field: FieldConfig) => {
    if (!isFieldVisible(field)) {
      return null;
    }

    const isBoolean = field.field_type === "boolean";

    return (
      <div key={field.id} className="space-y-1.5">
        {!isBoolean && (
          <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
            {field.conditional_logic && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 h-4 ml-1"
              >
                conditional
              </Badge>
            )}
          </label>
        )}
        {renderFieldPreview(field)}
      </div>
    );
  };

  // Render Step 0: Basic Info
  const renderBasicInfoStep = () => {
    const filteredWorkers = workers.filter((w) => w.active);

    return (
      <div className="space-y-4">
        {/* Colleague Select */}
        {filteredWorkers.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">
              Who worked on this job?
            </label>
            <Select
              value={undefined}
              onValueChange={(workerId) => {
                if (!selectedColleagues.includes(workerId)) {
                  setSelectedColleagues([...selectedColleagues, workerId]);
                }
              }}
            >
              <SelectTrigger className="rounded-xl h-12 bg-white border border-gray-200">
                <SelectValue placeholder="Add a colleague" />
              </SelectTrigger>
              <SelectContent>
                {filteredWorkers
                  .filter((w) => !selectedColleagues.includes(w.id))
                  .map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedColleagues.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedColleagues.map((workerId) => {
                  const worker = workers.find((w) => w.id === workerId);
                  if (!worker) return null;
                  return (
                    <Badge
                      key={workerId}
                      variant="secondary"
                      className="flex items-center gap-1.5 px-3 py-1.5"
                    >
                      <span className="text-sm font-medium">{worker.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedColleagues(
                            selectedColleagues.filter((id) => id !== workerId)
                          )
                        }
                        className="ml-1 hover:opacity-70"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Location Select */}
        {locations.length > 0 && settings?.use_predefined_locations && (
          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">
              Where did you work?
              <span className="text-red-500 ml-1">*</span>
            </label>
            <Select
              value={selectedLocation || undefined}
              onValueChange={(value) => setSelectedLocation(value)}
            >
              <SelectTrigger className="rounded-xl h-12 bg-white border border-gray-200">
                <SelectValue placeholder="Choose work location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Start Time */}
        <div>
          <label className="text-sm font-medium text-gray-900 mb-2 block">
            What time did you start?
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="rounded-xl h-12 bg-white border border-gray-200 flex items-center justify-between px-4">
            <input
              type="time"
              value={
                startTime
                  ? `${startTime
                      .getHours()
                      .toString()
                      .padStart(2, "0")}:${startTime
                      .getMinutes()
                      .toString()
                      .padStart(2, "0")}`
                  : ""
              }
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(":");
                if (hours && minutes) {
                  const newTime = new Date();
                  newTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                  setStartTime(newTime);
                }
              }}
              className="bg-transparent border-0 text-sm text-gray-900 focus:outline-none"
            />
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Finish Time */}
        <div>
          <label className="text-sm font-medium text-gray-900 mb-2 block">
            What time did you finish?
          </label>
          <div className="rounded-xl h-12 bg-white border border-gray-200 flex items-center justify-between px-4">
            <input
              type="time"
              value={`${finishTime
                .getHours()
                .toString()
                .padStart(2, "0")}:${finishTime
                .getMinutes()
                .toString()
                .padStart(2, "0")}`}
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(":");
                if (hours && minutes) {
                  const newTime = new Date();
                  newTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                  setFinishTime(newTime);
                }
              }}
              className="bg-transparent border-0 text-sm text-gray-900 focus:outline-none"
            />
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  };

  // Render Section Step
  const renderSectionStep = (section: FormSectionWithFields) => {
    const sectionFields = organizedFields.get(section.id) || [];
    const visibleFields = sectionFields.filter(isFieldVisible);

    // Group fields by mutual exclusion groups
    const regularFields: FieldConfig[] = [];
    const groupedFields = new Map<string, FieldConfig[]>();

    visibleFields.forEach((field) => {
      if (field.mutually_exclusive_group) {
        const groupId = field.mutually_exclusive_group;
        if (!groupedFields.has(groupId)) {
          groupedFields.set(groupId, []);
        }
        groupedFields.get(groupId)!.push(field);
      } else {
        regularFields.push(field);
      }
    });

    // Get unique clusters for each mutual exclusion group
    const getClustersForGroup = (groupId: string): string[] => {
      const fields = groupedFields.get(groupId) || [];
      const clusters = new Set<string>();
      fields.forEach((field) => {
        const cluster = getFieldCluster(field);
        if (cluster) {
          clusters.add(cluster);
        }
      });
      return Array.from(clusters).sort();
    };

    return (
      <div className="space-y-4">
        <div className="mb-2">
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {section.title}
          </h3>
          {section.description && (
            <p className="text-sm text-gray-500">{section.description}</p>
          )}
        </div>

        {/* Render mutual exclusion groups with select dropdowns */}
        {Array.from(groupedFields.keys()).map((groupId) => {
          const fields = groupedFields.get(groupId) || [];
          const clusters = getClustersForGroup(groupId);
          const selectedCluster = selectedClusters[groupId] || null;

          const firstField = fields[0];
          const isDefaultGroup = groupId === "default_exclusive_group";
          const groupLabel =
            isDefaultGroup && settings?.default_exclusive_group_label
              ? settings.default_exclusive_group_label
              : firstField.mutually_exclusive_group
                  ?.split("_")
                  .map(
                    (word) =>
                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join(" ") || "Select Option";

          return (
            <div key={groupId} className="mb-4">
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                {groupLabel}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Select
                value={selectedCluster || undefined}
                onValueChange={(value) => {
                  handleClusterSelect(groupId, value || null, sectionFields);
                }}
              >
                <SelectTrigger className="rounded-xl h-12 bg-white border border-gray-200">
                  <SelectValue
                    placeholder={`Choose ${groupLabel.toLowerCase()}`}
                  />
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
              {selectedCluster && (
                <div className="mt-3 space-y-3">
                  {fields
                    .filter(
                      (field) => getFieldCluster(field) === selectedCluster
                    )
                    .map(renderField)}
                </div>
              )}
            </div>
          );
        })}

        {/* Render regular fields (not in mutual exclusion groups) */}
        {regularFields.map(renderField)}
      </div>
    );
  };

  // Format field value for display
  const formatFieldValue = (config: FieldConfig, value: unknown): string => {
    if (value === undefined || value === null || value === "") {
      return "Not provided";
    }

    switch (config.field_type) {
      case "boolean":
        return value ? "Yes" : "No";
      case "date":
        if (typeof value === "string") {
          try {
            const date = new Date(value);
            return date.toLocaleDateString();
          } catch {
            return String(value);
          }
        }
        return String(value);
      case "time":
        if (typeof value === "string") {
          return value; // Already in HH:mm format
        }
        return String(value);
      case "grouped_breakdown":
        if (Array.isArray(value)) {
          if (value.length === 0) return "None";
          return value
            .map(
              (item: GroupedBreakdownItem) => `${item.brand}: ${item.quantity}`
            )
            .join(", ");
        }
        return "None";
      case "select":
        return String(value);
      default:
        return String(value);
    }
  };

  // Render Summary Step
  const renderSummaryStep = () => {
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Review Your Entry
          </h3>
          <p className="text-sm text-gray-500">
            Review your entry. You can edit any section before submitting.
          </p>
        </div>

        {/* Basic Info Section */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold text-gray-900">
              Basic Information
            </h4>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentStep(0)}
            >
              Edit
            </Button>
          </div>
          <div className="space-y-4">
            {selectedColleagues.length > 0 && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-500 flex-1">
                  Who worked on this job?
                </span>
                <span className="text-base text-gray-900 flex-1 text-right">
                  {selectedColleagues
                    .map((id) => workers.find((w) => w.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
            {selectedLocation && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-500 flex-1">
                  Where did you work?
                </span>
                <span className="text-base text-gray-900 flex-1 text-right">
                  {locations.find((l) => l.id === selectedLocation)?.name ||
                    selectedLocation}
                </span>
              </div>
            )}
            {startTime && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-500 flex-1">Start Time</span>
                <span className="text-base text-gray-900 flex-1 text-right">
                  {startTime.getHours().toString().padStart(2, "0")}:
                  {startTime.getMinutes().toString().padStart(2, "0")}
                </span>
              </div>
            )}
            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-500 flex-1">Finish Time</span>
              <span className="text-base text-gray-900 flex-1 text-right">
                {finishTime.getHours().toString().padStart(2, "0")}:
                {finishTime.getMinutes().toString().padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* Field Sections */}
        {visibleSections.map((section, sectionIndex) => {
          const sectionFields = organizedFields.get(section.id) || [];
          const visibleFields = sectionFields.filter(isFieldVisible);

          // Filter out optional empty fields
          const fieldsToShow = visibleFields.filter((config) => {
            const value = fieldValues[config.id];
            return config.required || hasValue(value, config.field_type);
          });

          if (fieldsToShow.length === 0) return null;

          const sectionStep = 1 + sectionIndex;

          return (
            <div
              key={section.id}
              className="bg-white rounded-xl p-4 border border-gray-200"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {section.title}
                  </h4>
                  {section.description && (
                    <p className="text-sm text-gray-500 mt-1">
                      {section.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentStep(sectionStep)}
                >
                  Edit
                </Button>
              </div>
              <div className="space-y-4">
                {fieldsToShow.map((config) => {
                  const value = fieldValues[config.id];
                  const displayValue = formatFieldValue(config, value);

                  return (
                    <div
                      key={config.id}
                      className="flex justify-between items-start"
                    >
                      <span className="text-sm text-gray-500 flex-1">
                        {config.label}
                        {config.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </span>
                      <span className="text-base text-gray-900 flex-1 text-right">
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const fieldsInSections = fields.filter((field) => field.section_id !== null);
  const visibleFieldCount = fieldsInSections.filter(isFieldVisible).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Mobile Preview
        </h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {visibleFieldCount} visible
        </Badge>
      </div>

      {/* Mobile Device Frame - Made wider */}
      <div className="relative w-full max-w-[420px] mx-auto flex-1">
        <div className="bg-gray-900 border-12 border-gray-900 rounded-[48px] shadow-2xl overflow-hidden">
          {/* Device Notch / Dynamic Island */}
          <div className="bg-gray-900 h-7 flex items-center justify-center relative">
            <div className="w-24 h-6 bg-black rounded-full absolute" />
          </div>

          {/* Screen Content */}
          <div className="bg-gray-50 min-h-[580px] max-h-[580px] overflow-y-auto">
            {/* User Header */}
            <div className="bg-white px-4 pt-2 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-semibold text-blue-600">
                    JD
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-900 block">
                    {formTitle}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formDescription}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  Step {currentStep + 1} of {totalSteps}
                </span>
                <span className="text-sm font-bold text-blue-600">
                  {progressPercentage}%
                </span>
              </div>
              <Progress value={progressPercentage} />
            </div>

            {/* Step Content */}
            <div className="p-4">
              <div className="bg-white rounded-2xl p-6">
                {currentStep === 0 && renderBasicInfoStep()}
                {currentStep > 0 &&
                  currentStep < totalSteps - 1 &&
                  currentSection &&
                  renderSectionStep(currentSection)}
                {currentStep === totalSteps - 1 && renderSummaryStep()}
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="bg-white border-t border-gray-200 px-4 py-4 sticky bottom-0">
              <div className="flex gap-3">
                {/* Previous Button */}
                {currentStep > 0 && (
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Previous
                  </Button>
                )}
                {/* Next/Submit Button */}
                {!isLastStep ? (
                  <Button
                    variant="default"
                    size="lg"
                    className="flex-1"
                    onClick={handleNext}
                  >
                    Next
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                ) : (
                  <Button variant="default" size="lg" className="flex-1">
                    <CheckCircle className="w-5 h-5 mr-1" />
                    Submit Entry
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Device Home Indicator */}
          <div className="bg-gray-900 h-6 flex items-center justify-center">
            <div className="w-28 h-1 bg-gray-600 rounded-full" />
          </div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="mt-4 flex flex-col items-center gap-3">
        {/* Step Dots */}
        <div className="flex gap-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <button
              key={index}
              onClick={() => handleStepClick(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentStep
                  ? "bg-primary w-6"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
