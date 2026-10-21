"use client";

import dynamic from "next/dynamic";

/** The workspace restores a draft from sessionStorage, so it only renders in the browser. */
const HomeWorkspace = dynamic(() => import("./HomeWorkspace"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-zinc-500">Loading…</p>,
});

export default function HomeWorkspaceClient() {
  return <HomeWorkspace />;
}
