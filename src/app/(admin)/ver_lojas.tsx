import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { onSnapshot, serverTimestamp } from "firebase/firestore";

import AdminBottomNav from "@/components/admin-bottom-nav";
import ModalFiltroStatus, {
  type FiltroStatus,
  type Ordenacao,
} from "@/components/modal-filtro-status";
import { ROTAS } from "@/constants/routes";
import { useTipoUsuario } from "@/contexts/usuario-context";
import { useEstadoPersistido } from "@/hooks/use-estado-persistido";
import {
  atualizarLoja,
  excluirLoja,
  lojasCollection,
} from "@/services/lojas-service";
import { consultaPromotores } from "@/services/usuarios-service";
import { useTheme } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import type { Loja } from "@/types/loja";
import { obterData } from "@/utils/datas";

const COR_VERDE = "#16A34A";
const COR_VERDE_FUNDO = "#DCFCE7";
const COR_PIN = "#94A3B8";
const COR_CIDADE = "#64748B";

const CORES_AVATAR_PROMOTOR: { fundo: string; texto: string }[] = [
  { fundo: "#DBEAFE", texto: "#1E40AF" },
  { fundo: "#EDE9FE", texto: "#6D28D9" },
  { fundo: "#DCFCE7", texto: "#166534" },
  { fundo: "#FED7AA", texto: "#9A3412" },
  { fundo: "#FCE7F3", texto: "#9D174D" },
  { fundo: "#CFFAFE", texto: "#155E75" },
  { fundo: "#FEF3C7", texto: "#92400E" },
];

function corPorNome(nome: string) {
  let hash = 0;
  const texto = nome || "?";
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return CORES_AVATAR_PROMOTOR[hash % CORES_AVATAR_PROMOTOR.length];
}

function iniciaisDoNome(nome: string) {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0][0]?.toUpperCase() || "?";
  return (
    (partes[0][0] || "") + (partes[partes.length - 1][0] || "")
  ).toUpperCase();
}

type PromotorMini = {
  id: string;
  nome: string;
  email: string;
  lojasIds: string[];
  fotoBase64?: string;
};

