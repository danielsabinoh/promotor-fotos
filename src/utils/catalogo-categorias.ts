import {
  CATEGORIAS_FOTO,
  SEM_CATEGORIA,
  type CategoriaFoto,
} from "../constants/categorias-foto";
import {
  CATEGORIA_RELATORIO_ESTOQUE,
  CATEGORIA_RELATORIO_ESTOQUE_LEGADA,
} from "../constants/estoque";

export type CategoriaConfigurada = CategoriaFoto & {
  id: string;
  ativa: boolean;
  padrao: boolean;
};

export type RegistroCategoria = {
  nome: string;
  ativa: boolean;
};

export function limparNomeCategoria(nome: string) {
  return nome.trim().replace(/\s+/g, " ");
}

export function chaveCategoria(nome: string) {
  return encodeURIComponent(
    limparNomeCategoria(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
  );
}

export function validarNomeCategoria(nome: string) {
  const limpo = limparNomeCategoria(nome);
  if (limpo.length < 2 || limpo.length > 60) {
    throw new Error("O nome deve ter entre 2 e 60 caracteres.");
  }
  if (["Todas", SEM_CATEGORIA, CATEGORIA_RELATORIO_ESTOQUE_LEGADA].some(
    (reservado) => chaveCategoria(reservado) === chaveCategoria(limpo),
  )) {
    throw new Error("Este nome esta reservado. Escolha outro nome.");
  }
  return limpo;
}

export function montarCatalogoCategorias(registros: RegistroCategoria[]): CategoriaConfigurada[] {
  const catalogo = new Map<string, CategoriaConfigurada>(CATEGORIAS_FOTO.map((categoria) => [
    chaveCategoria(categoria.valor),
    { ...categoria, id: chaveCategoria(categoria.valor), ativa: true, padrao: true },
  ]));

  for (const registro of registros) {
    const id = chaveCategoria(registro.nome);
    const padrao = catalogo.get(id);
    catalogo.set(id, padrao
      ? { ...padrao, ativa: registro.ativa }
      : { id, nome: registro.nome, valor: registro.nome, ativa: registro.ativa, padrao: false, icone: "label-outline" });
  }

  return [...catalogo.values()].sort((a, b) =>
    Number(b.padrao) - Number(a.padrao) ||
    (a.padrao ? 0 : a.nome.localeCompare(b.nome, "pt-BR")),
  );
}

export function categoriaEstaAtiva(valor: string | null, catalogo: CategoriaConfigurada[]) {
  const atual = valor === CATEGORIA_RELATORIO_ESTOQUE_LEGADA
    ? CATEGORIA_RELATORIO_ESTOQUE : valor;
  return catalogo.some((categoria) => categoria.valor === atual && categoria.ativa);
}

export function categoriasParaFiltro(catalogo: CategoriaConfigurada[], historico: string[]) {
  return [...new Set([
    ...catalogo.map((categoria) => categoria.valor),
    ...historico,
    SEM_CATEGORIA,
  ])];
}
