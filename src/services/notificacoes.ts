import {
  doc,
  collection,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebaseConfig";
import { fotoDoc } from "./fotos-service";
import { usuarioDoc } from "./usuarios-service";
import { notificacoesCollection } from "./notificacoes-service";
import type { Foto } from "../types/foto";

type FotoNotificavel = Pick<Foto, "id" | "lojaNome" | "promotorId">;

export function avaliacoesFotoCollection(fotoId: string) {
  return collection(fotoDoc(fotoId), "avaliacoes");
}

export function consultaAvaliacoesFoto(fotoId: string) {
  return query(avaliacoesFotoCollection(fotoId), orderBy("criadoEm", "desc"));
}

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
  const usuario = auth.currentUser;
  if (!usuario) throw new Error("Entre novamente para avaliar as fotos.");
  if (!["aprovada", "refazer", "rejeitada"].includes(status)) {
    throw new Error("Status de avaliacao invalido.");
  }
  const comentarioLimpo = comentario.trim();
  const comentarioFinal = status === "aprovada" ? "" : comentarioLimpo;
  const referencia = fotoDoc(foto.id);
  const avaliacaoRef = doc(avaliacoesFotoCollection(foto.id));
  const notificacaoRef = doc(notificacoesCollection());

  await runTransaction(db, async (transaction) => {
    const perfil = await transaction.get(usuarioDoc(usuario.uid));
    const atual = await transaction.get(referencia);
    const admin = perfil.data();
    if (!admin || admin.ativo === false || !["admin", "super_admin"].includes(admin.tipo)) {
      throw new Error("Apenas administradores ativos podem avaliar fotos.");
    }
    if (!atual.exists() || atual.data().naLixeira === true) {
      throw new Error("Esta foto foi removida. Atualize a lista de visitas.");
    }
    const dados = atual.data() as Foto;
    if (dados.status === status && (dados.comentarioAdmin || "") === comentarioFinal) return;
    const adminNome = typeof admin.nome === "string" ? admin.nome : "Administrador";
    const horario = serverTimestamp();
    transaction.update(referencia, {
      status,
      comentarioAdmin: comentarioFinal,
      avaliadaEm: horario,
      avaliadaPorId: usuario.uid,
      avaliadaPorNome: adminNome,
      ultimaAvaliacaoId: avaliacaoRef.id,
    });
    transaction.set(avaliacaoRef, {
      statusAnterior: dados.status || "pendente",
      status,
      comentario: comentarioFinal,
      adminId: usuario.uid,
      adminNome,
      criadoEm: horario,
    });
    if (dados.promotorId) {
      transaction.set(notificacaoRef, {
        ...dadosNotificacao(status, dados.lojaNome || "Loja nao informada", comentarioLimpo),
        destinatarioId: dados.promotorId,
        fotoId: foto.id,
        lojaNome: dados.lojaNome || "",
        status,
        comentarioAdmin: comentarioFinal,
        lida: false,
        criadoEm: horario,
      });
    }
  });
}

export async function aprovarFotosDaVisita(fotos: Foto[]) {
  const unicas = [...new Map(fotos.map((foto) => [foto.id, foto])).values()];
  let concluidas = 0;
  // Cada foto e sua notificacao/historico sao atomicos; uma falha informa o progresso real.
  for (const foto of unicas) {
    try {
      await atualizarFotoComNotificacao({ foto, status: "aprovada", comentario: "" });
      concluidas++;
    } catch (error) {
      throw new Error(`${concluidas} de ${unicas.length} fotos confirmadas como aprovadas. ${error instanceof Error ? error.message : "Nao foi possivel concluir a visita."}`);
    }
  }
}
