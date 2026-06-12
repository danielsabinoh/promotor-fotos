import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebaseConfig";

type FotoNotificavel = {
  id: string;
  lojaNome?: string;
  promotorId?: string;
};

function dadosNotificacao(status: string, lojaNome: string, comentario: string) {
  if (status === "aprovada") {
    return {
      tipo: "foto_aprovada",
      titulo: "Foto aprovada",
      mensagem: `Sua foto da loja ${lojaNome} foi aprovada.`,
    };
  }

  if (status === "refazer") {
    return {
      tipo: "foto_refazer",
      titulo: "Foto precisa ser refeita",
      mensagem:
        comentario ||
        `O responsável solicitou uma nova foto da loja ${lojaNome}.`,
    };
  }

  return {
    tipo: "foto_rejeitada",
    titulo: "Foto rejeitada",
    mensagem:
      comentario || `Sua foto da loja ${lojaNome} foi rejeitada.`,
  };
}

export async function atualizarFotoComNotificacao({
  foto,
  status,
  comentario,
}: {
  foto: FotoNotificavel;
  status: string;
  comentario: string;
}) {
  const batch = writeBatch(db);
  const comentarioLimpo = comentario.trim();
  const fotoRef = doc(db, "fotos", foto.id);

  batch.update(fotoRef, {
    status,
    comentarioAdmin: status === "aprovada" ? "" : comentarioLimpo,
    avaliadaEm: serverTimestamp(),
  });

  if (foto.promotorId) {
    const notificacao = dadosNotificacao(
      status,
      foto.lojaNome || "Loja não informada",
      comentarioLimpo,
    );
    const notificacaoRef = doc(collection(db, "notificacoes"));

    batch.set(notificacaoRef, {
      ...notificacao,
      destinatarioId: foto.promotorId,
      fotoId: foto.id,
      lojaNome: foto.lojaNome || "",
      status,
      comentarioAdmin: status === "aprovada" ? "" : comentarioLimpo,
      lida: false,
      criadoEm: serverTimestamp(),
    });
  }

  await batch.commit();
}
