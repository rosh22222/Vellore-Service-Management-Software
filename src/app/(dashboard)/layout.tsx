import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { MobileNav } from "@/components/mobile-nav";
import { requireUser } from "@/lib/auth";
import { getCachedCompanyIdentity } from "@/lib/cached-lookups";
import { getBrandAssetSrc } from "@/lib/brand-assets";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, company] = await Promise.all([
    requireUser(),
    getCachedCompanyIdentity(),
  ]);
  return (
    <div className="flex min-h-screen bg-brand-background">
      <Sidebar
        role={user.role}
        companyName={company?.companyName ?? "VELLORE FITNESS EQUIPMENTS"}
        logoSrc={getBrandAssetSrc("vellore-logo-transparent.png")}
        canAssignTechnician={user.canAssignTechnician}
      />
      <div className="min-w-0 flex-1 lg:pl-64">
        <Topbar user={user} />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to main content</a>
        <main id="main-content" className="relative mx-auto w-full max-w-[1800px] p-4 pb-24 md:p-6 md:pb-24 lg:pb-8 xl:px-8 xl:py-7">
          {children}
        </main>
      </div>
      <MobileNav
        role={user.role}
        canAssignTechnician={user.canAssignTechnician}
      />
    </div>
  );
}

