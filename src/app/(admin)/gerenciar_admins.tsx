import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
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
import { useUsuarioAtual } from "@/contexts/usuario-context";
import { useEstadoPersistido } from "@/hooks/use-estado-persistido";
import { ROTAS } from "@/constants/routes";
import { auth } from "@/services/firebaseConfig";
import {
  atualizarUsuario,
  consultaAdministradores,
} from "@/services/usuarios-service";
import { useTheme } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import type { Administrador } from "@/types/usuario";
import { obterData } from "@/utils/datas";

type AdminGerenciado = Administrador & {
  nome: string;
  email: string;
  tipo: "admin" | "super_admin";
  criadoEm?: any;
};

const COR_LARANJA = "#EA580C";
const COR_LARANJA_FUNDO = "#FFEDD5";

const CORES_AVATAR: { fundo: string; texto: string }[] = [
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
  return CORES_AVATAR[hash % CORES_AVATAR.length];
}

function iniciaisDoNome(nome: string) {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0][0]?.toUpperCase() || "?";
  return (
    (partes[0][0] || "") + (partes[partes.length - 1][0] || "")
  ).toUpperCase();
}

export default function GerenciarAdmins() {
  const { colors, scheme } = useTheme();
  const [admins, setAdmins] = useState<AdminGerenciado[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useEstadoPersistido<FiltroStatus>(
    "admins:filtro",
    "todos",
  );
  const [ordenacao, setOrdenacao] = useEstadoPersistido<Ordenacao>(
    "admins:ordenacao",
    "az",
  );
  const [filtroAberto, setFiltroAberto] = useState(false);
  const { perfil } = useUsuarioAtual();
  const autorizado = perfil?.tipo === "super_admin";
  const [detalhesAberto, setDetalhesAberto] = useState<AdminGerenciado | null>(
    null,
  );
  const [menuAberto, setMenuAberto] = useState<AdminGerenciado | null>(null);

  // Verifica acesso: só super_admin
  useEffect(() => {
    if (!perfil) return;
    if (perfil.tipo !== "super_admin") {
      Alert.alert(
        "Acesso negado",
        "Somente o administrador principal pode gerenciar admins.",
      );
      router.replace(ROTAS.admin);
    }
  }, [perfil]);

  // Carrega lista de admins quando autorizado
  useEffect(() => {
    if (!autorizado) return;

    const unsubscribe = onSnapshot(
      consultaAdministradores(),
      (snapshot) => {
        const lista = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AdminGerenciado[];
        lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
        setAdmins(lista);
      },
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Não foi possível carregar os administradores.");
      },
    );

    return () => unsubscribe();
  }, [autorizado]);

  // Mantém o admin em detalhes sincronizado com o snapshot
  useEffect(() => {
    if (!detalhesAberto) return;
    const atualizado = admins.find((a) => a.id === detalhesAberto.id);
    if (atualizado && atualizado !== detalhesAberto) {
      const timeoutId = setTimeout(() => {
        setDetalhesAberto(atualizado);
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [admins, detalhesAberto]);

  const adminsFiltrados = useMemo(() => {
    let lista = admins;

    if (filtro === "ativos") {
      lista = lista.filter((a) => a.ativo !== false);
    } else if (filtro === "inativos") {
      lista = lista.filter((a) => a.ativo === false);
    }

    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (termo) {
      lista = lista.filter(
        (admin) =>
          admin.nome?.toLocaleLowerCase("pt-BR").includes(termo) ||
          admin.email?.toLocaleLowerCase("pt-BR").includes(termo),
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
  }, [admins, busca, filtro, ordenacao]);

  function alterarAcesso(admin: AdminGerenciado) {
    setMenuAberto(null);
    setDetalhesAberto(null);

    if (admin.id === auth.currentUser?.uid) {
      Alert.alert(
        "Ação bloqueada",
        "Você não pode desativar o próprio acesso.",
      );
      return;
    }

    if (admin.tipo === "super_admin") {
      Alert.alert(
        "Ação bloqueada",
        "O administrador principal não pode ser desativado.",
      );
      return;
    }

    const estaAtivo = admin.ativo !== false;
    Alert.alert(
      estaAtivo ? "Desativar administrador" : "Reativar administrador",
      `Deseja ${estaAtivo ? "desativar" : "reativar"} o acesso de ${admin.nome}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: estaAtivo ? "Desativar" : "Reativar",
          style: estaAtivo ? "destructive" : "default",
          onPress: async () => {
            try {
              await atualizarUsuario(admin.id, {
                ativo: !estaAtivo,
                atualizadoEm: serverTimestamp(),
              });
            } catch (error: any) {
              console.log(error);
              Alert.alert(
                "Erro",
                error.message || "Não foi possível alterar o acesso.",
              );
            }
          },
        },
      ],
    );
  }

  function excluirAdmin(admin: AdminGerenciado) {
    setMenuAberto(null);
    setDetalhesAberto(null);

    if (admin.id === auth.currentUser?.uid) {
      Alert.alert(
        "Ação bloqueada",
        "Você não pode excluir o próprio cadastro.",
      );
      return;
    }

    if (admin.tipo === "super_admin") {
      Alert.alert(
        "Ação bloqueada",
        "O administrador principal não pode ser excluído.",
      );
      return;
    }

    Alert.alert(
      "Excluir administrador",
      `Esta ação não pode ser desfeita. Deseja excluir o cadastro de ${admin.nome}?\n\nLembrete: a credencial precisa ser removida manualmente no Firebase Authentication.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Função em desenvolvimento",
              "A exclusão definitiva de administradores ainda não foi liberada. Por enquanto utilize 'Desativar acesso'.",
            );
          },
        },
      ],
    );
  }

  if (!autorizado) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
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
        data={adminsFiltrados}
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
            {/* Título + botão novo */}
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
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: "bold",
                }}
              >
                Administradores
              </Text>
              <Pressable
                onPress={() => router.push(ROTAS.cadastroAdmin)}
                accessibilityLabel="Novo administrador"
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: COR_LARANJA,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MaterialIcons name="add" size={20} color="white" />
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Novo admin
                </Text>
              </Pressable>
            </View>

            {/* Busca + filtro */}
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
                <MaterialIcons
                  name="search"
                  size={20}
                  color={colors.iconMuted}
                />
                <TextInput
                  value={busca}
                  onChangeText={setBusca}
                  placeholder="Buscar por nome ou email"
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
                  borderColor:
                    filtro !== "todos" ? COR_LARANJA : corBorda,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons
                  name="filter-list"
                  size={22}
                  color={filtro !== "todos" ? COR_LARANJA : colors.text}
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
                      backgroundColor: COR_LARANJA,
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
              name="admin-panel-settings"
              size={36}
              color={colors.iconMuted}
            />
            <Text style={{ color: colors.text, fontWeight: "bold" }}>
              Nenhum administrador encontrado
            </Text>
            <Text style={{ color: colors.textSubtle, textAlign: "center" }}>
              Cadastre um novo ou ajuste sua busca.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CardAdmin
            colors={colors}
            corBorda={corBorda}
            sombra={sombra}
            admin={item}
            onAbrir={() => setDetalhesAberto(item)}
            onMenu={() => setMenuAberto(item)}
          />
        )}
      />

      <AdminBottomNav abaAtiva="admins" tipoUsuario="super_admin" />

      <ModalFiltroStatus
        visivel={filtroAberto}
        valor={filtro}
        ordenacao={ordenacao}
        corPrincipal={COR_LARANJA}
        onSelecionar={(v) => setFiltro(v)}
        onSelecionarOrdenacao={(o) => setOrdenacao(o)}
        onFechar={() => setFiltroAberto(false)}
      />

      <MenuAcoesAdmin
        colors={colors}
        corBorda={corBorda}
        admin={menuAberto}
        onFechar={() => setMenuAberto(null)}
        onAlterarStatus={alterarAcesso}
        onExcluir={excluirAdmin}
      />

      <ModalDetalhesAdmin
        colors={colors}
        corBorda={corBorda}
        admin={detalhesAberto}
        onFechar={() => setDetalhesAberto(null)}
        onAlterarStatus={alterarAcesso}
        onExcluir={excluirAdmin}
      />
    </View>
  );
}

