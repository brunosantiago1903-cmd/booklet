import { BottomNav } from "@/components/bottom-nav";
import { getAppContext } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Garante sessão + vínculo ao casal antes de qualquer página do app.
  await getAppContext();
  return (
    <>
      <main className="safe-top pb-nav mx-auto w-full max-w-2xl px-4 pt-3">{children}</main>
      <BottomNav />
    </>
  );
}
