import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import type { Usuario } from "@/types/usuario";

import { db } from "./firebaseConfig";
import { EQUIPE_PADRAO } from "@/constants/acesso";

export function usuariosCollection() {
  return collection(db, "usuarios");
}

export function usuarioDoc(usuarioId: string) {
  return doc(db, "usuarios", usuarioId);
}

export function buscarUsuario(usuarioId: string) {
  return getDoc(usuarioDoc(usuarioId));
}

export async function buscarPerfilUsuario(usuarioId: string) {
  const usuarioSnap = await buscarUsuario(usuarioId);

  if (!usuarioSnap.exists()) {
    return null;
  }

  return {
    id: usuarioSnap.id,
    ...usuarioSnap.data(),
  } as Usuario;
}

export function criarUsuario(usuarioId: string, dados: Record<string, any>) {
  return setDoc(usuarioDoc(usuarioId), dados);
}

export function consultaPromotores(equipeId = EQUIPE_PADRAO) {
  return query(
    usuariosCollection(),
    where("tipo", "==", "promotor"),
    where("equipeId", "==", equipeId),
  );
}

export function consultaAdministradores() {
  return query(
    usuariosCollection(),
    where("tipo", "in", ["admin", "super_admin"]),
  );
}

export function atualizarUsuario(usuarioId: string, dados: Record<string, any>) {
  return updateDoc(usuarioDoc(usuarioId), dados);
}

export function atualizarDadosPerfilUsuario(
  usuarioId: string,
  dados: { nome: string; email: string },
) {
  return atualizarUsuario(usuarioId, {
    nome: dados.nome,
    email: dados.email,
    atualizadoEm: serverTimestamp(),
  });
}

export function excluirUsuario(usuarioId: string) {
  return deleteDoc(usuarioDoc(usuarioId));
}
