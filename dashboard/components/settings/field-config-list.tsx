"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldConfig, FieldType, ValidationRules } from "@/shared/types";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import FieldConfigForm from "./field-config-form";

interface FieldConfigListProps {
  fieldConfigs: FieldConfig[];
  loading: boolean;
  error: string | null;
  onDeleteFieldConfig: (fieldConfigId: string) => Promise<void>;
  onUpdateFieldConfig: (
    fieldConfigId: string,
    fieldConfigData: {
      name: string;
      label: string;
      field_type: FieldType;
      description: string | null;
      required: boolean;
      validation_rules: ValidationRules | null;
      options: string[] | null;
      mutually_exclusive_group: string | null;
      group_cluster: string | null;
    }
  ) => Promise<void>;
  onReorderFieldConfigs: (fieldConfigIds: string[]) => Promise<void>;
}

interface SortableFieldConfigItemProps {
  fieldConfig: FieldConfig;
  onEdit: (fieldConfig: FieldConfig) => void;
  onDelete: (fieldConfig: FieldConfig) => void;
}

function SortableFieldConfigItem({
  fieldConfig,
  onEdit,
  onDelete,
}: SortableFieldConfigItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fieldConfig.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div
                className="flex flex-col gap-2 mt-1 cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <CardTitle className="text-lg">{fieldConfig.label}</CardTitle>
                  <Badge variant="secondary">{fieldConfig.field_type}</Badge>
                  {fieldConfig.required && (
                    <Badge variant="outline">Required</Badge>
                  )}
                  {fieldConfig.mutually_exclusive_group && (
                    <Badge variant="default" className="bg-blue-600">
                      Group: {fieldConfig.mutually_exclusive_group}
                    </Badge>
                  )}
                  {fieldConfig.group_cluster && (
                    <Badge variant="default" className="bg-purple-600">
                      Cluster: {fieldConfig.group_cluster}
                    </Badge>
                  )}
                </div>
                {fieldConfig.description && (
                  <CardDescription className="mb-2">
                    {fieldConfig.description}
                  </CardDescription>
                )}
                <div className="text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{fieldConfig.name}</span>
                  {fieldConfig.options && fieldConfig.options.length > 0 && (
                    <span className="ml-4">
                      Options: {fieldConfig.options.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(fieldConfig)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(fieldConfig)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function FieldConfigList({
  fieldConfigs,
  loading,
  error,
  onDeleteFieldConfig,
  onUpdateFieldConfig,
  onReorderFieldConfigs,
}: FieldConfigListProps) {
  const [editingFieldConfig, setEditingFieldConfig] =
    useState<FieldConfig | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingFieldConfig, setDeletingFieldConfig] =
    useState<FieldConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleEdit = (fieldConfig: FieldConfig) => {
    setEditingFieldConfig(fieldConfig);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingFieldConfig) return;
    await onDeleteFieldConfig(deletingFieldConfig.id);
    setDeletingFieldConfig(null);
  };

  const handleFormSuccess = async (
    fieldConfigData: {
      name: string;
      label: string;
      field_type: FieldType;
      description: string | null;
      required: boolean;
      validation_rules: ValidationRules | null;
      options: string[] | null;
      mutually_exclusive_group: string | null;
      group_cluster: string | null;
    },
    fieldConfigId?: string
  ) => {
    setIsFormOpen(false);
    if (fieldConfigId && editingFieldConfig) {
      await onUpdateFieldConfig(fieldConfigId, fieldConfigData);
    }
    setEditingFieldConfig(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = fieldConfigs.findIndex((fc) => fc.id === active.id);
    const newIndex = fieldConfigs.findIndex((fc) => fc.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(fieldConfigs, oldIndex, newIndex);
      const fieldConfigIds = newOrder.map((fc) => fc.id);
      await onReorderFieldConfigs(fieldConfigIds);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">Loading field configurations...</div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">Error: {error}</div>
    );
  }

  return (
    <>
      {fieldConfigs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Field Configurations</CardTitle>
            <CardDescription>
              Add your first field configuration to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fieldConfigs.map((fc) => fc.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {fieldConfigs.map((fieldConfig) => (
                <SortableFieldConfigItem
                  key={fieldConfig.id}
                  fieldConfig={fieldConfig}
                  onEdit={handleEdit}
                  onDelete={setDeletingFieldConfig}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <FieldConfigForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingFieldConfig(null);
          }
        }}
        onSuccess={handleFormSuccess}
        fieldConfig={editingFieldConfig}
      />

      <AlertDialog
        open={!!deletingFieldConfig}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingFieldConfig(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              field configuration &quot;{deletingFieldConfig?.label}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
