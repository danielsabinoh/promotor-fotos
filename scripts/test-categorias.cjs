const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

// Executa a logica de dominio sem carregar React Native ou conectar ao Firebase.
require.extensions[".ts"] = (modulo, arquivo) => {
  const { outputText } = ts.transpileModule(readFileSync(arquivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  modulo._compile(outputText, arquivo);
};

const {
  chaveCategoria, validarNomeCategoria, montarCatalogoCategorias,
  categoriaEstaAtiva, categoriasParaFiltro,
} = require("../src/utils/catalogo-categorias.ts");
const { CATEGORIAS_FOTO } = require("../src/constants/categorias-foto.ts");
const {
  CATEGORIA_RELATORIO_ESTOQUE, CATEGORIA_RELATORIO_ESTOQUE_LEGADA,
  CATEGORIA_AVARIA_DEVOLUCAO, tipoOcorrenciaPorCategoria,
} = require("../src/constants/estoque.ts");

test("instalacao sem configuracao conserva todas as categorias atuais", () => {
  const catalogo = montarCatalogoCategorias([]);
  assert.deepEqual(catalogo.map((item) => item.valor), CATEGORIAS_FOTO.map((item) => item.valor));
  assert.ok(catalogo.every((item) => item.ativa && item.padrao));
});

test("desativacao persiste sem remover a categoria do historico", () => {
  const catalogo = montarCatalogoCategorias([{ nome: "Gondola", ativa: false }]);
  assert.equal(catalogo.length, CATEGORIAS_FOTO.length);
  assert.equal(categoriaEstaAtiva("Gondola", catalogo), false);
  assert.ok(categoriasParaFiltro(catalogo, []).includes("Gondola"));
  assert.equal(categoriaEstaAtiva("Gondola", montarCatalogoCategorias([{ nome: "Gondola", ativa: true }])), true);
});

test("categorias personalizadas ativas e inativas usam nomes estaveis", () => {
  const catalogo = montarCatalogoCategorias([{ nome: "Material promocional", ativa: true }, { nome: "Fachada", ativa: false }]);
  assert.equal(categoriaEstaAtiva("Material promocional", catalogo), true);
  assert.equal(categoriaEstaAtiva("Fachada", catalogo), false);
  assert.equal(catalogo.find((item) => item.valor === "Material promocional").padrao, false);
});

test("chaves ignoram caixa, acentos e espacos duplicados para evitar duplicatas", () => {
  assert.equal(chaveCategoria("  G\u00f4ndola  "), chaveCategoria("Gondola"));
  assert.equal(chaveCategoria("Material   Promocional"), chaveCategoria("material promocional"));
  assert.ok(!chaveCategoria("Avaria / Devolucao").includes("/"));
});

test("nomes invalidos e reservados sao recusados", () => {
  for (const nome of ["", " ", "a", "a".repeat(61), "TODAS", "Sem categoria", CATEGORIA_RELATORIO_ESTOQUE_LEGADA]) {
    assert.throws(() => validarNomeCategoria(nome));
  }
  assert.equal(validarNomeCategoria("  Material   promocional  "), "Material promocional");
});

test("filtros preservam fotos legadas, categorias inativas e valores antigos sem duplicar", () => {
  const filtros = categoriasParaFiltro(montarCatalogoCategorias([{ nome: "Gondola", ativa: false }]), ["Gondola", "Antiga", CATEGORIA_RELATORIO_ESTOQUE_LEGADA, "Antiga"]);
  assert.ok(filtros.includes("Antiga"));
  assert.ok(filtros.includes(CATEGORIA_RELATORIO_ESTOQUE_LEGADA));
  assert.equal(filtros.filter((item) => item === "Antiga").length, 1);
});

test("estoque legado segue a ativacao atual e conserva o formulario especializado", () => {
  assert.equal(categoriaEstaAtiva(CATEGORIA_RELATORIO_ESTOQUE_LEGADA, montarCatalogoCategorias([])), true);
  assert.equal(categoriaEstaAtiva(CATEGORIA_RELATORIO_ESTOQUE_LEGADA, montarCatalogoCategorias([{ nome: CATEGORIA_RELATORIO_ESTOQUE, ativa: false }])), false);
  assert.equal(tipoOcorrenciaPorCategoria(CATEGORIA_RELATORIO_ESTOQUE_LEGADA), "estoque");
  assert.equal(tipoOcorrenciaPorCategoria(CATEGORIA_AVARIA_DEVOLUCAO), "avaria");
  assert.equal(tipoOcorrenciaPorCategoria("Material promocional"), null);
});

test("catalogo inteiro desativado nao libera categorias desconhecidas nem rascunhos antigos", () => {
  const catalogo = montarCatalogoCategorias(CATEGORIAS_FOTO.map((item) => ({ nome: item.valor, ativa: false })));
  assert.equal(catalogo.filter((item) => item.ativa).length, 0);
  assert.equal(categoriaEstaAtiva("Gondola", catalogo), false);
  assert.equal(categoriaEstaAtiva("Inexistente", catalogo), false);
  assert.equal(categoriaEstaAtiva(null, catalogo), false);
});
