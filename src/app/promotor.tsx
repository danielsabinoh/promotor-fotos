import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

type Loja = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
};

type Foto = {
  id: string;
  lojaNome?: string;
  categoria?: string;
  status?: string;
  comentarioAdmin?: string;
  criadoEm?: any;
  naLixeira?: boolean;
  refacaoDeId?: string;
};

function obterData(valor: any) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === "function") return valor.toDate();
  return null;
}

function ehHoje(valor: any) {
  const data = obterData(valor);
  if (!data) return false;
  const hoje = new Date();

  return (
    data.getDate() === hoje.getDate() &&
    data.getMonth() === hoje.getMonth() &&
    data.getFullYear() === hoje.getFullYear()
  );
}

function textoStatus(status: string) {
  if (status === "aprovada") return "Aprovada";
  if (status === "refazer") return "Refazer";
  if (status === "rejeitada") return "Rejeitada";
  return "Pendente";
}

function corStatus(status: string) {
  if (status === "aprovada") return "#48C781";
  if (status === "refazer") return "#F4B740";
  if (status === "rejeitada") return "#F07480";
  return "#73A3FF";
}

export default function Promotor() {
  const [nome, setNome] = useState("");
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);

  useEffect(() => {
    let unsubscribeFotos = () => {};

    async function carregarDadosPromotor() {
      try {
        const usuarioAtual = auth.currentUser;

        if (!usuarioAtual) {
          router.replace("/" as any);
          return;
        }

        const usuarioSnap = await getDoc(
          doc(db, "usuarios", usuarioAtual.uid),
        );

        if (!usuarioSnap.exists()) {
          await signOut(auth);
          Alert.alert("Erro", "Usuario nao cadastrado no sistema.");
          router.replace("/" as any);
          return;
        }

        const usuarioData = usuarioSnap.data();
        if (usuarioData.ativo === false) {
          await signOut(auth);
          Alert.alert("Acesso removido", "Seu acesso nao esta mais ativo.");
          router.replace("/" as any);
          return;
        }

        setNome(usuarioData.nome || "");

        const lojasCarregadas = await Promise.all(
          (usuarioData.lojasIds || []).map(async (lojaId: string) => {
            const lojaSnap = await getDoc(doc(db, "lojas", lojaId));
            return lojaSnap.exists()
              ? ({ id: lojaSnap.id, ...lojaSnap.data() } as Loja)
              : null;
          }),
        );
        setLojas(lojasCarregadas.filter(Boolean) as Loja[]);

        const consultaFotos = query(
          collection(db, "fotos"),
          where("promotorId", "==", usuarioAtual.uid),
        );
        unsubscribeFotos = onSnapshot(consultaFotos, (snapshot) => {
          const lista = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Foto[];

          lista.sort(
            (a, b) =>
              (obterData(b.criadoEm)?.getTime() || 0) -
              (obterData(a.criadoEm)?.getTime() || 0),
          );
          setFotos(lista);
        });
      } catch (error) {
        console.log(error);
        Alert.alert("Erro", "Nao foi possivel carregar seus dados.");
      }
    }

    carregarDadosPromotor();
    return () => unsubscribeFotos();
  }, []);

  useEffect(() => {
    const usuarioAtual = auth.currentUser;
    if (!usuarioAtual) return;

    const consulta = query(
      collection(db, "notificacoes"),
      where("destinatarioId", "==", usuarioAtual.uid),
      where("lida", "==", false),
    );

    return onSnapshot(consulta, (snapshot) => {
      setNotificacoesNaoLidas(snapshot.size);
    });
  }, []);

  const resumo = useMemo(() => {
    const idsSubstituidos = new Set(
      fotos
        .filter((foto) => foto.naLixeira !== true)
        .map((foto) => foto.refacaoDeId)
        .filter(Boolean),
    );
    const ativas = fotos.filter(
      (foto) =>
        foto.naLixeira !== true && !idsSubstituidos.has(foto.id),
    );

    return {
      ativas,
      hoje: ativas.filter((foto) => ehHoje(foto.criadoEm)).length,
      pendentes: ativas.filter(
        (foto) => (foto.status || "pendente") === "pendente",
      ).length,
      aprovadas: ativas.filter((foto) => foto.status === "aprovada").length,
      refazer: ativas.filter((foto) => foto.status === "refazer").length,
      lixeira: fotos.filter((foto) => foto.naLixeira === true).length,
    };
  }, [fotos]);

  const avaliacoesRecentes = resumo.ativas
    .filter((foto) => (foto.status || "pendente") !== "pendente")
    .slice(0, 3);

  function abrirMinhasFotos(statusInicial?: string, modoInicial?: string) {
    router.push({
      pathname: "/minhas_fotos",
      params: { statusInicial, modoInicial },
    } as any);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0F1115" }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 34,
        gap: 22,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#8E9AAF", fontSize: 14 }}>Bom trabalho,</Text>
          <Text
            numberOfLines={1}
            style={{
              color: "white",
              fontSize: 27,
              fontWeight: "bold",
              paddingTop: 3,
            }}
          >
            {nome || "Promotor"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 9 }}>
          <Pressable
            onPress={() => router.push("/notificacoes" as any)}
            accessibilityLabel="Abrir notificações"
            style={estiloBotaoIcone}
          >
            <MaterialIcons
              name={
                notificacoesNaoLidas > 0
                  ? "notifications"
                  : "notifications-none"
              }
              size={24}
              color="#AFC5F5"
            />
            {notificacoesNaoLidas > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: "#D83A4E",
                  borderWidth: 2,
                  borderColor: "#0F1115",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 10,
                    fontWeight: "bold",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {notificacoesNaoLidas > 9 ? "9+" : notificacoesNaoLidas}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => router.push("/perfil_promotor" as any)}
            accessibilityLabel="Abrir perfil"
            style={estiloBotaoIcone}
          >
            <MaterialIcons name="person-outline" size={25} color="#AFC5F5" />
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Indicador
          titulo="Enviadas hoje"
          valor={resumo.hoje}
          icone="photo-camera"
          cor="#73A3FF"
        />
        <Indicador
          titulo="Pendentes"
          valor={resumo.pendentes}
          icone="schedule"
          cor="#B79AF7"
        />
        <Indicador
          titulo="Aprovadas"
          valor={resumo.aprovadas}
          icone="check-circle-outline"
          cor="#48C781"
        />
        <Indicador
          titulo="Refazer"
          valor={resumo.refazer}
          icone="replay"
          cor="#F4B740"
          onPress={() => abrirMinhasFotos("refazer")}
        />
      </View>

      {resumo.refazer > 0 ? (
        <Pressable
          onPress={() => abrirMinhasFotos("refazer")}
          style={{
            backgroundColor: "#3D2D10",
            borderWidth: 1,
            borderColor: "#71551B",
            borderRadius: 8,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
          }}
        >
          <MaterialIcons name="warning-amber" size={25} color="#F4B740" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FCE6A9", fontWeight: "bold" }}>
              {resumo.refazer} foto(s) precisam ser refeitas
            </Text>
            <Text style={{ color: "#CDBD92", paddingTop: 3 }}>
              Consulte os comentarios do responsavel.
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={23} color="#F4B740" />
        </Pressable>
      ) : null}

      <View style={{ gap: 11 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={estiloTituloSecao}>Acesso rapido</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Atalho
            titulo="Minhas fotos"
            subtitulo={`${resumo.ativas.length} envios`}
            icone="photo-library"
            onPress={() => abrirMinhasFotos()}
          />
          <Atalho
            titulo="Lixeira"
            subtitulo={`${resumo.lixeira} itens`}
            icone="delete-outline"
            onPress={() => abrirMinhasFotos(undefined, "lixeira")}
          />
        </View>
      </View>

      <View style={{ gap: 11 }}>
        <Text style={estiloTituloSecao}>Minhas lojas</Text>
        {lojas.length === 0 ? (
          <View style={estiloEstadoVazio}>
            <MaterialIcons name="store" size={32} color="#687386" />
            <Text style={{ color: "#8D98AA" }}>
              Nenhuma loja vinculada ao seu usuario.
            </Text>
          </View>
        ) : (
          lojas.map((loja) => (
            <View
              key={loja.id}
              style={{
                backgroundColor: "#191C22",
                borderWidth: 1,
                borderColor: "#2B3039",
                borderRadius: 8,
                padding: 15,
                gap: 13,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 8,
                    backgroundColor: "#253759",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons name="storefront" size={23} color="#8CB1FA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={2}
                    style={{ color: "white", fontSize: 17, fontWeight: "bold" }}
                  >
                    {loja.nome}
                  </Text>
                  <Text style={{ color: "#8E99AA", paddingTop: 3 }}>
                    {loja.cidade} - {loja.estado}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/enviar_foto",
                    params: { lojaId: loja.id, lojaNome: loja.nome },
                  } as any)
                }
                style={{
                  minHeight: 44,
                  borderRadius: 7,
                  backgroundColor: "#2F6FED",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="add-a-photo" size={20} color="white" />
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Enviar foto
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={{ gap: 11 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={estiloTituloSecao}>Ultimas avaliacoes</Text>
          <Pressable onPress={() => abrirMinhasFotos()}>
            <Text style={{ color: "#79A4FA", fontWeight: "bold" }}>
              Ver todas
            </Text>
          </Pressable>
        </View>

        {avaliacoesRecentes.length === 0 ? (
          <View style={estiloEstadoVazio}>
            <MaterialIcons name="fact-check" size={32} color="#687386" />
            <Text style={{ color: "#8D98AA", textAlign: "center" }}>
              Suas avaliacoes mais recentes aparecerao aqui.
            </Text>
          </View>
        ) : (
          avaliacoesRecentes.map((foto) => {
            const status = foto.status || "pendente";

            return (
              <Pressable
                key={foto.id}
                onPress={() => abrirMinhasFotos(status)}
                style={{
                  minHeight: 66,
                  backgroundColor: "#191C22",
                  borderWidth: 1,
                  borderColor: "#2B3039",
                  borderRadius: 8,
                  padding: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: "white", fontWeight: "bold" }}
                  >
                    {foto.lojaNome || "Loja nao informada"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: "#8894A6", paddingTop: 4 }}
                  >
                    {foto.categoria || "Sem categoria"}
                    {foto.comentarioAdmin ? " · possui comentario" : ""}
                  </Text>
                </View>
                <Text
                  style={{
                    color: corStatus(status),
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  {textoStatus(status)}
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color="#667286"
                />
              </Pressable>
            );
          })
        )}
      </View>

      <Pressable
        onPress={async () => {
          await signOut(auth);
          router.replace("/" as any);
        }}
        style={{
          minHeight: 46,
          borderWidth: 1,
          borderColor: "#343A44",
          borderRadius: 7,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <MaterialIcons name="logout" size={20} color="#AAB3C0" />
        <Text style={{ color: "#D2D7DF", fontWeight: "bold" }}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

function Indicador({
  titulo,
  valor,
  icone,
  cor,
  onPress,
}: {
  titulo: string;
  valor: number;
  icone: keyof typeof MaterialIcons.glyphMap;
  cor: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        width: "48%",
        minHeight: 104,
        flexGrow: 1,
        backgroundColor: "#191C22",
        borderWidth: 1,
        borderColor: "#2B3039",
        borderRadius: 8,
        padding: 14,
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
        <Text style={{ color: "#919CAD", fontSize: 13 }}>{titulo}</Text>
        <MaterialIcons name={icone} size={21} color={cor} />
      </View>
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "bold",
          fontVariant: ["tabular-nums"],
        }}
      >
        {valor}
      </Text>
    </Pressable>
  );
}

function Atalho({
  titulo,
  subtitulo,
  icone,
  onPress,
}: {
  titulo: string;
  subtitulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 94,
        backgroundColor: "#191C22",
        borderWidth: 1,
        borderColor: "#2B3039",
        borderRadius: 8,
        padding: 13,
        justifyContent: "space-between",
      }}
    >
      <MaterialIcons name={icone} size={25} color="#82A9F7" />
      <View>
        <Text style={{ color: "white", fontWeight: "bold" }}>{titulo}</Text>
        <Text style={{ color: "#818D9F", paddingTop: 3, fontSize: 12 }}>
          {subtitulo}
        </Text>
      </View>
    </Pressable>
  );
}

const estiloTituloSecao = {
  color: "#F1F4F8",
  fontSize: 18,
  fontWeight: "bold" as const,
};

const estiloBotaoIcone = {
  width: 44,
  height: 44,
  borderRadius: 8,
  backgroundColor: "#1B1F26",
  borderWidth: 1,
  borderColor: "#303640",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const estiloEstadoVazio = {
  minHeight: 105,
  borderWidth: 1,
  borderColor: "#2B3039",
  borderRadius: 8,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
  padding: 18,
};
