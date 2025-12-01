"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldConfig, FormSectionWithFields } from "@clean-log/shared";
import { ChevronDown, ChevronRight, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";

interface MobileDevicePreviewProps {
  fields: FieldConfig[];
  sections: FormSectionWithFields[];
  formTitle?: string;
  formDescription?: string;
  // Mock values to test conditional logic
  mockValues?: Record<string, string | number | boolean>;
}

export function MobileDevicePreview({
  fields,
  sections,
  formTitle = "New Entry",
  formDescription = "Fill out the form below",
  mockValues = {},
}: MobileDevicePreviewProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

  // Organize fields by section
  const organizedContent = useMemo(() => {
    const sectionMap = new Map<string | null, FieldConfig[]>();

    // Initialize with sections
    sections.forEach((section) => {
      sectionMap.set(section.id, []);
    });
    sectionMap.set(null, []); // For unsectioned fields

    // Distribute fields
    fields.forEach((field) => {
      const sectionId = field.section_id;
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, []);
      }
      sectionMap.get(sectionId)!.push(field);
    });

    return sectionMap;
  }, [fields, sections]);

  // Check if a field should be visible based on conditional logic
  const isFieldVisible = (field: FieldConfig): boolean => {
    if (!field.conditional_logic) return true;

    const { conditions, match_type = "all" } = field.conditional_logic;

    const results = conditions.map((condition) => {
      const sourceValue = mockValues[condition.field_id];

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
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const renderFieldPreview = (field: FieldConfig) => {
    const baseClasses =
      "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white";

    if (!isFieldVisible(field)) {
      return null;
    }

    switch (field.field_type) {
      case "textarea":
        return (
          <textarea
            placeholder={field.description || `Enter ${field.label}`}
            className={`${baseClasses} min-h-[80px] resize-none`}
            disabled
          />
        );
      case "select":
        return (
          <select className={`${baseClasses} appearance-none`} disabled>
            <option>
              {field.description || `Select ${field.label.toLowerCase()}`}
            </option>
            {field.options?.map((opt, i) => (
              <option key={i}>{opt}</option>
            ))}
          </select>
        );
      case "boolean":
        return (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-gray-900">
              {field.label}
            </span>
            <div className="w-11 h-6 bg-gray-200 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </div>
        );
      case "grouped_breakdown":
        return (
          <div className="space-y-2">
            {field.options?.slice(0, 3).map((opt, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <span className="text-xs text-gray-600">{opt}</span>
                <input
                  type="number"
                  className="w-16 px-2 py-1 text-xs border rounded text-center"
                  placeholder="0"
                  disabled
                />
              </div>
            ))}
            {(field.options?.length || 0) > 3 && (
              <p className="text-xs text-gray-400 text-center">
                +{(field.options?.length || 0) - 3} more groups
              </p>
            )}
          </div>
        );
      case "date":
        return (
          <div className={`${baseClasses} flex items-center justify-between`}>
            <span className="text-gray-400 text-sm">Select date</span>
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        );
      case "time":
        return (
          <div className={`${baseClasses} flex items-center justify-between`}>
            <span className="text-gray-400 text-sm">Select time</span>
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
        );
      default:
        return (
          <input
            type={field.field_type}
            placeholder={field.description || `Enter ${field.label}`}
            className={baseClasses}
            disabled
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

  const fieldsInSections = fields.filter((field) => field.section_id !== null);
  const visibleFieldCount = fieldsInSections.filter(isFieldVisible).length;

  return (
    <div className="flex flex-col h-full ">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Mobile Preview
        </h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {visibleFieldCount} visible
        </Badge>
      </div>

      {/* Mobile Device Frame */}
      <div className="relative w-full max-w-[320px] mx-auto flex-1">
        <div className="bg-gray-900 border-12 border-gray-900 rounded-[48px] shadow-2xl overflow-hidden">
          {/* Device Notch / Dynamic Island */}
          <div className="bg-gray-900 h-7 flex items-center justify-center relative">
            <div className="w-24 h-6 bg-black rounded-full absolute" />
          </div>

          {/* Screen Content */}
          <div className="bg-gray-50 min-h-[580px] max-h-[580px] overflow-y-auto">
            {/* Status bar simulation */}
            <div className="bg-white px-4 py-2 border-b border-gray-100 sticky top-0 z-10">
              <h2 className="text-base font-semibold text-gray-900">
                {formTitle}
              </h2>
              <p className="text-xs text-gray-500">{formDescription}</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Render sections */}
              {sections.map((section) => {
                const sectionFields = organizedContent.get(section.id) || [];
                const visibleSectionFields =
                  sectionFields.filter(isFieldVisible);
                const isCollapsed = collapsedSections.has(section.id);

                if (visibleSectionFields.length === 0) return null;

                return (
                  <div
                    key={section.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {section.title}
                        </h3>
                        {section.description && (
                          <p className="text-xs text-gray-500">
                            {section.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {visibleSectionFields.length}
                        </Badge>
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="p-3 space-y-3">
                        {visibleSectionFields.map(renderField)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty state */}
              {(sections.length === 0 || visibleFieldCount === 0) && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">
                    Add sections and assign fields to see a preview
                  </p>
                </div>
              )}

              {/* Submit button preview */}
              {visibleFieldCount > 0 && (
                <Button className="w-full mt-4" size="lg">
                  Submit
                </Button>
              )}
            </div>
          </div>

          {/* Device Home Indicator */}
          <div className="bg-gray-900 h-6 flex items-center justify-center">
            <div className="w-28 h-1 bg-gray-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
