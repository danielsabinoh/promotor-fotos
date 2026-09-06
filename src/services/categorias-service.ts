import {
  collection,
  doc,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  chaveCategoria,
  montarCatalogoCategorias,
  validarNomeCategoria,
  type CategoriaConfigurada,
  type RegistroCategoria,
} from "../utils/catalogo-categorias";
import { auth, db } from "./firebaseConfig";

export function categoriasCollection() {
  return collection(db, "categorias_foto");
}

export function lerRegistroCategoria(dados: Record<string, unknown>): RegistroCategoria {
  if (typeof dados.nome !== "string" || !dados.nome.trim() || typeof dados.ativa !== "boolean") {
    throw new Error("Uma categoria possui dados invalidos. Contate o administrador.");
  }
  return { nome: dados.nome, ativa: dados.ativa };
}

export async function buscarCatalogoCategorias() {
  const snapshot = await getDocsFromServer(categoriasCollection());
  return montarCatalogoCategorias(snapshot.docs.map((item) => lerRegistroCategoria(item.data())));
}

function usuarioId() {
  if (!auth.currentUser) throw new Error("Entre novamente para alterar as categorias.");
  return auth.currentUser.uid;
}

export async function cadastrarCategoria(nome: string, ativa: boolean) {
  const nomeLimpo = validarNomeCategoria(nome);
  const id = chaveCategoria(nomeLimpo);
  if (montarCatalogoCategorias([]).some((categoria) => categoria.id === id)) {
    throw new Error("Esta categoria ja existe na lista de categorias padrao.");
  }
  const atualizadoPor = usuarioId();
  const referencia = doc(categoriasCollection(), id);
  await runTransaction(db, async (transaction) => {
    const existente = await transaction.get(referencia);
    if (existente.exists()) throw new Error("Ja existe uma categoria com este nome, mesmo que esteja desativada.");
    transaction.set(referencia, {
      nome: nomeLimpo,
      ativa,
      atualizadoPor,
      atualizadoEm: serverTimestamp(),
    });
  });
}

export function alterarCategoriaAtiva(categoria: CategoriaConfigurada, ativa: boolean) {
  // O nome permanece estavel porque as fotos existentes o usam como identificador.
  return setDoc(doc(categoriasCollection(), categoria.id), {
    nome: categoria.valor,
    ativa,
    atualizadoPor: usuarioId(),
    atualizadoEm: serverTimestamp(),
  });
}
