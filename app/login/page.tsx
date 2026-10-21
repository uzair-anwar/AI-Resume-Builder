"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function LoginForm() {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    if (!res.ok) {
      setError("Invalid passphrase");
      return;
    }
    router.push(params.get("from") ?? "/");
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
      <h1 className="text-lg font-semibold">Resume Tailor</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Enter the access passphrase.</p>
      <input
        type="password"
        className="w-full rounded border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        autoComplete="current-password"
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
        Continue
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
