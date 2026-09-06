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

const { EQUIPE_PADRAO, emailParecePessoal } = require("../src/constants/acesso.ts");

function prepararServico(resultado = { ok: true }) {
  const chamadas = [];
  const arquivo = path.resolve(__dirname, "../src/services/gestao-acessos.ts");
  const modulo = new Module(arquivo, module);
  modulo.require = (nome) => {
    if (nome === "firebase/functions") {
      return {
        getFunctions: (app, regiao) => ({ app, regiao }),
        httpsCallable: (functions, funcao) => async (dados) => {
          chamadas.push({ functions, funcao, dados });
          return { data: resultado };
        },
      };
    }
    if (nome === "./firebaseConfig") return { firebaseApp: "app" };
    throw new Error(`Dependencia inesperada: ${nome}`);
  };
  modulo._compile(compilar(arquivo), arquivo);
  return { servico: modulo.exports, chamadas };
}

test("identifica provedores pessoais sem proibir seu uso", () => {
  assert.equal(emailParecePessoal(" Pessoa@GMAIL.com "), true);
  assert.equal(emailParecePessoal("pessoa@empresa.com.br"), false);
  assert.equal(EQUIPE_PADRAO, "instalacao-principal");
});

test("convite envia somente dados permitidos para a Function regional", async () => {
  const { servico, chamadas } = prepararServico({ uid: "p1" });
  await servico.convidarPromotor({ nome: "Maria", email: "maria@empresa.com", lojasIds: ["l1"] });
  assert.deepEqual(chamadas[0], {
    functions: { app: "app", regiao: "southamerica-east1" },
    funcao: "convidarPromotor",
    dados: { nome: "Maria", email: "maria@empresa.com", lojasIds: ["l1"] },
  });
  assert.equal("senha" in chamadas[0].dados, false);
});

test("status, edicao e emails usam operacoes administrativas dedicadas", async () => {
  const { servico, chamadas } = prepararServico();
  await servico.atualizarPromotorAdministrativamente("p1", { nome: "Maria", email: "maria@empresa.com", lojasIds: ["l1"] });
  await servico.alterarStatusPromotor("p1", false);
  await servico.reenviarConvitePromotor("p1");
  await servico.enviarRedefinicaoSenhaPromotor("p1");
  assert.deepEqual(chamadas.map((item) => item.funcao), [
    "atualizarPromotor",
    "alterarStatusPromotor",
    "reenviarConvitePromotor",
    "enviarRedefinicaoSenhaPromotor",
  ]);
});

test("backend revoga sessoes e regras bloqueiam gestao direta pelo cliente", () => {
  const backend = readFileSync(path.resolve(__dirname, "../functions/index.js"), "utf8");
  const regras = readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8");
  assert.match(backend, /auth\.revokeRefreshTokens\(promotor\.uid\)/);
  assert.match(backend, /"promotor_reativado"\s*:\s*"promotor_desativado"/);
  assert.match(backend, /statusAcesso:\s*"convite_pendente"/);
  assert.match(regras, /Promotores sao provisionados somente pelo Admin SDK/);
  assert.match(regras, /match \/auditoria_acessos\/\{eventoId\}/);
  assert.match(regras, /allow create, update, delete: if false/);
});
