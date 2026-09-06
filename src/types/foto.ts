export type StatusFoto = "pendente" | "aprovada" | "refazer" | "rejeitada";

export type Foto = {
  id: string;
  lojaId?: string;
  lojaNome?: string;
  promotorId?: string;
  promotorNome?: string;
  promotorEmail?: string;
  observacao?: string;
  imagemBase64?: string;
  imagemUrl?: string;
  storagePath?: string;
  categoria?: string;
  status?: StatusFoto | string;
  comentarioAdmin?: string;
  criadoEm?: any;
  avaliadaEm?: any;
  avaliadaPorId?: string;
  avaliadaPorNome?: string;
  ultimaAvaliacaoId?: string;
  visitaId?: string | null;
  indiceNaVisita?: number;
  totalFotosVisita?: number;
  naLixeira?: boolean;
  excluidaEm?: any;
  excluidaPor?: string | null;
  refacaoDeId?: string | null;
  numeroRefacao?: number;
  motivoRefacao?: string;
};

export type DadosNovaFoto = Omit<Foto, "id">;
