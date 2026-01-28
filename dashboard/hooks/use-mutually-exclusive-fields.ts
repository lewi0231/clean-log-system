"use client";

import type { FieldConfig } from "@clean-log/shared/types";
import { useCallback, useMemo, useState } from "react";

export interface MutuallyExclusiveFieldsResult {
  groupedFields: {
    groups: Map<string, FieldConfig[]>;
    regularFields: FieldConfig[];
  };
  selectedClusters: Record<string, string | null>;
  setSelectedClusters: React.Dispatch<
    React.SetStateAction<Record<string, string | null>>
  >;
  handleClusterSelect: (groupId: string, clusterId: string | null) => void;
  fieldsToRender: FieldConfig[];
  getClustersForGroup: (groupId: string) => string[];
  getFieldCluster: (field: FieldConfig) => string | null;
  formatClusterName: (clusterId: string) => string;
}

/**
 * Shared hook for mutual exclusion logic: groups fields by mutually_exclusive_group,
 * tracks selected cluster per group, and returns only the fields that should be
 * rendered (regular fields + fields from selected clusters).
 * Used by create-job-dialog, edit-job-dialog, and test-invoice-modal.
 */
export function useMutuallyExclusiveFields(
  visibleFields: FieldConfig[],
  updateFieldValue: (fieldId: string, value: unknown) => void
): MutuallyExclusiveFieldsResult {
  const [selectedClusters, setSelectedClusters] = useState<
    Record<string, string | null>
  >({});

  const getFieldCluster = useCallback((field: FieldConfig): string | null => {
    return field.group_cluster || null;
  }, []);

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

  const getClustersForGroup = useCallback(
    (groupId: string): string[] => {
      const fields = groupedFields.groups.get(groupId) || [];
      const clusters = new Set<string>();
      fields.forEach((field) => {
        const cluster = field.group_cluster || null;
        if (cluster) {
          clusters.add(cluster);
        }
      });
      return Array.from(clusters).sort();
    },
    [groupedFields.groups]
  );

  const formatClusterName = useCallback((clusterId: string): string => {
    return clusterId
      .split("_")
      .map(
        (word: string) =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(" ");
  }, []);

  const handleClusterSelect = useCallback(
    (groupId: string, clusterId: string | null) => {
      setSelectedClusters((prev) => ({
        ...prev,
        [groupId]: clusterId,
      }));

      const fields = groupedFields.groups.get(groupId) || [];
      fields.forEach((field) => {
        const fieldCluster = field.group_cluster || null;
        if (fieldCluster !== clusterId) {
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
    [groupedFields.groups, updateFieldValue]
  );

  const fieldsToRender = useMemo(() => {
    const fields: FieldConfig[] = [];
    fields.push(...groupedFields.regularFields);

    groupedFields.groups.forEach((groupFields, groupId) => {
      const selectedCluster = selectedClusters[groupId];
      if (selectedCluster) {
        const clusterFields = groupFields.filter(
          (f) => (f.group_cluster || null) === selectedCluster
        );
        fields.push(...clusterFields);
      }
    });

    return fields;
  }, [groupedFields, selectedClusters]);

  return {
    groupedFields,
    selectedClusters,
    setSelectedClusters,
    handleClusterSelect,
    fieldsToRender,
    getClustersForGroup,
    getFieldCluster,
    formatClusterName,
  };
}
