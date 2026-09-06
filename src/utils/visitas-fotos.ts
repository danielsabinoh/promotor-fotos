import type { Foto, StatusFoto } from "../types/foto";
import { obterData } from "./datas";
import { obterStatusFoto } from "./status-foto";

export type VisitaFotos = {
  id: string;
  visitaId: string | null;
  fotos: Foto[];
  correspondentes: string[];
};

export function agruparFotosPorVisita(fotos: Foto[], correspondentes: Foto[] = fotos): VisitaFotos[] {
  const ids = new Set(correspondentes.map((foto) => foto.id));
  const grupos = new Map<string, VisitaFotos>();
  for (const foto of fotos) {
    // Sem identificador, nao inferimos uma visita pela loja ou pelo dia.
    const id = foto.visitaId
      ? JSON.stringify([foto.visitaId, foto.lojaId || foto.lojaNome || "", foto.promotorId || foto.promotorEmail || ""])
      : `foto:${foto.id}`;
    const grupo = grupos.get(id) ?? { id, visitaId: foto.visitaId || null, fotos: [], correspondentes: [] };
    grupo.fotos.push(foto);
    if (ids.has(foto.id)) grupo.correspondentes.push(foto.id);
    grupos.set(id, grupo);
  }
  return [...grupos.values()].filter((grupo) => grupo.correspondentes.length > 0).map((grupo) => ({
    ...grupo,
    fotos: [...grupo.fotos].sort((a, b) =>
      (a.indiceNaVisita || 0) - (b.indiceNaVisita || 0) ||
      (obterData(a.criadoEm)?.getTime() || 0) - (obterData(b.criadoEm)?.getTime() || 0) ||
      a.id.localeCompare(b.id),
    ),
  })).sort((a, b) =>
    Math.max(...b.fotos.map((foto) => obterData(foto.criadoEm)?.getTime() || 0)) -
    Math.max(...a.fotos.map((foto) => obterData(foto.criadoEm)?.getTime() || 0)),
  );
}

export function resumoStatusVisita(fotos: Foto[]): Record<StatusFoto, number> {
  const resumo: Record<StatusFoto, number> = { pendente: 0, aprovada: 0, refazer: 0, rejeitada: 0 };
  for (const foto of fotos) resumo[obterStatusFoto(foto.status)]++;
  return resumo;
}

export function descricaoAvaliacao(status?: string) {
  if (status === "aprovada") return "Aprovada";
  if (status === "rejeitada") return "Rejeitada";
  if (status === "refazer") return "Refacao solicitada";
  return "Pendente";
}

export function textoRastreioFoto(foto: Foto) {
  if (!foto.avaliadaPorId) {
    return obterStatusFoto(foto.status) === "pendente"
      ? "Aguardando avaliacao"
      : `${descricaoAvaliacao(foto.status)}: responsavel nao registrado${foto.avaliadaEm ? ` em ${obterData(foto.avaliadaEm)?.toLocaleString("pt-BR") || "data nao disponivel"}` : ""}`;
  }
  const data = obterData(foto.avaliadaEm);
  return `${descricaoAvaliacao(foto.status)} por ${foto.avaliadaPorNome || "Administrador"}${data ? ` em ${data.toLocaleString("pt-BR")}` : " (sincronizando horario)"}`;
}
