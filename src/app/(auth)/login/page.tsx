import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { getBrandAssetSrc } from "@/lib/brand-assets";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <main className="login-shell relative isolate grid min-h-svh place-items-center overflow-hidden px-4 py-10 sm:px-6 sm:py-12">
      <div aria-hidden="true" className="login-backdrop-panel login-backdrop-panel-violet" />
      <div aria-hidden="true" className="login-backdrop-panel login-backdrop-panel-warm" />

      <section aria-labelledby="login-heading" className="login-card relative z-10 w-full max-w-[500px] rounded-[32px] border border-white bg-white/90 px-6 py-7 backdrop-blur-xl sm:rounded-[36px] sm:p-8">
        <header className="mb-8 text-center">
          <div className="login-logo-panel">
            <Image
              src={getBrandAssetSrc("vellore-logo-transparent.png")}
              alt="Vellore Fitness Equipments"
              width={300}
              height={100}
              priority
              sizes="(max-width: 400px) 75vw, 300px"
              className="login-logo-art"
            />
          </div>
          <h1 id="login-heading" className="mt-6 text-[2rem] font-bold leading-tight tracking-[-0.04em] text-brand-primary sm:text-[2.5rem]">
            Welcome Back
          </h1>
        </header>
        <LoginForm />
      </section>
    </main>
  );
}


