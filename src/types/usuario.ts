export type TipoUsuario = "promotor" | "admin" | "super_admin";
export type StatusAcesso = "convite_pendente" | "ativo" | "inativo";

export type Usuario = {
  id: string;
  nome?: string;
  email?: string;
  tipo?: TipoUsuario | string;
  ativo?: boolean;
  lojasIds?: string[];
  criadoEm?: any;
  atualizadoEm?: any;
  equipeId?: string;
  statusAcesso?: StatusAcesso;
  conviteEnviadoEm?: any;
  conviteExpiraEm?: any;
  conviteAceitoEm?: any;
  criadoPorId?: string;
  desativadoEm?: any;
  desativadoPorId?: string;
  reativadoEm?: any;
  reativadoPorId?: string;
};

export type Promotor = Usuario & {
  tipo?: "promotor";
};

export type Administrador = Usuario & {
  tipo?: "admin" | "super_admin";
};
