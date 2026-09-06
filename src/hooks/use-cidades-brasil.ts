import { useEffect, useState } from "react";

export type CidadeBR = {
  id: number;
  nome: string;
  uf: string;
  estadoNome: string;
};

const URL_IBGE =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";

// Cache em escopo de módulo: a lista é baixada UMA vez por sessão do app.
let cacheCidades: CidadeBR[] | null = null;
let promessaEmAndamento: Promise<CidadeBR[]> | null = null;

function carregarCidades(): Promise<CidadeBR[]> {
  if (cacheCidades) return Promise.resolve(cacheCidades);
  if (promessaEmAndamento) return promessaEmAndamento;

  promessaEmAndamento = fetch(URL_IBGE)
    .then((resposta) => {
      if (!resposta.ok) {
        throw new Error(`Falha ao buscar cidades (status ${resposta.status})`);
      }
      return resposta.json();
    })
    .then((dados: any[]) => {
      const lista: CidadeBR[] = dados.map((item) => ({
        id: item.id,
        nome: item.nome,
        uf: item.microrregiao?.mesorregiao?.UF?.sigla || "",
        estadoNome: item.microrregiao?.mesorregiao?.UF?.nome || "",
      }));
      cacheCidades = lista;
      promessaEmAndamento = null;
      return lista;
    })
    .catch((erro) => {
      promessaEmAndamento = null;
      throw erro;
    });

  return promessaEmAndamento;
}

/**
 * Hook que devolve a lista completa de cidades brasileiras (IBGE).
 * - Faz fetch só uma vez por sessão (cache em módulo).
 * - Estado de loading e erro pra UI tratar.
 */
export function useCidadesBrasil() {
  const [cidades, setCidades] = useState<CidadeBR[]>(cacheCidades || []);
  const [carregando, setCarregando] = useState(!cacheCidades);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (cacheCidades) return;
    let ativo = true;

    carregarCidades()
      .then((lista) => {
        if (!ativo) return;
        setCidades(lista);
        setErro(null);
      })
      .catch((e) => {
        if (!ativo) return;
        console.log(e);
        setErro("Não foi possível carregar a lista de cidades.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { cidades, carregando, erro };
}

/**
 * Normaliza texto pra comparação sem acentos / case insensitive.
 * Usa range Unicode explícito dos "combining diacritical marks".
 */
export function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