export default function VerLojas() {
  const { colors, scheme } = useTheme();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [promotores, setPromotores] = useState<PromotorMini[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useEstadoPersistido<FiltroStatus>(
    "lojas:filtro",
    "todos",
  );
  const [ordenacao, setOrdenacao] = useEstadoPersistido<Ordenacao>(
    "lojas:ordenacao",
    "az",
  );
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [detalhesAberta, setDetalhesAberta] = useState<Loja | null>(null);
  const [menuAberto, setMenuAberto] = useState<Loja | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const tipoUsuario = useTipoUsuario();

  useEffect(() => {
    return onSnapshot(lojasCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Loja[];
      lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setLojas(lista);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(consultaPromotores(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => {
        const dados = doc.data();
        return {
          id: doc.id,
          nome: dados.nome || dados.email || "Promotor",
          email: dados.email || "",
          lojasIds: dados.lojasIds || [],
          fotoBase64: dados.fotoBase64,
        };
      });
      setPromotores(lista);
    });
  }, []);


  // Mantém a loja em detalhes sincronizada com o snapshot
  useEffect(() => {
    if (!detalhesAberta) return;
    const atualizada = lojas.find((l) => l.id === detalhesAberta.id);
    if (atualizada && atualizada !== detalhesAberta) {
      const timeoutId = setTimeout(() => {
        setDetalhesAberta(atualizada);
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [lojas, detalhesAberta]);

  const lojasFiltradas = useMemo(() => {
    let lista = lojas;

    if (filtro === "ativos") {
      lista = lista.filter((l) => l.ativo !== false);
    } else if (filtro === "inativos") {
      lista = lista.filter((l) => l.ativo === false);
    }

    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (termo) {
      lista = lista.filter((loja) =>
        `${loja.nome} ${loja.cidade || ""} ${loja.estado || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(termo),
      );
    }

    const ordenada = [...lista];
    if (ordenacao === "az") {
      ordenada.sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
      );
    } else if (ordenacao === "za") {
      ordenada.sort((a, b) =>
        (b.nome || "").localeCompare(a.nome || "", "pt-BR"),
      );
    } else if (ordenacao === "recentes") {
      ordenada.sort(
        (a, b) =>
          (obterData(b.criadoEm)?.getTime() || 0) -
          (obterData(a.criadoEm)?.getTime() || 0),
      );
    } else if (ordenacao === "antigos") {
      ordenada.sort(
        (a, b) =>
          (obterData(a.criadoEm)?.getTime() || 0) -
          (obterData(b.criadoEm)?.getTime() || 0),
      );
    }

    return ordenada;
  }, [busca, lojas, filtro, ordenacao]);

  function promotoresDaLoja(lojaId: string) {
    return promotores.filter((p) => p.lojasIds.includes(lojaId));
  }

  function alterarStatusLoja(loja: Loja) {
    setMenuAberto(null);
    const estaAtiva = loja.ativo !== false;
    Alert.alert(
      estaAtiva ? "Desativar loja" : "Reativar loja",
      `Deseja ${estaAtiva ? "desativar" : "reativar"} a loja ${loja.nome}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: estaAtiva ? "Desativar" : "Reativar",
          style: estaAtiva ? "destructive" : "default",
          onPress: async () => {
            try {
              await atualizarLoja(loja.id, {
                ativo: !estaAtiva,
                atualizadoEm: serverTimestamp(),
              });
            } catch (error: any) {
              console.log(error);
              Alert.alert(
                "Erro",
                error.message || "Não foi possível alterar o status da loja.",
              );
            }
          },
        },
      ],
    );
  }

  function excluirLojaConfirm(loja: Loja) {
    setMenuAberto(null);
    Alert.alert(
      "Excluir loja",
      `Deseja excluir permanentemente a loja ${loja.nome}? As fotos associadas serão preservadas.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              setExcluindoId(loja.id);
              await excluirLoja(loja.id);
              setDetalhesAberta(null);
              Alert.alert("Sucesso", "Loja excluída.");
            } catch (error: any) {
              console.log(error);
              Alert.alert(
                "Erro",
                error.message || "Não foi possível excluir a loja.",
              );
            } finally {
              setExcluindoId(null);
            }
          },
        },
      ],
    );
  }

  const corBorda =
    scheme === "light" ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";
  const sombra =
    scheme === "light"
      ? "0 2px 10px rgba(15,23,42,0.06)"
      : "0 2px 10px rgba(0,0,0,0.35)";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={lojasFiltradas}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 110,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListHeaderComponent={
          <View style={{ gap: 18, paddingBottom: 18 }}>
            {/* Título + botão Nova loja */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingTop: 8,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 28,
                  fontWeight: "bold",
                }}
              >
                Lojas
              </Text>
              <Pressable
                onPress={() => router.push(ROTAS.cadastroLoja)}
                accessibilityLabel="Nova loja"
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: COR_VERDE,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MaterialIcons name="add" size={20} color="white" />
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Nova loja
                </Text>
              </Pressable>
            </View>

            {/* Busca larga + filtro */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  minHeight: 52,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: corBorda,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <MaterialIcons name="search" size={20} color={colors.iconMuted} />
                <TextInput
                  value={busca}
                  onChangeText={setBusca}
                  placeholder="Pesquisar loja..."
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                  style={{
                    flex: 1,
                    color: colors.text,
                    paddingVertical: 12,
                  }}
                />
              </View>

              <Pressable
                onPress={() => setFiltroAberto(true)}
                accessibilityLabel="Filtrar"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: filtro !== "todos" ? COR_VERDE : corBorda,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons
                  name="filter-list"
                  size={22}
                  color={filtro !== "todos" ? COR_VERDE : colors.text}
                />
                {filtro !== "todos" ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: COR_VERDE,
                    }}
                  />
                ) : null}
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={{
              minHeight: 160,
              borderWidth: 1,
              borderColor: corBorda,
              borderRadius: 12,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 22,
            }}
          >
            <MaterialIcons
              name="storefront"
              size={36}
              color={colors.iconMuted}
            />
            <Text style={{ color: colors.text, fontWeight: "bold" }}>
              Nenhuma loja encontrada
            </Text>
            <Text style={{ color: colors.textSubtle, textAlign: "center" }}>
              Cadastre uma nova ou refine sua busca.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CardLoja
            colors={colors}
            corBorda={corBorda}
            sombra={sombra}
            loja={item}
            numPromotores={promotoresDaLoja(item.id).length}
            onAbrir={() => setDetalhesAberta(item)}
            onMenu={() => setMenuAberto(item)}
          />
        )}
      />

      <AdminBottomNav abaAtiva="lojas" tipoUsuario={tipoUsuario} />

      <ModalFiltroStatus
        visivel={filtroAberto}
        valor={filtro}
        ordenacao={ordenacao}
        corPrincipal={COR_VERDE}
        onSelecionar={(v) => setFiltro(v)}
        onSelecionarOrdenacao={(o) => setOrdenacao(o)}
        onFechar={() => setFiltroAberto(false)}
      />

      <MenuAcoesLoja
        colors={colors}
        corBorda={corBorda}
        loja={menuAberto}
        excluindoId={excluindoId}
        onFechar={() => setMenuAberto(null)}
        onAlterarStatus={alterarStatusLoja}
        onExcluir={excluirLojaConfirm}
      />

      <ModalDetalhesLoja
        colors={colors}
        corBorda={corBorda}
        loja={detalhesAberta}
        promotoresVinculados={
          detalhesAberta ? promotoresDaLoja(detalhesAberta.id) : []
        }
        excluindoId={excluindoId}
        onFechar={() => setDetalhesAberta(null)}
        onAlterarStatus={alterarStatusLoja}
        onExcluir={excluirLojaConfirm}
      />
    </View>
  );
}

function CardLoja({
  colors,
  corBorda,
  sombra,
  loja,
  numPromotores,
  onAbrir,
  onMenu,
}: {
  colors: ThemeColors;
  corBorda: string;
  sombra: string;
  loja: Loja;
  numPromotores: number;
  onAbrir: () => void;
  onMenu: () => void;
}) {
  const ativa = loja.ativo !== false;

  return (
    <Pressable
      onPress={onAbrir}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: corBorda,
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        boxShadow: sombra,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {/* Ícone + badge contador */}
      <View style={{ width: 52, height: 52 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: COR_VERDE_FUNDO,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="storefront" size={26} color={COR_VERDE} />
        </View>
        <View
          style={{
            position: "absolute",
            right: -4,
            top: -4,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#94A3B8",
            borderWidth: 2,
            borderColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 5,
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 11,
              fontWeight: "bold",
              fontVariant: ["tabular-nums"],
            }}
          >
            {numPromotores}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: colors.text,
              fontSize: 17,
              fontWeight: "bold",
            }}
          >
            {loja.nome}
          </Text>
          {!ativa ? (
            <Text
              style={{
                color: "#B91C1C",
                backgroundColor: "#FEE2E2",
                fontSize: 11,
                fontWeight: "bold",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              Inativa
            </Text>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingTop: 4,
          }}
        >
          <MaterialIcons name="place" size={15} color={COR_PIN} />
          <Text
            numberOfLines={1}
            style={{ color: COR_CIDADE, fontSize: 13, fontWeight: "500" }}
          >
            {loja.cidade || "—"}
            {loja.estado ? ` - ${loja.estado}` : ""}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onMenu();
        }}
        accessibilityLabel="Mais opções"
        style={{
          width: 38,
          height: 32,
          borderRadius: 8,
          backgroundColor: colors.surfaceHighlight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name="more-horiz" size={20} color={colors.iconMuted} />
      </Pressable>
    </Pressable>
  );
}

function MenuAcoesLoja({
  colors,
  corBorda,
  loja,
  excluindoId,
  onFechar,
  onAlterarStatus,
  onExcluir,
}: {
  colors: ThemeColors;
  corBorda: string;
  loja: Loja | null;
  excluindoId: string | null;
  onFechar: () => void;
  onAlterarStatus: (l: Loja) => void;
  onExcluir: (l: Loja) => void;
}) {
  if (!loja) return null;
  const ativa = loja.ativo !== false;
  const excluindo = excluindoId === loja.id;

  return (
    <Modal
      visible={!!loja}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <Pressable
        onPress={onFechar}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.45)",
          justifyContent: "center",
          padding: 22,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: corBorda,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: colors.textSubtle,
              fontSize: 12,
              fontWeight: "bold",
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 6,
            }}
            numberOfLines={1}
          >
            {loja.nome}
          </Text>

          <Pressable
            onPress={() => onAlterarStatus(loja)}
            style={{
              minHeight: 48,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <MaterialIcons
              name={ativa ? "block" : "check-circle"}
              size={22}
              color={ativa ? "#B45309" : "#16A34A"}
            />
            <Text
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 15,
                fontWeight: "500",
              }}
            >
              {ativa ? "Desativar loja" : "Reativar loja"}
            </Text>
          </Pressable>

          <View
            style={{ height: 1, backgroundColor: corBorda, marginVertical: 4 }}
          />

          <Pressable
            onPress={() => onExcluir(loja)}
            disabled={excluindo}
            style={{
              minHeight: 48,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              opacity: excluindo ? 0.6 : 1,
            }}
          >
            <MaterialIcons name="delete-outline" size={22} color="#DC2626" />
            <Text
              style={{
                flex: 1,
                color: "#DC2626",
                fontSize: 15,
                fontWeight: "500",
              }}
            >
              {excluindo ? "Excluindo..." : "Excluir loja"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ModalDetalhesLoja({
  colors,
  corBorda,
  loja,
  promotoresVinculados,
  excluindoId,
  onFechar,
  onAlterarStatus,
  onExcluir,
}: {
  colors: ThemeColors;
  corBorda: string;
  loja: Loja | null;
  promotoresVinculados: PromotorMini[];
  excluindoId: string | null;
  onFechar: () => void;
  onAlterarStatus: (loja: Loja) => void;
  onExcluir: (loja: Loja) => void;
}) {
  if (!loja) return null;

  const ativa = loja.ativo !== false;

  const dataCriacao = obterData(loja.criadoEm);
  const dataFormatada = dataCriacao
    ? dataCriacao.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Não disponível";

  function emBreve(campo: string) {
    Alert.alert(
      "Em breve",
      `A edição de ${campo} estará disponível em uma próxima atualização.`,
    );
  }

  return (
    <Modal
      visible={!!loja}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onFechar}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: corBorda,
          }}
        >
          <Text
            style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}
          >
            Detalhes da loja
          </Text>
          <Pressable
            onPress={onFechar}
            accessibilityLabel="Fechar"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surfaceHighlight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name="close" size={20} color={colors.iconMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 22,
            paddingBottom: 36,
            gap: 16,
          }}
        >
          {/* Cabeçalho: ícone + nome */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              paddingBottom: 4,
            }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: COR_VERDE_FUNDO,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="storefront" size={42} color={COR_VERDE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={{
                  color: colors.text,
                  fontSize: 22,
                  fontWeight: "bold",
                }}
              >
                {loja.nome}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingTop: 6,
                }}
              >
                <MaterialIcons name="place" size={16} color="#DC2626" />
                <Text
                  numberOfLines={1}
                  style={{
                    color: COR_VERDE,
                    fontSize: 14,
                    fontWeight: "bold",
                  }}
                >
                  {loja.cidade || "—"}
                  {loja.estado ? ` - ${loja.estado}` : ""}
                </Text>
              </View>
            </View>
          </View>

          {/* Nome */}
          <CampoInfoLoja
            colors={colors}
            corBorda={corBorda}
            icone="storefront"
            rotulo="Nome da loja"
            valor={loja.nome}
            onEditar={() => emBreve("nome")}
          />

          {/* Cidade */}
          <CampoInfoLoja
            colors={colors}
            corBorda={corBorda}
            icone="location-city"
            rotulo="Cidade"
            valor={loja.cidade || "—"}
            onEditar={() => emBreve("cidade")}
          />

          {/* Estado */}
          <CampoInfoLoja
            colors={colors}
            corBorda={corBorda}
            icone="map"
            rotulo="Estado"
            valor={loja.estado || "—"}
            onEditar={() => emBreve("estado")}
          />

          {/* Data de criação */}
          <CampoInfoLoja
            colors={colors}
            corBorda={corBorda}
            icone="calendar-today"
            rotulo="Cadastrada em"
            valor={dataFormatada}
          />

          {/* Promotores vinculados */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: corBorda,
              borderRadius: 14,
              padding: 16,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                Promotores vinculados
              </Text>
              <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                {promotoresVinculados.length}
              </Text>
            </View>

            {promotoresVinculados.length === 0 ? (
              <Text style={{ color: colors.textSubtle, paddingVertical: 4 }}>
                Nenhum promotor vinculado a esta loja.
              </Text>
            ) : (
              <View style={{ gap: 2 }}>
                {promotoresVinculados.map((p, indice) => {
                  const avatar = corPorNome(p.nome || p.email || "?");
                  const iniciais = iniciaisDoNome(
                    p.nome || p.email || "?",
                  );
                  return (
                    <View
                      key={p.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 10,
                        borderTopWidth: indice === 0 ? 0 : 1,
                        borderTopColor: corBorda,
                      }}
                    >
                      {p.fotoBase64 ? (
                        <Image
                          source={{ uri: p.fotoBase64 }}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: avatar.fundo,
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: avatar.fundo,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: avatar.texto,
                              fontSize: 13,
                              fontWeight: "bold",
                            }}
                          >
                            {iniciais}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.text,
                            fontWeight: "bold",
                            fontSize: 14,
                          }}
                        >
                          {p.nome}
                        </Text>
                        {p.email ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.textSubtle,
                              fontSize: 12,
                              paddingTop: 2,
                            }}
                          >
                            {p.email}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Ações */}
          <View style={{ gap: 12, paddingTop: 10 }}>
            <Pressable
              onPress={() => onAlterarStatus(loja)}
              style={{
                minHeight: 54,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: ativa ? "#DC2626" : "#16A34A",
                backgroundColor: colors.surface,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <MaterialIcons
                name={ativa ? "block" : "check-circle"}
                size={20}
                color={ativa ? "#DC2626" : "#16A34A"}
              />
              <Text
                style={{
                  color: ativa ? "#DC2626" : "#16A34A",
                  fontWeight: "bold",
                  fontSize: 15,
                }}
              >
                {ativa ? "Desativar loja" : "Reativar loja"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onExcluir(loja)}
              disabled={excluindoId === loja.id}
              style={{
                minHeight: 54,
                borderRadius: 12,
                backgroundColor: "#DC2626",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: excluindoId === loja.id ? 0.6 : 1,
              }}
            >
              <MaterialIcons name="delete-outline" size={20} color="white" />
              <Text
                style={{ color: "white", fontWeight: "bold", fontSize: 15 }}
              >
                {excluindoId === loja.id ? "Excluindo..." : "Excluir loja"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function CampoInfoLoja({
  colors,
  corBorda,
  icone,
  rotulo,
  valor,
  onEditar,
}: {
  colors: ThemeColors;
  corBorda: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  rotulo: string;
  valor: string;
  onEditar?: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: corBorda,
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          backgroundColor: COR_VERDE_FUNDO,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icone} size={22} color={COR_VERDE} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.textSubtle, fontSize: 12 }}>
          {rotulo}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.text,
            fontSize: 15,
            fontWeight: "bold",
          }}
        >
          {valor}
        </Text>
      </View>
      {onEditar ? (
        <Pressable
          onPress={onEditar}
          accessibilityLabel={`Editar ${rotulo}`}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="edit" size={20} color={COR_VERDE} />
        </Pressable>
      ) : null}
    </View>
  );
}