/* ---------- Card ---------- */

function CardAdmin({
  colors,
  corBorda,
  sombra,
  admin,
  onAbrir,
  onMenu,
}: {
  colors: ThemeColors;
  corBorda: string;
  sombra: string;
  admin: AdminGerenciado;
  onAbrir: () => void;
  onMenu: () => void;
}) {
  const ativo = admin.ativo !== false;
  const avatar = corPorNome(admin.nome || admin.email || "?");
  const iniciais = iniciaisDoNome(admin.nome || admin.email || "?");
  const ehPrincipal = admin.tipo === "super_admin";
  const ehUsuarioAtual = admin.id === auth.currentUser?.uid;

  return (
    <Pressable
      onPress={onAbrir}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: corBorda,
        borderRadius: 14,
        padding: 16,
        gap: 12,
        boxShadow: sombra,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {/* Topo: avatar + nome/email + badge */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: avatar.fundo,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: avatar.texto,
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            {iniciais}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 17, fontWeight: "bold" }}
          >
            {admin.nome || "Sem nome"}
            {ehUsuarioAtual ? " (você)" : ""}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.textSubtle, paddingTop: 3 }}
          >
            {admin.email}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: ativo ? "#DCFCE7" : "#FEE2E2",
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: ativo ? "#16A34A" : "#DC2626",
            }}
          />
          <Text
            style={{
              color: ativo ? "#15803D" : "#B91C1C",
              fontSize: 12,
              fontWeight: "bold",
            }}
          >
            {ativo ? "Ativo" : "Inativo"}
          </Text>
        </View>
      </View>

      {/* Linha embaixo: nível + menu */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingTop: 4,
          borderTopWidth: 1,
          borderTopColor: corBorda,
          paddingVertical: 8,
        }}
      >
        <MaterialIcons
          name={ehPrincipal ? "shield" : "admin-panel-settings"}
          size={20}
          color={COR_LARANJA}
        />
        <Text style={{ flex: 1, color: colors.text }}>
          <Text style={{ fontWeight: "bold" }}>Nível: </Text>
          <Text style={{ color: colors.textMuted }}>
            {ehPrincipal ? "Administrador principal" : "Administrador"}
          </Text>
        </Text>
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
          <MaterialIcons
            name="more-horiz"
            size={20}
            color={colors.iconMuted}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

