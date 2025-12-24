"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface OnboardingData {
  // Step 1: Business Basics
  industry_type: string;
  employee_count: "none" | "1-5" | "6-20" | "21-50" | "50+";

  // Step 2: Business Details
  abn: string;
  has_locations: boolean;

  // Step 3: Worker Payment (conditional)
  has_workers: boolean;
  worker_payment_method: "hourly" | "per_job" | "fixed_salary" | null;
  worker_payment_frequency: "weekly" | "fortnightly" | "monthly" | null;

  // Step 4: Invoicing
  invoice_frequency: "immediately" | "daily" | "weekly" | "monthly";
  invoice_weekly_day: number | null; // 0-6, Sunday-Saturday
  invoice_monthly_day: number | null; // 1-31
  review_invoices_before_sending: boolean;
}

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    industry_type: "",
    employee_count: "none",
    abn: "",
    has_locations: false,
    has_workers: false,
    worker_payment_method: null,
    worker_payment_frequency: null,
    invoice_frequency: "immediately",
    invoice_weekly_day: null,
    invoice_monthly_day: null,
    review_invoices_before_sending: true,
  });

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.industry_type !== "" && !!data.employee_count;
      case 2:
        return true; // ABN and locations are optional
      case 3:
        if (data.employee_count === "none") return true;
        // If they have employees, payment method and frequency are required
        return (
          data.worker_payment_method !== null &&
          data.worker_payment_frequency !== null
        );
      case 4:
        if (data.invoice_frequency === "weekly") {
          return data.invoice_weekly_day !== null;
        }
        if (data.invoice_frequency === "monthly") {
          return data.invoice_monthly_day !== null;
        }
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) {
      toast.error("Please complete all required fields");
      return;
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      log.info("Onboarding: Submitting onboarding data", { data });

      const { error } = await supabase.functions.invoke("complete-onboarding", {
        body: data,
      });

      if (error) {
        throw error;
      }

      log.info("Onboarding: Completed successfully");
      toast.success("Welcome! Let's get you set up.");

      // Redirect to dashboard (checklist will appear automatically)
      router.push("/dashboard");
    } catch (err) {
      log.error("Onboarding: Failed to complete", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to complete onboarding. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1BusinessBasics data={data} updateData={updateData} />;
      case 2:
        return <Step2BusinessDetails data={data} updateData={updateData} />;
      case 3:
        return <Step3WorkerPayment data={data} updateData={updateData} />;
      case 4:
        return <Step4Invoicing data={data} updateData={updateData} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-2xl">
              Welcome to Clean Log System
            </CardTitle>
            <CardDescription>
              Let&apos;s get your account set up. This will only take a few
              minutes.
            </CardDescription>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">{renderStep()}</CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed() || isSubmitting}>
            {currentStep === TOTAL_STEPS ? (
              <>
                Complete Setup
                <Check className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Step 1: Business Basics
function Step1BusinessBasics({
  data,
  updateData,
}: {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="industry_type" className="text-base font-semibold">
          What industry are you in? *
        </Label>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          This helps us customize your experience
        </p>
        <Select
          value={data.industry_type}
          onValueChange={(value) => updateData({ industry_type: value })}
        >
          <SelectTrigger id="industry_type">
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="car_detailing">
              Car Detailing / Vehicle Services
            </SelectItem>
            <SelectItem value="cleaning">Cleaning Services</SelectItem>
            <SelectItem value="maintenance">Maintenance Services</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-base font-semibold">
          How many employees or contractors do you have? *
        </Label>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          This helps us configure worker management
        </p>
        <RadioGroup
          value={data.employee_count}
          onValueChange={(value) =>
            updateData({
              employee_count: value as OnboardingData["employee_count"],
              has_workers: value !== "none",
            })
          }
          className="space-y-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="employees-none" />
            <Label
              htmlFor="employees-none"
              className="font-normal cursor-pointer"
            >
              None (I&apos;m a solo operator)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="1-5" id="employees-1-5" />
            <Label
              htmlFor="employees-1-5"
              className="font-normal cursor-pointer"
            >
              1-5 employees
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="6-20" id="employees-6-20" />
            <Label
              htmlFor="employees-6-20"
              className="font-normal cursor-pointer"
            >
              6-20 employees
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="21-50" id="employees-21-50" />
            <Label
              htmlFor="employees-21-50"
              className="font-normal cursor-pointer"
            >
              21-50 employees
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="50+" id="employees-50" />
            <Label
              htmlFor="employees-50"
              className="font-normal cursor-pointer"
            >
              50+ employees
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

// Step 2: Business Details
function Step2BusinessDetails({
  data,
  updateData,
}: {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="abn" className="text-base font-semibold">
          ABN Number (Optional)
        </Label>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Your Australian Business Number for invoicing
        </p>
        <Input
          id="abn"
          type="text"
          placeholder="11 123 456 789"
          value={data.abn}
          onChange={(e) => updateData({ abn: e.target.value })}
          maxLength={11}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">
              Do you service specific customer locations?
            </Label>
            <p className="text-sm text-muted-foreground">
              Static sites or recurring customer locations
            </p>
          </div>
          <Switch
            checked={data.has_locations}
            onCheckedChange={(checked) =>
              updateData({ has_locations: checked })
            }
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
          />
        </div>
        {data.has_locations && (
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            Great! We&apos;ll help you set up locations after onboarding.
          </p>
        )}
      </div>
    </div>
  );
}

// Step 3: Worker Payment
function Step3WorkerPayment({
  data,
  updateData,
}: {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}) {
  // Auto-set has_workers based on employee_count (already answered in step 1)
  const hasWorkers = data.employee_count !== "none";

  // Use useEffect to update has_workers when employee_count changes
  useEffect(() => {
    if (data.has_workers !== hasWorkers) {
      updateData({ has_workers: hasWorkers });
    }
  }, [data.employee_count, data.has_workers, hasWorkers, updateData]);

  if (!hasWorkers) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Since you don&apos;t have employees, you can skip worker payment
          setup. You can configure this later if needed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">
          How do you pay workers? *
        </Label>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Select the payment method you use
        </p>
        <RadioGroup
          value={data.worker_payment_method || ""}
          onValueChange={(value) =>
            updateData({
              worker_payment_method:
                value as OnboardingData["worker_payment_method"],
            })
          }
          className="space-y-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="hourly" id="payment-hourly" />
            <Label
              htmlFor="payment-hourly"
              className="font-normal cursor-pointer"
            >
              By the hour
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="per_job" id="payment-per-job" />
            <Label
              htmlFor="payment-per-job"
              className="font-normal cursor-pointer"
            >
              Per job completed
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="fixed_salary" id="payment-fixed" />
            <Label
              htmlFor="payment-fixed"
              className="font-normal cursor-pointer"
            >
              Fixed salary
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label htmlFor="payment-frequency" className="text-base font-semibold">
          Payment frequency *
        </Label>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          How often do you pay your workers?
        </p>
        <Select
          value={data.worker_payment_frequency || ""}
          onValueChange={(value) =>
            updateData({
              worker_payment_frequency:
                value as OnboardingData["worker_payment_frequency"],
            })
          }
        >
          <SelectTrigger id="payment-frequency">
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="fortnightly">Fortnightly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Step 4: Invoicing
function Step4Invoicing({
  data,
  updateData,
}: {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="invoice-frequency" className="text-base font-semibold">
          How often do you invoice customers? *
        </Label>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          We&apos;ll configure automatic invoice sending based on your
          preference
        </p>
        <Select
          value={data.invoice_frequency}
          onValueChange={(value) =>
            updateData({
              invoice_frequency: value as OnboardingData["invoice_frequency"],
              invoice_weekly_day: null,
              invoice_monthly_day: null,
            })
          }
        >
          <SelectTrigger id="invoice-frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediately">
              Immediately after each job
            </SelectItem>
            <SelectItem value="daily">Daily (at end of day)</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.invoice_frequency === "weekly" && (
        <div>
          <Label
            htmlFor="invoice-weekly-day"
            className="text-base font-semibold"
          >
            Which day of the week? *
          </Label>
          <Select
            value={data.invoice_weekly_day?.toString() || ""}
            onValueChange={(value) =>
              updateData({ invoice_weekly_day: parseInt(value) })
            }
          >
            <SelectTrigger id="invoice-weekly-day">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sunday</SelectItem>
              <SelectItem value="1">Monday</SelectItem>
              <SelectItem value="2">Tuesday</SelectItem>
              <SelectItem value="3">Wednesday</SelectItem>
              <SelectItem value="4">Thursday</SelectItem>
              <SelectItem value="5">Friday</SelectItem>
              <SelectItem value="6">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {data.invoice_frequency === "monthly" && (
        <div>
          <Label
            htmlFor="invoice-monthly-day"
            className="text-base font-semibold"
          >
            Which day of the month? *
          </Label>
          <Select
            value={data.invoice_monthly_day?.toString() || ""}
            onValueChange={(value) =>
              updateData({ invoice_monthly_day: parseInt(value) })
            }
          >
            <SelectTrigger id="invoice-monthly-day">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <SelectItem key={day} value={day.toString()}>
                  {day}
                  {day === 1 && " (1st)"}
                  {day === 2 && " (2nd)"}
                  {day === 3 && " (3rd)"}
                  {day > 3 && ` (${day}th)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">
              Review invoices before sending?
            </Label>
            <p className="text-sm text-muted-foreground">
              If enabled, invoices will be created as drafts for your review
            </p>
          </div>
          <Switch
            checked={data.review_invoices_before_sending}
            onCheckedChange={(checked) =>
              updateData({ review_invoices_before_sending: checked })
            }
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
          />
        </div>
      </div>
    </div>
  );
}
