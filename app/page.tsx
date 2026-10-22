import { AppShell } from "@/components/AppShell";
import HomeWorkspaceClient from "@/components/HomeWorkspaceClient";

export default function Home() {
  return (
    <AppShell>
      <main className="min-h-screen">
        <HomeWorkspaceClient />
      </main>
    </AppShell>
  );
}
