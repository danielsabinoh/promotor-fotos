const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

function compilar(arquivo) {
  return ts.transpileModule(readFileSync(arquivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
require.extensions[".ts"] = (modulo, arquivo) => modulo._compile(compilar(arquivo), arquivo);
const { agruparFotosPorVisita, resumoStatusVisita, textoRastreioFoto } = require("../src/utils/visitas-fotos.ts");

const fotos = [
  { id: "b", visitaId: "v1", lojaId: "l1", promotorId: "p1", indiceNaVisita: 2, categoria: "Preco", status: "aprovada", criadoEm: new Date("2026-09-05T13:01:00Z") },
  { id: "a", visitaId: "v1", lojaId: "l1", promotorId: "p1", indiceNaVisita: 1, categoria: "Gondola", status: "pendente", criadoEm: new Date("2026-09-05T13:00:00Z") },
  { id: "c", visitaId: "v2", lojaId: "l1", promotorId: "p1", indiceNaVisita: 1, status: "refazer", criadoEm: new Date("2026-09-06T13:00:00Z") },
];

test("visitas agrupam fotos em ordem e ordenam o feed por data", () => {
  const grupos = agruparFotosPorVisita(fotos);
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].visitaId, "v2");
  assert.deepEqual(grupos[1].fotos.map((foto) => foto.id), ["a", "b"]);
});
test("filtro encontra visitas sem esconder as outras fotos da visita", () => {
  const [grupo] = agruparFotosPorVisita(fotos, [fotos[0]]);
  assert.equal(grupo.fotos.length, 2);
  assert.deepEqual(grupo.correspondentes, ["b"]);
});
test("envios antigos nao sao agrupados por coincidencia de dia ou loja", () => {
  assert.equal(agruparFotosPorVisita(fotos.map((foto) => ({ ...foto, visitaId: null }))).length, 3);
});
test("dados inconsistentes de promotor ou loja nao misturam visitas", () => {
  assert.equal(agruparFotosPorVisita([fotos[0], { ...fotos[1], promotorId: "outro" }]).length, 2);
});
test("resumo da visita mostra a contagem individual de cada status", () => {
  assert.deepEqual(resumoStatusVisita(fotos), { pendente: 1, aprovada: 1, refazer: 1, rejeitada: 0 });
});
test("avaliacoes legadas nao inventam o nome do responsavel", () => {
  assert.match(textoRastreioFoto({ id: "x", status: "aprovada" }), /responsavel nao registrado/);
  assert.equal(textoRastreioFoto({ id: "x", status: "pendente" }), "Aguardando avaliacao");
  assert.match(textoRastreioFoto({ id: "x", status: "aprovada", avaliadaPorId: "admin1", avaliadaPorNome: "Ana", avaliadaEm: new Date("2026-09-05T13:00:00Z") }), /Aprovada por Ana em/);
});

// Dublos do Firestore verificam as escritas produzidas pelo servico, sem acessar o banco real.
function prepararServico() {
  const dados = new Map([
    ["usuarios/admin1", { nome: "Ana", tipo: "admin", ativo: true }],
    ["fotos/f1", { status: "pendente", promotorId: "p1", lojaNome: "Loja real" }],
    ["fotos/f2", { status: "pendente", promotorId: "p1", lojaNome: "Loja real" }],
  ]);
  let id = 0;
  let falhar = false;
  const auth = { currentUser: { uid: "admin1" } };
  const timestamp = { servidor: true };
  const firestore = {
    collection: (referencia, nome) => `${referencia}/${nome}`,
    doc: (referencia) => { const novoId = `log${++id}`; return { id: novoId, path: `${referencia}/${novoId}` }; },
    serverTimestamp: () => timestamp,
    runTransaction: async (_, executar) => {
      const escritas = [];
      const resultado = await executar({
        get: async (referencia) => ({ exists: () => dados.has(referencia), data: () => dados.get(referencia) }),
        update: (referencia, valor) => escritas.push([referencia, { ...dados.get(referencia), ...valor }]),
        set: (referencia, valor) => escritas.push([referencia.path || referencia, valor]),
      });
      if (falhar) throw new Error("Falha de conexao");
      for (const [referencia, valor] of escritas) dados.set(referencia, valor);
      return resultado;
    },
  };
  const arquivo = path.resolve(__dirname, "../src/services/notificacoes.ts");
  const modulo = new Module(arquivo, module);
  const dependencias = {
    "firebase/firestore": firestore,
    "./firebaseConfig": { auth, db: {} },
    "./fotos-service": { fotoDoc: (fotoId) => `fotos/${fotoId}` },
    "./usuarios-service": { usuarioDoc: (usuarioId) => `usuarios/${usuarioId}` },
    "./notificacoes-service": { notificacoesCollection: () => "notificacoes" },
  };
  modulo.require = (nome) => {
    assert.ok(nome in dependencias, `Dependencia inesperada: ${nome}`);
    return dependencias[nome];
  };
  modulo._compile(compilar(arquivo), arquivo);
  return { servico: modulo.exports, dados, auth, timestamp, falhar: () => { falhar = true; } };
}

test("avaliacao registra usuario autenticado, horario de servidor e notificacao correta", async () => {
  const { servico, dados, timestamp } = prepararServico();
  await servico.atualizarFotoComNotificacao({ foto: { id: "f1", promotorId: "injetado" }, status: "aprovada", comentario: "ignorado" });
  const foto = dados.get("fotos/f1");
  assert.equal(foto.avaliadaPorId, "admin1");
  assert.equal(foto.avaliadaPorNome, "Ana");
  assert.equal(foto.avaliadaEm, timestamp);
  const registro = dados.get(`fotos/f1/avaliacoes/${foto.ultimaAvaliacaoId}`);
  assert.equal(registro.statusAnterior, "pendente");
  assert.equal(registro.status, "aprovada");
  const notificacao = [...dados.entries()].find(([chave]) => chave.startsWith("notificacoes/"))[1];
  assert.equal(notificacao.destinatarioId, "p1");
});
test("troca de status preserva os dois eventos e repetir aprovacao nao duplica eventos", async () => {
  const { servico, dados } = prepararServico();
  const pedido = { foto: { id: "f1" }, status: "aprovada", comentario: "" };
  await servico.atualizarFotoComNotificacao(pedido);
  await servico.atualizarFotoComNotificacao(pedido);
  await servico.atualizarFotoComNotificacao({ ...pedido, status: "rejeitada", comentario: "  Enquadramento incorreto  " });
  const registros = [...dados.entries()].filter(([chave]) => chave.includes("/avaliacoes/"));
  assert.equal(registros.length, 2);
  assert.equal(registros[1][1].statusAnterior, "aprovada");
  assert.equal(registros[1][1].comentario, "Enquadramento incorreto");
});
test("falha de gravacao nao deixa status alterado sem historico", async () => {
  const contexto = prepararServico();
  contexto.falhar();
  await assert.rejects(contexto.servico.atualizarFotoComNotificacao({ foto: { id: "f1" }, status: "aprovada", comentario: "" }));
  assert.equal(contexto.dados.get("fotos/f1").status, "pendente");
  assert.equal([...contexto.dados.keys()].filter((chave) => chave.includes("/avaliacoes/")).length, 0);
});
test("promotor ou admin desativado nao avalia", async () => {
  for (const perfil of [{ tipo: "promotor", ativo: true }, { tipo: "admin", ativo: false }]) {
    const { servico, dados } = prepararServico();
    dados.set("usuarios/admin1", perfil);
    await assert.rejects(servico.atualizarFotoComNotificacao({ foto: { id: "f1" }, status: "aprovada", comentario: "" }), /administradores ativos/);
    assert.equal(dados.get("fotos/f1").status, "pendente");
  }
});
test("aprovacao da visita registra cada foto e nao duplica ids", async () => {
  const { servico, dados } = prepararServico();
  await servico.aprovarFotosDaVisita([{ id: "f1" }, { id: "f2" }, { id: "f1" }]);
  assert.equal(dados.get("fotos/f1").status, "aprovada");
  assert.equal(dados.get("fotos/f2").status, "aprovada");
  assert.equal([...dados.keys()].filter((chave) => chave.includes("/avaliacoes/")).length, 2);
});
test("aprovacao parcial informa o progresso quando uma foto foi removida", async () => {
  const { servico, dados } = prepararServico();
  await assert.rejects(servico.aprovarFotosDaVisita([{ id: "f1" }, { id: "removida" }, { id: "f2" }]), /1 de 3 fotos/);
  assert.equal(dados.get("fotos/f1").status, "aprovada");
  assert.equal(dados.get("fotos/f2").status, "pendente");
});
