import type { MaterialIcons } from "@expo/vector-icons";

import {
  CATEGORIA_AVARIA_DEVOLUCAO,
  CATEGORIA_RELATORIO_ESTOQUE,
  CATEGORIA_RELATORIO_ESTOQUE_LEGADA,
} from "./estoque";

export type IconeMaterial = keyof typeof MaterialIcons.glyphMap;

export type CategoriaFoto = {
  valor: string;
  nome: string;
  icone: IconeMaterial;
};

export const SEM_CATEGORIA = "Sem categoria";

export const CATEGORIAS_FOTO: CategoriaFoto[] = [
  { valor: "Gondola", nome: "Gondola", icone: "view-stream" },
  {
    valor: CATEGORIA_RELATORIO_ESTOQUE,
    nome: "Relatorio de estoque",
    icone: "inventory-2",
  },
  {
    valor: CATEGORIA_AVARIA_DEVOLUCAO,
    nome: "Avaria / Devolucao",
    icone: "assignment-return",
  },
  { valor: "Ponta", nome: "Ponta", icone: "space-dashboard" },
  { valor: "Ilha", nome: "Ilha", icone: "grid-view" },
  { valor: "Ruptura", nome: "Ruptura", icone: "production-quantity-limits" },
  { valor: "Preco", nome: "Preco", icone: "sell" },
  { valor: "Validade", nome: "Validade", icone: "event" },
  { valor: "Concorrente", nome: "Concorrente", icone: "compare-arrows" },
  { valor: "Antes/depois", nome: "Antes/depois", icone: "compare" },
];

export const CATEGORIAS_FOTO_VALORES = CATEGORIAS_FOTO.map(
  (categoria) => categoria.valor,
);

export const CATEGORIAS_FOTO_COM_TODAS = [
  "Todas",
  ...CATEGORIAS_FOTO_VALORES,
  CATEGORIA_RELATORIO_ESTOQUE_LEGADA,
  SEM_CATEGORIA,
];

export function nomeCategoriaFoto(categoria?: string | null) {
  if (!categoria) return SEM_CATEGORIA;
  if (categoria === CATEGORIA_RELATORIO_ESTOQUE_LEGADA) {
    return "Relatorio de estoque";
  }

  return (
    CATEGORIAS_FOTO.find((item) => item.valor === categoria)?.nome ||
    categoria
  );
}
