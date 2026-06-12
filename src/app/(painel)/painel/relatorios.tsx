import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../../services/firebaseConfig";

type Foto = {
  id: string;
  categoria?: string;
  status?: string;
  lojaNome?: string;
  promotorNome?: string;
  promotorEmail?: string;
  naLixeira?: boolean;
  refacaoDeId?: string;
};

type LinhaResumoProps = {
  nome: string;
  valor: number;
  total: number;
  cor: string;
};

function LinhaResumo({ nome, valor, total, cor }: LinhaResumoProps) {
  const percentual = total > 0 ? (valor / total) * 100 : 0;

  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#4B586D" }}>{nome}</Text>
        <Text
          style={{
            color: "#172033",
            fontWeight: "bold",
            fontVariant: ["tabular-nums"],
          }}
        >
          {valor}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: "#EDF0F5",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${percentual}%`,
            height: "100%",
            backgroundColor: cor,
          }}
        />
      </View>
    </View>
  );
}

export default function RelatoriosPainel() {
  const [fotos, setFotos] = useState<Foto[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, "fotos"), (snapshot) => {
      const lista = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Foto[];

      const idsSubstituidos = new Set(
        lista
          .filter((foto) => foto.naLixeira !== true)
          .map((foto) => foto.refacaoDeId)
          .filter(Boolean),
      );

      setFotos(
        lista.filter(
          (foto) =>
            foto.naLixeira !== true && !idsSubstituidos.has(foto.id),
        ),
      );
    });
  }, []);

  const relatorio = useMemo(() => {
    const contar = (obterChave: (foto: Foto) => string) => {
      const mapa = new Map<string, number>();

      fotos.forEach((foto) => {
        const chave = obterChave(foto);
        mapa.set(chave, (mapa.get(chave) || 0) + 1);
      });

      return Array.from(mapa.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor);
    };

    return {
      status: contar((foto) => foto.status || "pendente"),
      categorias: contar((foto) => foto.categoria || "Sem categoria"),
      lojas: contar((foto) => foto.lojaNome || "Loja nao informada"),
      promotores: contar(
        (foto) =>
          foto.promotorNome ||
          foto.promotorEmail ||
          "Promotor nao identificado",
      ),
    };
  }, [fotos]);

  const cores = ["#2F6FED", "#168174", "#C46A16", "#7C3AED", "#BA3340"];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 18, paddingBottom: 28 }}
    >
      <View>
        <Text style={{ color: "#172033", fontSize: 27, fontWeight: "bold" }}>
          Relatorios
        </Text>
        <Text style={{ color: "#68758A", paddingTop: 5 }}>
          Consolidado das {fotos.length} fotos registradas
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {[
          { titulo: "Fotos por status", dados: relatorio.status },
          { titulo: "Fotos por categoria", dados: relatorio.categorias },
          { titulo: "Fotos por loja", dados: relatorio.lojas },
          { titulo: "Fotos por promotor", dados: relatorio.promotores },
        ].map((grupo) => (
          <View
            key={grupo.titulo}
            style={{
              flex: 1,
              minWidth: 330,
              backgroundColor: "white",
              borderWidth: 1,
              borderColor: "#E0E5ED",
              borderRadius: 8,
              padding: 18,
            }}
          >
            <Text
              style={{
                color: "#172033",
                fontSize: 17,
                fontWeight: "bold",
                paddingBottom: 18,
              }}
            >
              {grupo.titulo}
            </Text>
            <View style={{ gap: 15 }}>
              {grupo.dados.slice(0, 8).map((item, indice) => (
                <LinhaResumo
                  key={item.nome}
                  nome={item.nome}
                  valor={item.valor}
                  total={fotos.length}
                  cor={cores[indice % cores.length]}
                />
              ))}
              {grupo.dados.length === 0 ? (
                <Text style={{ color: "#7A879D" }}>
                  Nenhum dado disponivel.
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
