const { randomBytes } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();
const firebaseWebApiKey = defineString("WEB_API_KEY");
const EQUIPE_PADRAO = "instalacao-principal";
const VALIDADE_CONVITE_MS = 60 * 60 * 1000;
const PROVEDORES_PESSOAIS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com",
  "yahoo.com.br", "icloud.com", "bol.com.br", "uol.com.br", "terra.com.br",
]);

function texto(valor, campo, minimo = 2, maximo = 160) {
  const limpo = typeof valor === "string" ? valor.trim() : "";
  if (limpo.length < minimo || limpo.length > maximo) {
    throw new HttpsError("invalid-argument", `${campo} invalido.`);
  }
  return limpo;
}

function emailValido(valor) {
  const email = texto(valor, "Email", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Email invalido.");
  }
  return email;
}

function lojasValidas(valor) {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > 200) {
    throw new HttpsError("invalid-argument", "Selecione pelo menos uma loja.");
  }
  const ids = [...new Set(valor.map((id) => texto(id, "Loja", 1, 160)))];
  return ids;
}

function equipeDo(perfil) {
  return perfil.equipeId || EQUIPE_PADRAO;
}

async function administradorDaRequisicao(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Entre novamente.");
  const snap = await db.doc(`usuarios/${request.auth.uid}`).get();
  const perfil = snap.data();
  if (!perfil || perfil.ativo === false || !["admin", "super_admin"].includes(perfil.tipo)) {
    throw new HttpsError("permission-denied", "Apenas administradores ativos podem realizar esta acao.");
  }
  return { uid: request.auth.uid, ...perfil, equipeId: equipeDo(perfil) };
}

async function promotorDaEquipe(uid, admin) {
  const snap = await db.doc(`usuarios/${uid}`).get();
  const perfil = snap.data();
  if (!perfil || perfil.tipo !== "promotor" || equipeDo(perfil) !== admin.equipeId) {
    throw new HttpsError("not-found", "Promotor nao encontrado nesta equipe.");
  }
  return { uid, ref: snap.ref, ...perfil, equipeId: equipeDo(perfil) };
}

function auditoria(acao, admin, alvo, detalhes = {}) {
  return {
    acao,
    equipeId: admin.equipeId,
    realizadoPorId: admin.uid,
    realizadoPorNome: admin.nome || admin.email || "Administrador",
    usuarioAfetadoId: alvo.uid,
    usuarioAfetadoEmail: alvo.email || "",
    detalhes,
    criadoEm: FieldValue.serverTimestamp(),
  };
}

async function enviarEmailSenha(email) {
  const apiKey = firebaseWebApiKey.value();
  if (!apiKey) throw new HttpsError("failed-precondition", "WEB_API_KEY nao configurada nas Functions.");
  const resposta = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    console.error("Falha ao enviar email do Firebase Auth", resposta.status, corpo?.error?.message);
    throw new HttpsError("unavailable", "Nao foi possivel enviar o email agora.");
  }
}

async function registrarEnvioConvite(promotor, admin, acao) {
  await enviarEmailSenha(promotor.email);
  const agora = Timestamp.now();
  const expiraEm = Timestamp.fromMillis(agora.toMillis() + VALIDADE_CONVITE_MS);
  const batch = db.batch();
  batch.update(promotor.ref, {
    statusAcesso: "convite_pendente",
    ativo: false,
    conviteEnviadoEm: agora,
    conviteExpiraEm: expiraEm,
    atualizadoEm: agora,
  });
  batch.set(db.collection("auditoria_acessos").doc(), auditoria(acao, admin, promotor, { conviteExpiraEm: expiraEm }));
  await batch.commit();
  return expiraEm.toDate().toISOString();
}

