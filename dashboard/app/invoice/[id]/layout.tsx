import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice",
  description: "View and pay your invoice",
};

/**
 * Separate layout for public invoice pages
 * This layout doesn't include the main nav to provide a clean customer-facing experience
 */
export default function InvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
