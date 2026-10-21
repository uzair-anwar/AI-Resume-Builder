type Change = { factId: string; original: string; tailored: string };

export function ChangesPanel({ changes }: { changes: Change[] }) {
  if (!changes.length) {
    return <p className="text-sm text-zinc-500">No bullet rewrites to show.</p>;
  }
  return (
    <ul className="max-h-72 space-y-3 overflow-y-auto text-sm">
      {changes.map((c) => (
        <li key={c.factId} className="rounded border border-zinc-100 p-2 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Fact {c.factId}</p>
          <p className="line-through opacity-70">{c.original}</p>
          <p className="font-medium">{c.tailored}</p>
        </li>
      ))}
    </ul>
  );
}
