import type { StatusFoto } from "./foto";

export type StatusAvaliacao = Exclude<StatusFoto, "pendente">;

export type AvaliacaoFoto = {
  id: string;
  statusAnterior: string;
  status: StatusAvaliacao;
  comentario: string;
  adminId: string;
  adminNome: string;
  criadoEm: any;
};
