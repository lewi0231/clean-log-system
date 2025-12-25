"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Mail, Smartphone } from "lucide-react";
import Link from "next/link";

export default function WorkerSignupSuccessPage() {
  return (
    <div className="h-screen w-full flex justify-center items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-center">Welcome to Fieldly!</CardTitle>
          <CardDescription className="text-center">
            Your account has been created successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Next Steps
              </h3>
              <p className="text-sm text-muted-foreground">
                To get started, you&apos;ll need to download and log in to our
                mobile application. You can download it here:
              </p>
              <Button asChild className="w-full" variant="default">
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    // Placeholder - will be updated with actual mobile app link
                    alert("Mobile app download link coming soon!");
                  }}
                >
                  Download Mobile App
                </Link>
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Check Your Email
              </h3>
              <p className="text-sm text-muted-foreground">
                An email has been sent to your registered email address with a
                link to download the mobile application. Please check your inbox
                (and spam folder) for further instructions.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              If you have any questions, please contact your organization
              administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
