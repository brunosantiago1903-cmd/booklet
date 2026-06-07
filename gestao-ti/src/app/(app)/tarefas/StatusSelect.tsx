"use client";

import { mudarStatus } from "./actions";
import { STATUS_TAREFA, corStatus } from "@/lib/constants";

export default function StatusSelect({ id, status }: { id: string; status: string }) {
  return (
    <select
      defaultValue={status}
      onChange={(e) => mudarStatus(id, e.target.value)}
      className={`badge cursor-pointer border-0 ${corStatus[status] ?? "bg-slate-200"}`}
    >
      {STATUS_TAREFA.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
