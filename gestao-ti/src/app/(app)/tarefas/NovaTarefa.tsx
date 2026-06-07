"use client";

import { useState } from "react";
import { criarTarefa } from "./actions";
import { PRIORIDADES, CATEGORIAS } from "@/lib/constants";

type Opcao = { id: string; nome: string };

export default function NovaTarefa({ equipe, projetos }: { equipe: Opcao[]; projetos: Opcao[] }) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        + Nova tarefa
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await criarTarefa(fd);
        setAberto(false);
      }}
      className="space-y-3 rounded-xl border bg-white p-4 shadow-sm"
    >
      <input
        name="titulo"
        required
        placeholder="Título da tarefa"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <textarea
        name="descricao"
        placeholder="Descrição (opcional)"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <select name="prioridade" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" defaultValue="Médio">
          {PRIORIDADES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select name="categoria" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" defaultValue="Suporte">
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="responsavel_id" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" defaultValue="">
          <option value="">— Responsável —</option>
          {equipe.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <input name="prazo" type="date" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
      </div>
      <select name="projeto_id" className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" defaultValue="">
        <option value="">— Projeto (opcional) —</option>
        {projetos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Salvar
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600">
          Cancelar
        </button>
      </div>
    </form>
  );
}
