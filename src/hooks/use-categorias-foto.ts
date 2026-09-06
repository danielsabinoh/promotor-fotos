import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { useUsuarioAtual } from "../contexts/usuario-context";
import { categoriasCollection, lerRegistroCategoria } from "../services/categorias-service";
import { montarCatalogoCategorias, type CategoriaConfigurada } from "../utils/catalogo-categorias";

type Estado = { uid: string; categorias: CategoriaConfigurada[]; erro: string | null };

export function useCategoriasFoto() {
  const { perfil } = useUsuarioAtual();
  const uid = perfil?.ativo ? perfil.uid : null;
  const [estado, setEstado] = useState<Estado | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(categoriasCollection(), (snapshot) => {
      try {
        const categorias = montarCatalogoCategorias(snapshot.docs.map((item) => lerRegistroCategoria(item.data())));
        setEstado({ uid, categorias, erro: null });
      } catch (error) {
        setEstado({ uid, categorias: [], erro: error instanceof Error ? error.message : "Nao foi possivel carregar as categorias." });
      }
    }, () => {
      setEstado({ uid, categorias: [], erro: "Nao foi possivel carregar as categorias. Verifique sua conexao e as permissoes de acesso." });
    });
  }, [uid, tentativa]);

  const atual = estado?.uid === uid ? estado : null;
  const categorias = useMemo(() => atual?.categorias ?? [], [atual]);
  return {
    categorias,
    categoriasAtivas: useMemo(() => categorias.filter((categoria) => categoria.ativa), [categorias]),
    carregando: !atual,
    erro: atual?.erro ?? null,
    recarregar: () => {
      setEstado(null);
      setTentativa((valor) => valor + 1);
    },
  };
}