/* ---------- Menu "..." ---------- */

function MenuAcoesAdmin({
  colors,
  corBorda,
  admin,
  onFechar,
  onAlterarStatus,
  onExcluir,
}: {
  colors: ThemeColors;
  corBorda: string;
  admin: AdminGerenciado | null;
  onFechar: () => void;
  onAlterarStatus: (a: AdminGerenciado) => void;
  onExcluir: (a: AdminGerenciado) => void;
}) {
  if (!admin) return null;
  const ativo = admin.ativo !== false;
  const ehPrincipal = admin.tipo === "super_admin";
  const ehUsuarioAtual = admin.id === auth.currentUser?.uid;
  const podeAlterar = !ehPrincipal && !ehUsuarioAtual;

  return (
    <Modal
      visible={!!admin}
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
            {admin.nome}
          </Text>

          <Pressable
            onPress={() => onAlterarStatus(admin)}
            disabled={!podeAlterar}
            style={{
              minHeight: 48,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              opacity: podeAlterar ? 1 : 0.4,
            }}
          >
            <MaterialIcons
              name={ativo ? "block" : "check-circle"}
              size={22}
              color={ativo ? "#B45309" : "#16A34A"}
            />
            <Text
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 15,
                fontWeight: "500",
              }}
            >
              {ativo ? "Desativar acesso" : "Reativar acesso"}
            </Text>
          </Pressable>

          <View
            style={{
              height: 1,
              backgroundColor: corBorda,
              marginVertical: 4,
            }}
          />

          <Pressable
            onPress={() => onExcluir(admin)}
            disabled={!podeAlterar}
            style={{
              minHeight: 48,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              opacity: podeAlterar ? 1 : 0.4,
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
              Excluir cadastro
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Modal de detalhes ---------- */

function ModalDetalhesAdmin({
  colors,
  corBorda,
  admin,
  onFechar,
  onAlterarStatus,
  onExcluir,
}: {
  colors: ThemeColors;
  corBorda: string;
  admin: AdminGerenciado | null;
  onFechar: () => void;
  onAlterarStatus: (a: AdminGerenciado) => void;
  onExcluir: (a: AdminGerenciado) => void;
}) {
  if (!admin) return null;

  const ativo = admin.ativo !== false;
  const ehPrincipal = admin.tipo === "super_admin";
  const ehUsuarioAtual = admin.id === auth.currentUser?.uid;
  const podeAlterar = !ehPrincipal && !ehUsuarioAtual;
  const avatar = corPorNome(admin.nome || admin.email || "?");
  const iniciais = iniciaisDoNome(admin.nome || admin.email || "?");

  const dataCriacao = obterData(admin.criadoEm);
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
      visible={!!admin}
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
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            Detalhes do administrador
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
          {/* Cabeçalho */}
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
                backgroundColor: avatar.fundo,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: avatar.texto,
                  fontSize: 30,
                  fontWeight: "bold",
                }}
              >
                {iniciais}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 22,
                  fontWeight: "bold",
                }}
                numberOfLines={2}
              >
                {admin.nome || "Sem nome"}
                {ehUsuarioAtual ? " (você)" : ""}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "flex-start",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: ativo ? "#DCFCE7" : "#FEE2E2",
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: ativo ? "#16A34A" : "#DC2626",
                  }}
                />
                <Text
                  style={{
                    color: ativo ? "#15803D" : "#B91C1C",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  {ativo ? "Ativo" : "Inativo"}
                </Text>
              </View>
            </View>
          </View>

          {/* Campos */}
          <CampoInfoAdmin
            colors={colors}
            corBorda={corBorda}
            icone="person-outline"
            rotulo="Nome completo"
            valor={admin.nome || "Sem nome"}
            onEditar={() => emBreve("nome")}
          />

          <CampoInfoAdmin
            colors={colors}
            corBorda={corBorda}
            icone="mail-outline"
            rotulo="E-mail"
            valor={admin.email || "—"}
            onEditar={() => emBreve("e-mail")}
          />

          <CampoInfoAdmin
            colors={colors}
            corBorda={corBorda}
            icone={ehPrincipal ? "shield" : "admin-panel-settings"}
            rotulo="Nível de acesso"
            valor={
              ehPrincipal ? "Administrador principal" : "Administrador"
            }
          />

          <CampoInfoAdmin
            colors={colors}
            corBorda={corBorda}
            icone="calendar-today"
            rotulo="Cadastrado em"
            valor={dataFormatada}
          />

          {/* Ações */}
          {podeAlterar ? (
            <View style={{ gap: 12, paddingTop: 10 }}>
              <Pressable
                onPress={() => onAlterarStatus(admin)}
                style={{
                  minHeight: 54,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: ativo ? "#DC2626" : "#16A34A",
                  backgroundColor: colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons
                  name={ativo ? "block" : "check-circle"}
                  size={20}
                  color={ativo ? "#DC2626" : "#16A34A"}
                />
                <Text
                  style={{
                    color: ativo ? "#DC2626" : "#16A34A",
                    fontWeight: "bold",
                    fontSize: 15,
                  }}
                >
                  {ativo ? "Desativar acesso" : "Reativar acesso"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onExcluir(admin)}
                style={{
                  minHeight: 54,
                  borderRadius: 12,
                  backgroundColor: "#DC2626",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons
                  name="delete-outline"
                  size={20}
                  color="white"
                />
                <Text
                  style={{ color: "white", fontWeight: "bold", fontSize: 15 }}
                >
                  Excluir cadastro
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                marginTop: 10,
                padding: 14,
                borderRadius: 12,
                backgroundColor: colors.surfaceHighlight,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <MaterialIcons
                name="info-outline"
                size={20}
                color={colors.iconMuted}
              />
              <Text
                style={{ flex: 1, color: colors.textMuted, fontSize: 13 }}
              >
                {ehPrincipal
                  ? "O administrador principal não pode ser desativado ou excluído."
                  : "Você não pode desativar o próprio acesso."}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CampoInfoAdmin({
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
          backgroundColor: COR_LARANJA_FUNDO,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icone} size={22} color={COR_LARANJA} />
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
          <MaterialIcons name="edit" size={20} color={COR_LARANJA} />
        </Pressable>
      ) : null}
    </View>
  );
}
