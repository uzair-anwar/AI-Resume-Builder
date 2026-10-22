"use client";

import dynamic from "next/dynamic";

/** The workspace restores a draft from sessionStorage, so it only renders in the browser. */
import { PageLoader } from "@/components/ui/PageLoader";

const HomeWorkspace = dynamic(() => import("@/components/tailor/HomeWorkspace"), {
  ssr: false,
  loading: () => <PageLoader />,
});

export default function HomeWorkspaceClient() {
  return <HomeWorkspace />;
}
