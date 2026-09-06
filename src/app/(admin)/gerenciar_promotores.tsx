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
import { onSnapshot } from "firebase/firestore";

import AdminBottomNav from "@/components/admin-bottom-nav";
import ModalFiltroStatus, {
  type FiltroStatus,
  type Ordenacao,
} from "@/components/modal-filtro-status";
import { ROTAS } from "@/constants/routes";
import { useTipoUsuario, useUsuarioAtual } from "@/contexts/usuario-context";
import { useEstadoPersistido } from "@/hooks/use-estado-persistido";
import { lojasCollection } from "@/services/lojas-service";
import { consultaPromotores } from "@/services/usuarios-service";
import {
  alterarStatusPromotor,
  atualizarPromotorAdministrativamente,
  enviarRedefinicaoSenhaPromotor,
  reenviarConvitePromotor,
} from "@/services/gestao-acessos";
import { emailParecePessoal } from "@/constants/acesso";
import { useTheme } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import type { Loja } from "@/types/loja";
import type { Promotor } from "@/types/usuario";
import { obterData } from "@/utils/datas";

type PromotorGerenciado = Promotor & {
  nome: string;
  email: string;
  fotoBase64?: string;
  criadoEm?: any;
};

const COR_PRIMARIA = "#7C3AED";
// Paleta de cores pros avatares — escolhida pelo hash do nome (determinístico).
const CORES_AVATAR: { fundo: string; texto: string }[] = [
  { fundo: "#DBEAFE", texto: "#1E40AF" }, // azul
  { fundo: "#EDE9FE", texto: "#6D28D9" }, // roxo
  { fundo: "#DCFCE7", texto: "#166534" }, // verde
  { fundo: "#FED7AA", texto: "#9A3412" }, // laranja
  { fundo: "#FCE7F3", texto: "#9D174D" }, // rosa
  { fundo: "#CFFAFE", texto: "#155E75" }, // ciano
  { fundo: "#FEF3C7", texto: "#92400E" }, // âmbar
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

export default function GerenciarPromotores() {
  const { colors, scheme } = useTheme();
  const [promotores, setPromotores] = useState<PromotorGerenciado[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [busca, setBusca] = useState("");
  const [promotorEditado, setPromotorEditado] =
    useState<PromotorGerenciado | null>(null);
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [nomeEditado, setNomeEditado] = useState("");
  const [emailEditado, setEmailEditado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [menuAberto, setMenuAberto] = useState<PromotorGerenciado | null>(null);
  const [detalhesAberto, setDetalhesAberto] =
    useState<PromotorGerenciado | null>(null);
  const tipoUsuario = useTipoUsuario();
  const { perfil } = useUsuarioAtual();
  const [filtro, setFiltro] = useEstadoPersistido<FiltroStatus>(
    "promotores:filtro",
    "todos",
  );
  const [ordenacao, setOrdenacao] = useEstadoPersistido<Ordenacao>(
    "promotores:ordenacao",
    "az",
  );
  const [filtroAberto, setFiltroAberto] = useState(false);

  // Mantém o promotor mostrado em detalhes sempre sincronizado com o snapshot do Firestore
  useEffect(() => {
    if (!detalhesAberto) return;
    const atualizado = promotores.find((p) => p.id === detalhesAberto.id);
    if (atualizado && atualizado !== detalhesAberto) {
      const timeoutId = setTimeout(() => {
        setDetalhesAberto(atualizado);
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [promotores, detalhesAberto]);

  useEffect(() => {
    return onSnapshot(
      consultaPromotores(perfil?.equipeId),
      (snapshot) => {
        const lista = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as PromotorGerenciado[];
        lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
        setPromotores(lista);
      },
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Nao foi possivel carregar os promotores.");
      },
    );
  }, [perfil?.equipeId]);

  useEffect(() => {
    return onSnapshot(
      lojasCollection(),
      (snapshot) => {
        const lista = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Loja[];
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        setLojas(lista);
      },
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Nao foi possivel carregar as lojas.");
      },
    );
  }, []);

  const promotoresFiltrados = useMemo(() => {
    let lista = promotores;

    if (filtro === "ativos") {
      lista = lista.filter((p) => p.ativo !== false);
    } else if (filtro === "inativos") {
      lista = lista.filter((p) => p.ativo === false);
    }

    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (termo) {
      lista = lista.filter(
        (promotor) =>
          promotor.nome?.toLocaleLowerCase("pt-BR").includes(termo) ||
          promotor.email?.toLocaleLowerCase("pt-BR").includes(termo),
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
  }, [busca, promotores, filtro, ordenacao]);

  function abrirEdicaoLojas(promotor: PromotorGerenciado) {
    setMenuAberto(null);
    setPromotorEditado(promotor);
    setNomeEditado(promotor.nome || "");
    setEmailEditado(promotor.email || "");
    setLojasSelecionadas(promotor.lojasIds || []);
  }

  function alternarLoja(lojaId: string) {
    setLojasSelecionadas((atuais) =>
      atuais.includes(lojaId)
        ? atuais.filter((id) => id !== lojaId)
        : [...atuais, lojaId],
    );
  }

  async function salvarLojas() {
    if (!promotorEditado || salvando) return;
    if (!nomeEditado.trim() || !emailEditado.trim() || lojasSelecionadas.length === 0) {
      Alert.alert("Atencao", "Preencha nome, email e selecione pelo menos uma loja.");
      return;
    }
    try {
      setSalvando(true);
      await atualizarPromotorAdministrativamente(promotorEditado.id, {
        nome: nomeEditado.trim(),
        email: emailEditado.trim().toLowerCase(),
        lojasIds: lojasSelecionadas,
      });
      setPromotorEditado(null);
      Alert.alert("Sucesso", "Dados do promotor atualizados e registrados.");
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", error.message || "Nao foi possivel salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function alterarAcesso(promotor: PromotorGerenciado) {
    setMenuAberto(null);
    const estaAtivo = promotor.ativo !== false;
    const acao = estaAtivo ? "desativar" : "reativar";

    Alert.alert(
      estaAtivo ? "Desativar acesso" : "Reativar acesso",
      `Deseja ${acao} o acesso de ${promotor.nome}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: estaAtivo ? "Desativar" : "Reativar",
          style: estaAtivo ? "destructive" : "default",
          onPress: async () => {
            try {
              await alterarStatusPromotor(promotor.id, !estaAtivo);
            } catch (error: any) {
              console.log(error);
              Alert.alert(
                "Erro",
                error.message || "Nao foi possivel alterar o acesso.",
              );
            }
          },
        },
      ],
    );
  }

  async function enviarEmailAcesso(promotor: PromotorGerenciado) {
    setMenuAberto(null);
    try {
      if (promotor.statusAcesso === "convite_pendente") {
        await reenviarConvitePromotor(promotor.id);
        Alert.alert("Convite reenviado", `Enviamos um novo convite para ${promotor.email}.`);
      } else {
        await enviarRedefinicaoSenhaPromotor(promotor.id);
        Alert.alert("Email enviado", `Enviamos a redefinicao de senha para ${promotor.email}.`);
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Nao foi possivel enviar o email.");
    }
  }

  function nomesLojas(promotor: PromotorGerenciado) {
    const nomes = lojas
      .filter((loja) => promotor.lojasIds?.includes(loja.id))
      .map((loja) => loja.nome);
    return nomes.length > 0 ? nomes.join(", ") : "Nenhuma loja vinculada";
  }

  const corBordaSuave =
    scheme === "light" ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";
  const sombraSuave =
    scheme === "light"
      ? "0 2px 10px rgba(15,23,42,0.06)"
      : "0 2px 10px rgba(0,0,0,0.35)";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={promotoresFiltrados}
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
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 28,
                  fontWeight: "bold",
                }}
              >
                Promotores
              </Text>
              <Pressable
                onPress={() => router.push(ROTAS.cadastroPromotor)}
                accessibilityLabel="Novo promotor"
                style={{
                  minHeight: 44,
                  borderRadius: 10,
                  backgroundColor: COR_PRIMARIA,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MaterialIcons name="add" size={20} color="white" />
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Novo promotor
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
                  borderColor: corBordaSuave,
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
                    filtro !== "todos" ? COR_PRIMARIA : corBordaSuave,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons
                  name="filter-list"
                  size={22}
                  color={filtro !== "todos" ? COR_PRIMARIA : colors.text}
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
                      backgroundColor: COR_PRIMARIA,
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
              borderColor: corBordaSuave,
              borderRadius: 12,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 22,
            }}
          >
            <MaterialIcons
              name="person-search"
              size={36}
              color={colors.iconMuted}
            />
            <Text style={{ color: colors.text, fontWeight: "bold" }}>
              Nenhum promotor encontrado
            </Text>
            <Text style={{ color: colors.textSubtle, textAlign: "center" }}>
              Tente outra busca ou cadastre um novo.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CardPromotor
            colors={colors}
            corBorda={corBordaSuave}
            sombra={sombraSuave}
            promotor={item}
            lojasTexto={nomesLojas(item)}
            onAbrir={() => setDetalhesAberto(item)}
            onMenu={() => setMenuAberto(item)}
          />
        )}
      />

      <ModalDetalhesPromotor
        colors={colors}
        corBorda={corBordaSuave}
        promotor={detalhesAberto}
        lojasMap={lojas}
        onFechar={() => setDetalhesAberto(null)}
        onAlterarLojas={(p) => {
          setDetalhesAberto(null);
          abrirEdicaoLojas(p);
        }}
        onAlterarAcesso={(p) => {
          setDetalhesAberto(null);
          alterarAcesso(p);
        }}
        onEnviarEmail={(p) => {
          setDetalhesAberto(null);
          enviarEmailAcesso(p);
        }}
      />

      <AdminBottomNav abaAtiva="promotores" tipoUsuario={tipoUsuario} />

      <ModalFiltroStatus
        visivel={filtroAberto}
        valor={filtro}
        ordenacao={ordenacao}
        corPrincipal={COR_PRIMARIA}
        onSelecionar={(v) => setFiltro(v)}
        onSelecionarOrdenacao={(o) => setOrdenacao(o)}
        onFechar={() => setFiltroAberto(false)}
      />

      {/* Modal: menu de ações ("...") */}
      <MenuAcoes
        colors={colors}
        corBorda={corBordaSuave}
        promotor={menuAberto}
        onFechar={() => setMenuAberto(null)}
        onAlterarLojas={abrirEdicaoLojas}
        onAlterarAcesso={alterarAcesso}
        onEnviarEmail={enviarEmailAcesso}
      />

      {/* Modal: edicao dos dados permitidos */}
      <Modal
        visible={!!promotorEditado}
        transparent
        animationType="fade"
        onRequestClose={() => setPromotorEditado(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.55)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              maxHeight: "80%",
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 18,
              gap: 14,
              borderWidth: 1,
              borderColor: corBordaSuave,
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 20, fontWeight: "bold" }}
            >
              Editar {promotorEditado?.nome}
            </Text>

            <TextInput
              value={nomeEditado}
              onChangeText={setNomeEditado}
              placeholder="Nome completo"
              placeholderTextColor={colors.placeholder}
              style={{ minHeight: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.backgroundAlt }}
            />
            <TextInput
              value={emailEditado}
              onChangeText={setEmailEditado}
              placeholder="Email"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ minHeight: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.backgroundAlt }}
            />
            {emailParecePessoal(emailEditado) ? <Text style={{ color: colors.warning, fontSize: 12 }}>Email pessoal permitido. Prefira o corporativo quando possivel.</Text> : null}

            <ScrollView>
              <View style={{ gap: 8 }}>
                {lojas.map((loja) => {
                  const selecionada = lojasSelecionadas.includes(loja.id);
                  return (
                    <Pressable
                      key={loja.id}
                      onPress={() => alternarLoja(loja.id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: selecionada
                          ? colors.primary
                          : colors.surfaceElevated,
                        borderWidth: 1,
                        borderColor: selecionada
                          ? colors.primary
                          : corBordaSuave,
                        borderRadius: 10,
                        padding: 13,
                      }}
                    >
                      <MaterialIcons
                        name={
                          selecionada ? "check-box" : "check-box-outline-blank"
                        }
                        size={22}
                        color={
                          selecionada ? colors.primaryText : colors.iconMuted
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: selecionada ? colors.primaryText : colors.text,
                            fontWeight: "bold",
                          }}
                        >
                          {loja.nome}
                        </Text>
                        {loja.cidade ? (
                          <Text
                            style={{
                              color: selecionada
                                ? colors.primaryText
                                : colors.textSubtle,
                              paddingTop: 2,
                            }}
                          >
                            {loja.cidade}
                            {loja.estado ? ` - ${loja.estado}` : ""}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setPromotorEditado(null)}
                disabled={salvando}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: corBordaSuave,
                  borderRadius: 10,
                  padding: 13,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={salvarLojas}
                disabled={salvando}
                style={{
                  flex: 1,
                  backgroundColor: salvando
                    ? colors.borderStrong
                    : colors.primary,
                  borderRadius: 10,
                  padding: 13,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "bold" }}>
                  {salvando ? "Salvando..." : "Salvar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CardPromotor({
  colors,
  corBorda,
  sombra,
  promotor,
  lojasTexto,
  onAbrir,
  onMenu,
}: {
  colors: ThemeColors;
  corBorda: string;
  sombra: string;
  promotor: PromotorGerenciado;
  lojasTexto: string;
  onAbrir: () => void;
  onMenu: () => void;
}) {
  const ativo = promotor.ativo !== false;
  const avatar = corPorNome(promotor.nome || promotor.email || "?");
  const iniciais = iniciaisDoNome(promotor.nome || promotor.email || "?");

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
      {/* Linha topo: avatar + dados + badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        {promotor.fotoBase64 ? (
          <Image
            source={{ uri: promotor.fotoBase64 }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: avatar.fundo,
            }}
          />
        ) : (
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
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 17, fontWeight: "bold" }}
          >
            {promotor.nome || "Sem nome"}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.textSubtle, paddingTop: 3 }}
          >
            {promotor.email}
          </Text>
        </View>

        <BadgeStatus colors={colors} ativo={ativo} />
      </View>

      {/* Linha embaixo: lojas + botão "..." */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingTop: 4,
          borderTopWidth: 1,
          borderTopColor: corBorda,
          marginTop: 2,
          paddingVertical: 8,
        }}
      >
        <MaterialIcons name="store" size={20} color={colors.primary} />
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: colors.text }}
        >
          <Text style={{ fontWeight: "bold" }}>Lojas: </Text>
          <Text style={{ color: colors.textMuted }}>{lojasTexto}</Text>
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

function BadgeStatus({
  colors,
  ativo,
}: {
  colors: ThemeColors;
  ativo: boolean;
}) {
  return (
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
  );
}

function ModalDetalhesPromotor({
  colors,
  corBorda,
  promotor,
  lojasMap,
  onFechar,
  onAlterarLojas,
  onAlterarAcesso,
  onEnviarEmail,
}: {
  colors: ThemeColors;
  corBorda: string;
  promotor: PromotorGerenciado | null;
  lojasMap: Loja[];
  onFechar: () => void;
  onAlterarLojas: (p: PromotorGerenciado) => void;
  onAlterarAcesso: (p: PromotorGerenciado) => void;
  onEnviarEmail: (p: PromotorGerenciado) => void;
}) {
  if (!promotor) return null;

  const ativo = promotor.ativo !== false;
  const convitePendente = promotor.statusAcesso === "convite_pendente";
  const avatar = corPorNome(promotor.nome || promotor.email || "?");
  const iniciais = iniciaisDoNome(promotor.nome || promotor.email || "?");
  const dataCriacao = obterData(promotor.criadoEm);
  const dataFormatada = dataCriacao
    ? dataCriacao.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Não disponível";

  const lojasDoPromotor = lojasMap.filter((l) =>
    promotor.lojasIds?.includes(l.id),
  );

  return (
    <Modal
      visible={!!promotor}
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
            Detalhes do promotor
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
          {/* Cabeçalho: avatar à esquerda + dados à direita */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 18,
              paddingBottom: 6,
            }}
          >
            {/* Avatar com ícone de câmera sobreposto */}
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Em breve",
                  "A alteração de foto estará disponível em uma próxima atualização.",
                )
              }
              accessibilityLabel="Alterar foto"
              style={{ width: 96, height: 96 }}
            >
              {promotor.fotoBase64 ? (
                <Image
                  source={{ uri: promotor.fotoBase64 }}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: avatar.fundo,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
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
              )}

              {/* Mini botão de câmera no canto */}
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "white",
                  borderWidth: 2,
                  borderColor: colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons
                  name="photo-camera"
                  size={16}
                  color={COR_PRIMARIA}
                />
              </View>
            </Pressable>

            {/* Coluna: nome + badge + link alterar foto */}
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 22,
                  fontWeight: "bold",
                }}
                numberOfLines={2}
              >
                {promotor.nome || "Sem nome"}
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
                  {convitePendente ? "Convite pendente" : ativo ? "Ativo" : "Inativo"}
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Em breve",
                    "A alteração de foto estará disponível em uma próxima atualização.",
                  )
                }
                hitSlop={6}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <MaterialIcons
                  name="photo-camera"
                  size={16}
                  color={COR_PRIMARIA}
                />
                <Text
                  style={{
                    color: COR_PRIMARIA,
                    fontSize: 13,
                    fontWeight: "bold",
                  }}
                >
                  Alterar foto
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Nome */}
          <CampoInfo
            colors={colors}
            corBorda={corBorda}
            icone="person-outline"
            rotulo="Nome completo"
            valor={promotor.nome || "Sem nome"}
            onEditar={() => onAlterarLojas(promotor)}
          />

          {/* Email */}
          <CampoInfo
            colors={colors}
            corBorda={corBorda}
            icone="mail-outline"
            rotulo="E-mail"
            valor={promotor.email || "—"}
            onEditar={() => onAlterarLojas(promotor)}
          />

          {/* Data de criação */}
          <CampoInfo
            colors={colors}
            corBorda={corBorda}
            icone="calendar-today"
            rotulo="Cadastrado em"
            valor={dataFormatada}
          />

          {/* Lojas */}
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
                gap: 10,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                Lojas permitidas
              </Text>
              <Pressable
                onPress={() => onAlterarLojas(promotor)}
                hitSlop={6}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <MaterialIcons name="edit" size={16} color={COR_PRIMARIA} />
                <Text
                  style={{
                    color: COR_PRIMARIA,
                    fontSize: 14,
                    fontWeight: "bold",
                  }}
                >
                  Editar
                </Text>
              </Pressable>
            </View>

            {lojasDoPromotor.length === 0 ? (
              <Text style={{ color: colors.textSubtle, paddingVertical: 4 }}>
                Nenhuma loja vinculada
              </Text>
            ) : (
              <View style={{ gap: 2 }}>
                {lojasDoPromotor.map((loja, indice) => (
                  <View
                    key={loja.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 10,
                      borderTopWidth: indice === 0 ? 0 : 1,
                      borderTopColor: corBorda,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: "#F1ECFD",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons
                        name="storefront"
                        size={20}
                        color={COR_PRIMARIA}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.text,
                          fontWeight: "bold",
                          fontSize: 14,
                        }}
                      >
                        {loja.nome}
                      </Text>
                      {loja.cidade || loja.estado ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.textSubtle,
                            fontSize: 12,
                            paddingTop: 2,
                          }}
                        >
                          {loja.cidade || ""}
                          {loja.estado ? ` - ${loja.estado}` : ""}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Ações */}
          <View style={{ gap: 12, paddingTop: 10 }}>
            <Pressable
              onPress={() => onEnviarEmail(promotor)}
              style={{ minHeight: 54, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <MaterialIcons name={convitePendente ? "forward-to-inbox" : "lock-reset"} size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "bold", fontSize: 15 }}>
                {convitePendente ? "Reenviar convite" : "Enviar redefinicao de senha"}
              </Text>
            </Pressable>

            {!convitePendente ? <Pressable
              onPress={() => onAlterarAcesso(promotor)}
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
            </Pressable> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function CampoInfo({
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
          backgroundColor: "#F1ECFD",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icone} size={22} color={COR_PRIMARIA} />
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
          <MaterialIcons name="edit" size={20} color={COR_PRIMARIA} />
        </Pressable>
      ) : null}
    </View>
  );
}

function MenuAcoes({
  colors,
  corBorda,
  promotor,
  onFechar,
  onAlterarLojas,
  onAlterarAcesso,
  onEnviarEmail,
}: {
  colors: ThemeColors;
  corBorda: string;
  promotor: PromotorGerenciado | null;
  onFechar: () => void;
  onAlterarLojas: (p: PromotorGerenciado) => void;
  onAlterarAcesso: (p: PromotorGerenciado) => void;
  onEnviarEmail: (p: PromotorGerenciado) => void;
}) {
  if (!promotor) return null;
  const ativo = promotor.ativo !== false;
  const convitePendente = promotor.statusAcesso === "convite_pendente";

  return (
    <Modal
      visible={!!promotor}
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
            {promotor.nome}
          </Text>

          <ItemMenu
            colors={colors}
            icone="edit"
            corIcone={colors.primary}
            titulo="Editar dados"
            onPress={() => onAlterarLojas(promotor)}
          />
          <ItemMenu
            colors={colors}
            icone={convitePendente ? "forward-to-inbox" : "lock-reset"}
            corIcone={colors.primary}
            titulo={convitePendente ? "Reenviar convite" : "Enviar redefinicao de senha"}
            onPress={() => onEnviarEmail(promotor)}
          />
          {!convitePendente ? <ItemMenu
            colors={colors}
            icone={ativo ? "block" : "check-circle"}
            corIcone={ativo ? "#B45309" : "#16A34A"}
            titulo={ativo ? "Desativar acesso" : "Reativar acesso"}
            onPress={() => onAlterarAcesso(promotor)}
          /> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ItemMenu({
  colors,
  icone,
  corIcone,
  titulo,
  corTexto,
  onPress,
  disabled,
}: {
  colors: ThemeColors;
  icone: keyof typeof MaterialIcons.glyphMap;
  corIcone: string;
  titulo: string;
  corTexto?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 48,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <MaterialIcons name={icone} size={22} color={corIcone} />
      <Text
        style={{
          flex: 1,
          color: corTexto || colors.text,
          fontSize: 15,
          fontWeight: "500",
        }}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}
