export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
  min_items?: number;
  max_items?: number;
  allow_zero_quantities?: boolean;
}
