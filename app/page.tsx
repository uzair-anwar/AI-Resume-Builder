import { AppShell } from "@/components/ui/AppShell";
import HomeWorkspaceClient from "@/components/tailor/HomeWorkspaceClient";

export default function Home() {
  return (
    <AppShell>
      <main className="min-h-screen">
        <HomeWorkspaceClient />
      </main>
    </AppShell>
  );
}
