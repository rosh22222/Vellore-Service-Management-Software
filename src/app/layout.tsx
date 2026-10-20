import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { NavigationFeedback } from "@/components/navigation-feedback";

export const metadata: Metadata = {
  title: "VFE Service Management",
  description: "Vellore Fitness Equipments Service Management System",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Suspense fallback={null}><NavigationFeedback /></Suspense>{children}</body>
    </html>
  );
}
