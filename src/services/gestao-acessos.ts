import { getFunctions, httpsCallable } from "firebase/functions";

import { firebaseApp } from "./firebaseConfig";

const functions = getFunctions(firebaseApp, "southamerica-east1");

type DadosPromotor = {
  nome: string;
  email: string;
  lojasIds: string[];
  fotoBase64?: string;
};

function mensagemErro(error: unknown) {
  const mensagem = (error as { message?: string })?.message || "Nao foi possivel concluir a operacao.";
  return mensagem.replace(/^Firebase:\s*/i, "").replace(/\s*\(functions\/[\w-]+\)\.?$/i, "");
}

async function chamar<TEntrada, TSaida>(nome: string, dados: TEntrada) {
  try {
    const resposta = await httpsCallable<TEntrada, TSaida>(functions, nome)(dados);
    return resposta.data;
  } catch (error) {
    throw new Error(mensagemErro(error));
  }
}

export function convidarPromotor(dados: DadosPromotor) {
  return chamar<DadosPromotor, { uid: string; conviteExpiraEm: string; emailPessoal: boolean }>("convidarPromotor", dados);
}

export function reenviarConvitePromotor(uid: string) {
  return chamar<{ uid: string }, { conviteExpiraEm: string }>("reenviarConvitePromotor", { uid });
}

export function enviarRedefinicaoSenhaPromotor(uid: string) {
  return chamar<{ uid: string }, { ok: true }>("enviarRedefinicaoSenhaPromotor", { uid });
}

export function atualizarPromotorAdministrativamente(uid: string, dados: DadosPromotor) {
  return chamar<DadosPromotor & { uid: string }, { ok: true }>("atualizarPromotor", { uid, ...dados });
}

export function alterarStatusPromotor(uid: string, ativo: boolean) {
  return chamar<{ uid: string; ativo: boolean }, { ok: true }>("alterarStatusPromotor", { uid, ativo });
}

export function aceitarConvitePendente() {
  return chamar<Record<string, never>, { status: "ativo" }>("aceitarConvite", {});
}

export function migrarEquipeLegada() {
  return chamar<Record<string, never>, { migrados: number; equipeId: string }>("migrarEquipeLegada", {});
}
