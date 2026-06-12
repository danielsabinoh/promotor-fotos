import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../../services/firebaseConfig";

type Foto = {
  id: string;
  lojaNome?: string;
  promotorNome?: string;
  promotorEmail?: string;
  status?: string;
  categoria?: string;
  criadoEm?: any;
  naLixeira?: boolean;
  refacaoDeId?: string;
};

type IndicadorProps = {
  titulo: string;
  valor: number;
  icone: keyof typeof MaterialIcons.glyphMap;
  cor: string;
};

function Indicador({ titulo, valor, icone, cor }: IndicadorProps) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 190,
        minHeight: 118,
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#E0E5ED",
        borderRadius: 8,
        padding: 17,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: "#68758A", fontSize: 14 }}>{titulo}</Text>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 7,
            backgroundColor: `${cor}18`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name={icone} size={20} color={cor} />
        </View>
      </View>
      <Text
        style={{
          color: "#172033",
          fontSize: 30,
          fontWeight: "bold",
          fontVariant: ["tabular-nums"],
        }}
      >
        {valor}
      </Text>
    </View>
  );
}

function obterData(valor: any) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === "function") return valor.toDate();

  return null;
}

export default function PainelDashboard() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [totalLojas, setTotalLojas] = useState(0);
  const [totalPromotores, setTotalPromotores] = useState(0);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const unsubscribeFotos = onSnapshot(collection(db, "fotos"), (snapshot) => {
      const lista = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Foto[];

      lista.sort((a, b) => {
        const dataA = obterData(a.criadoEm)?.getTime() || 0;
        const dataB = obterData(b.criadoEm)?.getTime() || 0;
        return dataB - dataA;
      });
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

    const unsubscribeLojas = onSnapshot(collection(db, "lojas"), (snapshot) => {
      setTotalLojas(snapshot.size);
    });

    const unsubscribeUsuarios = onSnapshot(
      collection(db, "usuarios"),
      (snapshot) => {
        setTotalPromotores(
          snapshot.docs.filter(
            (item) =>
              item.data().tipo === "promotor" && item.data().ativo !== false,
          ).length,
        );
      },
    );

    return () => {
      unsubscribeFotos();
      unsubscribeLojas();
      unsubscribeUsuarios();
    };
  }, []);

  const resumo = useMemo(() => {
    const hoje = new Date();
    const fotosHoje = fotos.filter((foto) => {
      const data = obterData(foto.criadoEm);

      return (
        data &&
        data.getDate() === hoje.getDate() &&
        data.getMonth() === hoje.getMonth() &&
        data.getFullYear() === hoje.getFullYear()
      );
    }).length;

    return {
      fotosHoje,
      pendentes: fotos.filter(
        (foto) => (foto.status || "pendente") === "pendente",
      ).length,
      aprovadas: fotos.filter((foto) => foto.status === "aprovada").length,
      refazer: fotos.filter((foto) => foto.status === "refazer").length,
      rejeitadas: fotos.filter((foto) => foto.status === "rejeitada").length,
    };
  }, [fotos]);

  const colunasCompactas = width < 1120;
  const totalAvaliadas = resumo.aprovadas + resumo.refazer + resumo.rejeitadas;
  const status = [
    { nome: "Aprovadas", valor: resumo.aprovadas, cor: "#24864B" },
    { nome: "Refazer", valor: resumo.refazer, cor: "#BD7813" },
    { nome: "Rejeitadas", valor: resumo.rejeitadas, cor: "#BA3340" },
  ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 20, paddingBottom: 28 }}
    >
      <View>
        <Text style={{ color: "#172033", fontSize: 27, fontWeight: "bold" }}>
          Visao geral
        </Text>
        <Text style={{ color: "#68758A", paddingTop: 5 }}>
          Acompanhamento da operacao em tempo real
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Indicador
          titulo="Fotos recebidas hoje"
          valor={resumo.fotosHoje}
          icone="photo-camera"
          cor="#2F6FED"
        />
        <Indicador
          titulo="Fotos pendentes"
          valor={resumo.pendentes}
          icone="schedule"
          cor="#7C3AED"
        />
        <Indicador
          titulo="Promotores ativos"
          valor={totalPromotores}
          icone="groups"
          cor="#168174"
        />
        <Indicador
          titulo="Lojas cadastradas"
          valor={totalLojas}
          icone="store"
          cor="#C46A16"
        />
      </View>

      <View
        style={{
          flexDirection: colunasCompactas ? "column" : "row",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <View
          style={{
            flex: 1.2,
            backgroundColor: "white",
            borderWidth: 1,
            borderColor: "#E0E5ED",
            borderRadius: 8,
            padding: 18,
          }}
        >
          <Text style={{ color: "#172033", fontSize: 17, fontWeight: "bold" }}>
            Avaliacoes
          </Text>
          <Text style={{ color: "#7A879D", fontSize: 13, paddingTop: 3 }}>
            Distribuicao das fotos ja analisadas
          </Text>

          <View style={{ gap: 16, paddingTop: 22 }}>
            {status.map((item) => {
              const percentual =
                totalAvaliadas > 0 ? (item.valor / totalAvaliadas) * 100 : 0;

              return (
                <View key={item.nome} style={{ gap: 7 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: "#4B586D" }}>{item.nome}</Text>
                    <Text
                      style={{
                        color: "#172033",
                        fontWeight: "bold",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {item.valor}
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
                        backgroundColor: item.cor,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: "white",
            borderWidth: 1,
            borderColor: "#E0E5ED",
            borderRadius: 8,
            padding: 18,
          }}
        >
          <Text style={{ color: "#172033", fontSize: 17, fontWeight: "bold" }}>
            Acoes rapidas
          </Text>
          <View style={{ gap: 9, paddingTop: 16 }}>
            {[
              {
                titulo: "Analisar fotos pendentes",
                icone: "rate-review" as const,
                rota: "/painel/fotos",
              },
              {
                titulo: "Gerenciar promotores",
                icone: "manage-accounts" as const,
                rota: "/painel/promotores",
              },
              {
                titulo: "Consultar relatorios",
                icone: "assessment" as const,
                rota: "/painel/relatorios",
              },
            ].map((acao) => (
              <Pressable
                key={acao.rota}
                onPress={() => router.push(acao.rota as any)}
                style={{
                  minHeight: 48,
                  borderWidth: 1,
                  borderColor: "#DDE3ED",
                  borderRadius: 7,
                  paddingHorizontal: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <MaterialIcons name={acao.icone} size={21} color="#2F6FED" />
                <Text style={{ color: "#263247", fontWeight: "bold" }}>
                  {acao.titulo}
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color="#8A96A9"
                  style={{ marginLeft: "auto" }}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View
        style={{
          backgroundColor: "white",
          borderWidth: 1,
          borderColor: "#E0E5ED",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            padding: 18,
            borderBottomWidth: 1,
            borderBottomColor: "#E7EAF0",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{ color: "#172033", fontSize: 17, fontWeight: "bold" }}
            >
              Envios recentes
            </Text>
            <Text style={{ color: "#7A879D", fontSize: 13, paddingTop: 3 }}>
              Ultimas fotos recebidas
            </Text>
          </View>
          <Pressable onPress={() => router.push("/painel/fotos" as any)}>
            <Text style={{ color: "#2F6FED", fontWeight: "bold" }}>
              Ver todas
            </Text>
          </Pressable>
        </View>

        {fotos.slice(0, 5).map((foto, indice) => {
          const data = obterData(foto.criadoEm);
          const statusFoto = foto.status || "pendente";

          return (
            <View
              key={foto.id}
              style={{
                minHeight: 62,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderBottomWidth:
                  indice < Math.min(fotos.length, 5) - 1 ? 1 : 0,
                borderBottomColor: "#EEF1F5",
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <View style={{ flex: 1.2 }}>
                <Text style={{ color: "#263247", fontWeight: "bold" }}>
                  {foto.lojaNome || "Loja nao informada"}
                </Text>
                <Text style={{ color: "#7A879D", fontSize: 12, paddingTop: 3 }}>
                  {foto.promotorNome || foto.promotorEmail || "Promotor"}
                </Text>
              </View>
              <Text style={{ flex: 0.8, color: "#657189" }}>
                {foto.categoria || "Sem categoria"}
              </Text>
              <View
                style={{
                  minWidth: 82,
                  borderRadius: 5,
                  paddingVertical: 5,
                  paddingHorizontal: 8,
                  backgroundColor:
                    statusFoto === "aprovada"
                      ? "#E5F5EB"
                      : statusFoto === "rejeitada"
                        ? "#FCE8EA"
                        : statusFoto === "refazer"
                          ? "#FFF2DD"
                          : "#E8EFFD",
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "bold",
                    color:
                      statusFoto === "aprovada"
                        ? "#24864B"
                        : statusFoto === "rejeitada"
                          ? "#BA3340"
                          : statusFoto === "refazer"
                            ? "#A8660B"
                            : "#2F6FED",
                  }}
                >
                  {statusFoto}
                </Text>
              </View>
              <Text
                style={{
                  width: 118,
                  color: "#7A879D",
                  fontSize: 12,
                  textAlign: "right",
                }}
              >
                {data ? data.toLocaleString("pt-BR") : "Sem data"}
              </Text>
            </View>
          );
        })}

        {fotos.length === 0 ? (
          <Text style={{ color: "#7A879D", padding: 18 }}>
            Nenhuma foto recebida.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