exports.convidarPromotor = onCall(async (request) => {
  const admin = await administradorDaRequisicao(request);
  const nome = texto(request.data?.nome, "Nome", 2, 120);
  const email = emailValido(request.data?.email);
  const lojasIds = lojasValidas(request.data?.lojasIds);
  const fotoBase64 = typeof request.data?.fotoBase64 === "string" && request.data.fotoBase64.length <= 900000
    ? request.data.fotoBase64
    : undefined;
  let existente = null;
  try {
    existente = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
  if (existente) {
    const perfil = await promotorDaEquipe(existente.uid, admin).catch(() => null);
    if (perfil?.statusAcesso === "convite_pendente") {
      const conviteExpiraEm = await registrarEnvioConvite(perfil, admin, "convite_reenviado");
      return { uid: perfil.uid, conviteExpiraEm, emailPessoal: PROVEDORES_PESSOAIS.has(email.split("@")[1]) };
    }
    throw new HttpsError("already-exists", "Ja existe uma conta com este email.");
  }

  const usuario = await auth.createUser({
    email,
    displayName: nome,
    emailVerified: false,
    password: randomBytes(32).toString("base64url"),
    disabled: false,
  });
  const ref = db.doc(`usuarios/${usuario.uid}`);
  const promotor = { uid: usuario.uid, ref, nome, email, equipeId: admin.equipeId };
  try {
    const batch = db.batch();
    batch.set(ref, {
      nome,
      email,
      tipo: "promotor",
      equipeId: admin.equipeId,
      lojasIds,
      ativo: false,
      statusAcesso: "convite_pendente",
      primeiroAcesso: false,
      criadoPorId: admin.uid,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      ...(fotoBase64 ? { fotoBase64 } : {}),
    });
    batch.set(
      db.collection("auditoria_acessos").doc(),
      auditoria("promotor_criado", admin, promotor, { lojasIds }),
    );
    await batch.commit();
    const conviteExpiraEm = await registrarEnvioConvite(promotor, admin, "convite_enviado");
    return { uid: usuario.uid, conviteExpiraEm, emailPessoal: PROVEDORES_PESSOAIS.has(email.split("@")[1]) };
  } catch (error) {
    if (!(await ref.get()).exists) await auth.deleteUser(usuario.uid).catch(() => undefined);
    throw error;
  }
});

exports.reenviarConvitePromotor = onCall(async (request) => {
  const admin = await administradorDaRequisicao(request);
  const promotor = await promotorDaEquipe(texto(request.data?.uid, "Usuario", 1, 160), admin);
  if (promotor.statusAcesso !== "convite_pendente") {
    throw new HttpsError("failed-precondition", "Este convite ja foi aceito ou a conta esta inativa.");
  }
  const conviteExpiraEm = await registrarEnvioConvite(promotor, admin, "convite_reenviado");
  return { conviteExpiraEm };
});

exports.enviarRedefinicaoSenhaPromotor = onCall(async (request) => {
  const admin = await administradorDaRequisicao(request);
  const promotor = await promotorDaEquipe(texto(request.data?.uid, "Usuario", 1, 160), admin);
  if (promotor.statusAcesso === "convite_pendente") {
    throw new HttpsError("failed-precondition", "Reenvie o convite para esta conta.");
  }
  await enviarEmailSenha(promotor.email);
  await db.collection("auditoria_acessos").add(auditoria("redefinicao_senha_enviada", admin, promotor));
  return { ok: true };
});

exports.atualizarPromotor = onCall(async (request) => {
  const admin = await administradorDaRequisicao(request);
  const promotor = await promotorDaEquipe(texto(request.data?.uid, "Usuario", 1, 160), admin);
  const nome = texto(request.data?.nome, "Nome", 2, 120);
  const email = emailValido(request.data?.email);
  const lojasIds = lojasValidas(request.data?.lojasIds);
  const anterior = { nome: promotor.nome || "", email: promotor.email || "", lojasIds: promotor.lojasIds || [] };
  await auth.updateUser(promotor.uid, { displayName: nome, email });
  try {
    const batch = db.batch();
    batch.update(promotor.ref, { nome, email, lojasIds, atualizadoEm: FieldValue.serverTimestamp() });
    batch.set(db.collection("auditoria_acessos").doc(), auditoria("promotor_atualizado", admin, { ...promotor, email }, { anterior, atual: { nome, email, lojasIds } }));
    await batch.commit();
  } catch (error) {
    await auth.updateUser(promotor.uid, { displayName: promotor.nome || null, email: promotor.email }).catch(() => undefined);
    throw error;
  }
  return { ok: true };
});

exports.alterarStatusPromotor = onCall(async (request) => {
  const admin = await administradorDaRequisicao(request);
  const promotor = await promotorDaEquipe(texto(request.data?.uid, "Usuario", 1, 160), admin);
  if (promotor.statusAcesso === "convite_pendente") {
    throw new HttpsError("failed-precondition", "Convites pendentes nao podem ser reativados manualmente.");
  }
  const ativo = request.data?.ativo;
  if (typeof ativo !== "boolean") throw new HttpsError("invalid-argument", "Status invalido.");
  await auth.updateUser(promotor.uid, { disabled: !ativo });
  if (!ativo) await auth.revokeRefreshTokens(promotor.uid);
  try {
    const batch = db.batch();
    batch.update(promotor.ref, {
      ativo,
      statusAcesso: ativo ? "ativo" : "inativo",
      atualizadoEm: FieldValue.serverTimestamp(),
      ...(ativo ? { reativadoEm: FieldValue.serverTimestamp(), reativadoPorId: admin.uid } : { desativadoEm: FieldValue.serverTimestamp(), desativadoPorId: admin.uid }),
    });
    batch.set(db.collection("auditoria_acessos").doc(), auditoria(ativo ? "promotor_reativado" : "promotor_desativado", admin, promotor));
    await batch.commit();
  } catch (error) {
    await auth.updateUser(promotor.uid, { disabled: promotor.ativo === false }).catch(() => undefined);
    throw error;
  }
  return { ok: true };
});

exports.aceitarConvite = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Entre novamente.");
  const ref = db.doc(`usuarios/${request.auth.uid}`);
  const snap = await ref.get();
  const perfil = snap.data();
  if (!perfil) throw new HttpsError("not-found", "Cadastro nao encontrado.");
  if (perfil.ativo === true && perfil.statusAcesso !== "convite_pendente") return { status: "ativo" };
  if (perfil.statusAcesso !== "convite_pendente") {
    throw new HttpsError("permission-denied", "Este acesso esta desativado.");
  }
  if (!perfil.conviteExpiraEm || perfil.conviteExpiraEm.toMillis() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "O convite expirou. Solicite um novo envio ao administrador.");
  }
  const equipeId = equipeDo(perfil);
  const batch = db.batch();
  batch.update(ref, {
    ativo: true,
    statusAcesso: "ativo",
    conviteAceitoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection("auditoria_acessos").doc(), {
    acao: "convite_aceito",
    equipeId,
    realizadoPorId: request.auth.uid,
    realizadoPorNome: perfil.nome || perfil.email || "Promotor",
    usuarioAfetadoId: request.auth.uid,
    usuarioAfetadoEmail: perfil.email || "",
    detalhes: {},
    criadoEm: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { status: "ativo" };
});

exports.migrarEquipeLegada = onCall(async (request) => {
  const admin = await administradorDaRequisicao(request);
  const snapshot = await db.collection("usuarios").where("tipo", "==", "promotor").get();
  const legados = snapshot.docs.filter((item) => !item.data().equipeId);
  for (let inicio = 0; inicio < legados.length; inicio += 400) {
    const batch = db.batch();
    for (const item of legados.slice(inicio, inicio + 400)) {
      batch.update(item.ref, { equipeId: admin.equipeId, statusAcesso: item.data().ativo === false ? "inativo" : "ativo", atualizadoEm: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }
  if (legados.length) {
    await db.collection("auditoria_acessos").add(auditoria("equipe_legada_migrada", admin, { uid: "equipe", email: "" }, { quantidade: legados.length }));
  }
  return { migrados: legados.length, equipeId: admin.equipeId };
});
