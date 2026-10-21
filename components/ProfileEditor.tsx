"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MasterResume } from "@/lib/schemas/resume";
import { loadProfileOverride, saveProfileOverride } from "@/lib/client/profile-storage";

export function ProfileEditor() {
  const [master, setMaster] = useState<MasterResume | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [attestName, setAttestName] = useState("");
  const [attestLevel, setAttestLevel] = useState<"familiar" | "proficient" | "expert">("proficient");

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
      const parsed = JSON.parse(jsonText) as { attestedSkills?: { id: string; name: string; categoryId: string; level: string }[] };
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

  if (!master) return <p className="p-8 text-sm">Loading profile…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Master resume is server-side from <code>Uzair_FullStack.pdf</code>. Overrides are stored in your browser only.
      </p>

      <section className="rounded border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="font-medium">Add user-attested skill</h2>
        <p className="text-xs text-zinc-500">Appears in skills only; bullets still need verified facts.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="rounded border px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="e.g. Java"
            value={attestName}
            onChange={(e) => setAttestName(e.target.value)}
          />
          <select
            className="rounded border px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            value={attestLevel}
            onChange={(e) => setAttestLevel(e.target.value as typeof attestLevel)}
          >
            <option value="familiar">Familiar</option>
            <option value="proficient">Proficient</option>
            <option value="expert">Expert</option>
          </select>
          <button type="button" className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900" onClick={addAttestedSkill}>
            Add
          </button>
        </div>
      </section>

      <label className="block text-sm">
        Override JSON (import/export)
        <textarea
          className="mt-1 w-full rounded border font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
          rows={16}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
      </label>
      <div className="flex gap-3">
        <button type="button" onClick={save} className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          Save override
        </button>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            saveProfileOverride(null);
            setJsonText(JSON.stringify({ attestedSkills: [] }, null, 2));
            setMessage("Cleared override.");
          }}
        >
          Clear override
        </button>
      </div>
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      <Link href="/" className="text-sm underline">Back to tailor</Link>
    </div>
  );
}
