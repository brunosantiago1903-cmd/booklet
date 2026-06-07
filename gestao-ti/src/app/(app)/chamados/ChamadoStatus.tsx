"use client";

import { mudarStatusChamado } from "./actions";
import { STATUS_CHAMADO, corStatus } from "@/lib/constants";

export default function ChamadoStatus({ id, status }: { id: string; status: string }) {
  return (
    <select
      defaultValue={status}
      onChange={(e) => mudarStatusChamado(id, e.target.value)}
      className={`badge cursor-pointer border-0 ${corStatus[status] ?? "bg-slate-200"}`}
    >
      {STATUS_CHAMADO.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
