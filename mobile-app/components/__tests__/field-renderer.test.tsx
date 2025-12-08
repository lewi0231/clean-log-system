import { FieldConfig } from "@clean-log/shared/types/field-config";
import { render, screen } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";
import { FieldRenderer } from "../field-renderer";

// Mock the UI components
vi.mock("@/components/ui/date-time-picker", () => ({
  DateTimePicker: ({ value, onValueChange, placeholder }: any) => {
    const TestDateTimePicker = require("react-native").View;
    return (
      <TestDateTimePicker testID="date-time-picker">
        <TestDateTimePicker testID="placeholder">
          {placeholder}
        </TestDateTimePicker>
      </TestDateTimePicker>
    );
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, placeholder }: any) => {
    const { View, Pressable, Text } = require("react-native");
    return (
      <View testID="select">
        <Text testID="select-value">{value}</Text>
        <Text testID="select-placeholder">{placeholder}</Text>
        {children}
      </View>
    );
  },
  SelectItem: ({ children, value }: any) => {
    const { View, Text } = require("react-native");
    return (
      <View testID={`select-item-${value}`}>
        <Text>{children}</Text>
      </View>
    );
  },
}));

vi.mock("@/components/group-breakdown-field", () => ({
  GroupedBreakdownField: ({ config, value, onChange }: any) => {
    const { View, Text } = require("react-native");
    return (
      <View testID="grouped-breakdown-field">
        <Text testID="breakdown-value">{JSON.stringify(value)}</Text>
      </View>
    );
  },
}));

function createTestFieldConfig(overrides: Partial<FieldConfig>): FieldConfig {
  return {
    id: "test-id",
    organization_id: "org-id",
    name: "test_field",
    label: "Test Field",
    field_type: "text",
    description: null,
    required: false,
    order_position: 0,
    validation_rules: null,
    options: null,
    mutually_exclusive_group: null,
    group_cluster: null,
    section_id: null,
    conditional_logic: null,
    version: 1,
    active: true,
    archived_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("FieldRenderer", () => {
  it("should render text input for text field type", () => {
    const config = createTestFieldConfig({
      name: "name",
      label: "Name",
      field_type: "text",
    });
    const onChange = vi.fn();

    render(
      <FieldRenderer config={config} value="John Doe" onChange={onChange} />
    );

    const input = screen.getByPlaceholderText("Test Field");
    expect(input).toBeTruthy();
  });

  it("should render number input for number field type", () => {
    const config = createTestFieldConfig({
      name: "age",
      label: "Age",
      field_type: "number",
    });
    const onChange = vi.fn();

    render(<FieldRenderer config={config} value={25} onChange={onChange} />);

    const input = screen.getByDisplayValue("25");
    expect(input).toBeTruthy();
  });

  it("should render email input for email field type", () => {
    const config = createTestFieldConfig({
      name: "email",
      label: "Email",
      field_type: "email",
    });
    const onChange = vi.fn();

    render(
      <FieldRenderer
        config={config}
        value="test@example.com"
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText("Email");
    expect(input).toBeTruthy();
  });

  it("should render textarea for textarea field type", () => {
    const config = createTestFieldConfig({
      name: "description",
      label: "Description",
      field_type: "textarea",
    });
    const onChange = vi.fn();

    render(
      <FieldRenderer
        config={config}
        value="Some description"
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText("Description");
    expect(input).toBeTruthy();
  });

  it("should render select for select field type", () => {
    const config = createTestFieldConfig({
      name: "status",
      label: "Status",
      field_type: "select",
      options: ["active", "inactive"],
    });
    const onChange = vi.fn();

    render(
      <FieldRenderer config={config} value="active" onChange={onChange} />
    );

    const select = screen.getByTestId("select");
    expect(select).toBeTruthy();
  });

  it("should render grouped breakdown field for grouped_breakdown type", () => {
    const config = createTestFieldConfig({
      name: "breakdown",
      label: "Breakdown",
      field_type: "grouped_breakdown",
      options: ["Brand A", "Brand B"],
    });
    const onChange = vi.fn();
    const value = [
      { brand: "Brand A", quantity: 10 },
      { brand: "Brand B", quantity: 5 },
    ];

    render(<FieldRenderer config={config} value={value} onChange={onChange} />);

    const breakdownField = screen.getByTestId("grouped-breakdown-field");
    expect(breakdownField).toBeTruthy();
  });

  it("should render switch for boolean field type", () => {
    const config = createTestFieldConfig({
      name: "active",
      label: "Active",
      field_type: "boolean",
    });
    const onChange = vi.fn();

    render(<FieldRenderer config={config} value={true} onChange={onChange} />);

    const switchComponent = screen.getByText("Active");
    expect(switchComponent).toBeTruthy();
  });

  it("should display error message when error is provided", () => {
    const config = createTestFieldConfig({
      name: "name",
      label: "Name",
      field_type: "text",
    });
    const onChange = vi.fn();
    const onErrorClear = vi.fn();

    render(
      <FieldRenderer
        config={config}
        value=""
        error="This field is required"
        onChange={onChange}
        onErrorClear={onErrorClear}
      />
    );

    const errorText = screen.getByText("This field is required");
    expect(errorText).toBeTruthy();
  });

  it("should call onErrorClear when field value changes and error exists", () => {
    const config = createTestFieldConfig({
      name: "name",
      label: "Name",
      field_type: "text",
    });
    const onChange = vi.fn();
    const onErrorClear = vi.fn();

    const { getByPlaceholderText } = render(
      <FieldRenderer
        config={config}
        value=""
        error="This field is required"
        onChange={onChange}
        onErrorClear={onErrorClear}
      />
    );

    const input = getByPlaceholderText("Test Field");
    // Simulate text change
    input.props.onChangeText("New value");

    expect(onChange).toHaveBeenCalledWith("New value");
    expect(onErrorClear).toHaveBeenCalled();
  });

  it("should handle time field with HH:mm format", () => {
    const config = createTestFieldConfig({
      name: "time",
      label: "Time",
      field_type: "time",
    });
    const onChange = vi.fn();

    render(<FieldRenderer config={config} value="14:30" onChange={onChange} />);

    const timePicker = screen.getByTestId("date-time-picker");
    expect(timePicker).toBeTruthy();
  });

  it("should handle date field", () => {
    const config = createTestFieldConfig({
      name: "date",
      label: "Date",
      field_type: "date",
    });
    const onChange = vi.fn();

    render(
      <FieldRenderer
        config={config}
        value={new Date().toISOString()}
        onChange={onChange}
      />
    );

    const datePicker = screen.getByTestId("date-time-picker");
    expect(datePicker).toBeTruthy();
  });
});
