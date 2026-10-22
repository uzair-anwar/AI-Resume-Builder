"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageLoader } from "./PageLoader";
import { SectionCard } from "./SectionCard";
import type { MasterResume } from "@/lib/schemas/resume";
import { loadProfileOverride, saveProfileOverride } from "@/lib/client/profile-storage";

export function ProfileEditor() {
  const [master, setMaster] = useState<MasterResume | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [attestName, setAttestName] = useState("");
  const [attestLevel, setAttestLevel] = useState<"familiar" | "proficient" | "expert">(
    "proficient",
  );

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setMaster(data.master);
        const override = loadProfileOverride();
        setJsonText(JSON.stringify(override ?? { attestedSkills: [] }, null, 2));
      });
  }, []);

  function save() {
    try {
      const parsed = JSON.parse(jsonText);
      saveProfileOverride(parsed);
      setMessage("Saved locally in this browser.");
    } catch {
      setMessage("Invalid JSON");
    }
  }

  function addAttestedSkill() {
    if (!attestName.trim()) return;
    try {
      const parsed = JSON.parse(jsonText) as {
        attestedSkills?: { id: string; name: string; categoryId: string; level: string }[];
      };
      const list = parsed.attestedSkills ?? [];
      const id = `attest-${attestName.toLowerCase().replace(/\s+/g, "-")}`;
      list.push({
        id,
        name: attestName.trim(),
        categoryId: "cat-languages",
        level: attestLevel,
      });
      setJsonText(JSON.stringify({ ...parsed, attestedSkills: list }, null, 2));
      setAttestName("");
    } catch {
      setMessage("Invalid JSON");
    }
  }

  if (!master) return <PageLoader label="Loading profile" />;

  return (
    <div className="page-gutter mx-auto w-full max-w-5xl space-y-6 py-6">
      <header className="space-y-2">
        <p className="section-label">Settings</p>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-gradient">Profile</span>
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Master resume is server-side from <code className="rounded bg-zinc-200/60 px-1 dark:bg-zinc-800">Uzair_FullStack.pdf</code>. Overrides are stored in
          your browser only.
        </p>
      </header>

      <SectionCard>
        <h2 className="font-medium">Add user-attested skill</h2>
        <p className="text-xs text-zinc-500">
          Appears in skills only; bullets still need verified facts.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="input-field !mt-0 max-w-xs"
            placeholder="e.g. Java"
            value={attestName}
            onChange={(e) => setAttestName(e.target.value)}
          />
          <select
            className="input-field !mt-0"
            value={attestLevel}
            onChange={(e) => setAttestLevel(e.target.value as typeof attestLevel)}
          >
            <option value="familiar">Familiar</option>
            <option value="proficient">Proficient</option>
            <option value="expert">Expert</option>
          </select>
          <button
            type="button"
            className="btn-primary !text-sm"
            onClick={addAttestedSkill}
          >
            Add
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Override JSON" subtitle="Import/export browser-only profile overrides.">
      <label className="block text-sm font-medium">
        <textarea
          className="input-field font-mono text-xs"
          rows={16}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={save}
          className="btn-primary"
        >
          Save override
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            saveProfileOverride(null);
            setJsonText(JSON.stringify({ attestedSkills: [] }, null, 2));
            setMessage("Cleared override.");
          }}
        >
          Clear override
        </button>
      </div>
      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      </SectionCard>
      <Link href="/" className="btn-ghost inline-flex">
        ← Back to tailor
      </Link>
    </div>
  );
}
