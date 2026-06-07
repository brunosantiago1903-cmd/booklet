export const PRIORIDADES = ["Crítico", "Alto", "Médio", "Baixo"] as const;
export const STATUS_TAREFA = ["A fazer", "Em andamento", "Bloqueado", "Concluído"] as const;
export const STATUS_PROJETO = ["Planejado", "Em andamento", "Pausado", "Concluído"] as const;
export const STATUS_CHAMADO = ["Aberto", "Em atendimento", "Resolvido", "Cancelado"] as const;
export const CATEGORIAS = ["Suporte", "Infraestrutura", "Sistemas", "LGPD", "Administrativo"] as const;

export const corPrioridade: Record<string, string> = {
  "Crítico": "bg-red-100 text-red-800",
  "Alto": "bg-orange-100 text-orange-800",
  "Médio": "bg-yellow-100 text-yellow-800",
  "Baixo": "bg-green-100 text-green-800",
};

export const corStatus: Record<string, string> = {
  "A fazer": "bg-slate-200 text-slate-700",
  "Em andamento": "bg-blue-100 text-blue-800",
  "Bloqueado": "bg-red-100 text-red-800",
  "Concluído": "bg-green-100 text-green-800",
  "Aberto": "bg-amber-100 text-amber-800",
  "Em atendimento": "bg-blue-100 text-blue-800",
  "Resolvido": "bg-green-100 text-green-800",
  "Cancelado": "bg-slate-200 text-slate-600",
  "Planejado": "bg-slate-200 text-slate-700",
  "Pausado": "bg-orange-100 text-orange-800",
};

/** Situação do prazo a partir de uma data ISO. */
export function situacaoPrazo(prazo: string | null, status: string): string {
  if (status === "Concluído") return "✅ Concluída";
  if (!prazo) return "⚪ Sem prazo";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(prazo);
  d.setHours(0, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return "🔴 Atrasada";
  if (dias === 0) return "🟡 Hoje";
  if (dias <= 7) return "🟢 Esta semana";
  return "⚪ Futura";
}
