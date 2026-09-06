import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";

import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";
import { onSnapshot } from "firebase/firestore";

import AdminBottomNav from "@/components/admin-bottom-nav";
import CardVisitaFotos from "@/components/card-visita-fotos";
import AvaliarVisita from "@/components/avaliar-visita";
import HistoricoAvaliacoes from "@/components/historico-avaliacoes";
import { agruparFotosPorVisita, type VisitaFotos } from "@/utils/visitas-fotos";
import ImageViewer from "@/components/photo-zoom-viewer";
import { useCategoriasFoto } from "@/hooks/use-categorias-foto";
import { categoriasParaFiltro } from "@/utils/catalogo-categorias";
import { STATUS_FOTO_FILTRO_OPCOES } from "@/constants/status-foto";
import { useTipoUsuario } from "@/contexts/usuario-context";
import { useEstadoPersistido } from "@/hooks/use-estado-persistido";
import {
  consultaFotosOrdenadasPorData,
  excluirFoto as excluirFotoPorId,
} from "@/services/fotos-service";
import { atualizarFotoComNotificacao } from "@/services/notificacoes";
import { consultaPromotores } from "@/services/usuarios-service";
import { useTheme } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import type { Foto } from "@/types/foto";
import { ehHoje, obterData } from "@/utils/datas";
import {
  filtrarFotosAtuais,
  obterCategoriaFoto,
  obterImagemUri,
} from "@/utils/fotos";
import {
  obterStatusFoto,
  textoStatusFoto,
  visualStatusPorTema,
} from "@/utils/status-foto";

const COR_FOTOS = "#0EA5E9";
const COR_FOTOS_FUNDO = "#E0F2FE";
const COR_LOJA_FUNDO = "#DCFCE7";
const COR_LOJA = "#16A34A";

const CORES_AVATAR_PROMOTOR: { fundo: string; texto: string }[] = [
  { fundo: "#DBEAFE", texto: "#1E40AF" },
  { fundo: "#EDE9FE", texto: "#6D28D9" },
  { fundo: "#DCFCE7", texto: "#166534" },
  { fundo: "#FED7AA", texto: "#9A3412" },
  { fundo: "#FCE7F3", texto: "#9D174D" },
  { fundo: "#CFFAFE", texto: "#155E75" },
  { fundo: "#FEF3C7", texto: "#92400E" },
];

function corAvatarPromotor(nome: string) {
  let hash = 0;
  const texto = nome || "?";
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return CORES_AVATAR_PROMOTOR[hash % CORES_AVATAR_PROMOTOR.length];
}

function iniciaisPromotor(nome: string) {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0][0]?.toUpperCase() || "?";
  return (
    (partes[0][0] || "") + (partes[partes.length - 1][0] || "")
  ).toUpperCase();
}

type PromotorMapa = {
  nome: string;
  email: string;
  fotoBase64?: string;
};

type ChipFiltro = {
  id: string;
  rotulo: string;
  remover: () => void;
};

export default function VerFotos() {
  const { colors, scheme } = useTheme();
  const { categorias } = useCategoriasFoto();
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [promotores, setPromotores] = useState<Record<string, PromotorMapa>>({});
  const [modoCompacto, setModoCompacto] = useEstadoPersistido<boolean>(
    "fotos:modoCompacto",
    false,
  );
  const tipoUsuario = useTipoUsuario();

  // Busca por promotor (input — não persiste)
  const [buscaPromotor, setBuscaPromotor] = useState("");

  // Filtros (multi-seleção, todos persistidos)
  const [lojasSelecionadas, setLojasSelecionadas] = useEstadoPersistido<
    string[]
  >("fotos:lojas", []);
  const [categoriasSelecionadas, setCategoriasSelecionadas] =
    useEstadoPersistido<string[]>("fotos:categorias", []);
  const [statusSelecionados, setStatusSelecionados] = useEstadoPersistido<
    string[]
  >("fotos:status", []);
  const [apenasHoje, setApenasHoje] = useEstadoPersistido<boolean>(
    "fotos:hoje",
    false,
  );
  const [filtrosAberto, setFiltrosAberto] = useState(false);

  // Modais
  const [fotoVisualizando, setFotoVisualizando] = useState<Foto | null>(null);
  const [fotoDetalhes, setFotoDetalhes] = useState<Foto | null>(null);
  const [menuFoto, setMenuFoto] = useState<Foto | null>(null);
  const [comentarioAlvo, setComentarioAlvo] = useState<{
    foto: Foto;
    status: "refazer" | "rejeitada";
  } | null>(null);
  const [comentarioAdmin, setComentarioAdmin] = useState("");
  const [confirmarExcluirAlvo, setConfirmarExcluirAlvo] = useState<Foto | null>(
    null,
  );
  const [excluindoFoto, setExcluindoFoto] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [baixandoFoto, setBaixandoFoto] = useState(false);
  const [visitaAvaliando, setVisitaAvaliando] = useState<VisitaFotos | null>(null);
  const fotoDetalhesAtual = fotoDetalhes ? fotos.find((foto) => foto.id === fotoDetalhes.id) || null : null;

  /* ---------- Carregamentos ---------- */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      consultaFotosOrdenadasPorData(),
      (snapshot) => {
        const lista = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Foto[];
        setFotos(filtrarFotosAtuais(lista));
      },
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Não foi possível carregar as fotos.");
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      consultaPromotores(),
      (snapshot) => {
        const mapa: Record<string, PromotorMapa> = {};
        snapshot.docs.forEach((item) => {
          const dados = item.data();
          mapa[item.id] = {
            nome: dados.nome || dados.email || "Promotor",
            email: dados.email || "",
            fotoBase64: dados.fotoBase64,
          };
        });
        setPromotores(mapa);
      },
      (error) => console.log(error),
    );
    return () => unsubscribe();
  }, []);

  /* ---------- Helpers ---------- */

  const nomePromotor = useCallback((foto: Foto) => {
    if (foto.promotorNome) return foto.promotorNome;
    if (foto.promotorId && promotores[foto.promotorId]) {
      return promotores[foto.promotorId].nome;
    }
    return foto.promotorEmail || "Promotor não identificado";
  }, [promotores]);

  function fotoPromotor(foto: Foto) {
    if (foto.promotorId && promotores[foto.promotorId]?.fotoBase64) {
      return promotores[foto.promotorId].fotoBase64;
    }
    return undefined;
  }

  /* ---------- Opções dos filtros ---------- */

  const lojasUnicas = useMemo(() => {
    return Array.from(
      new Set(fotos.map((f) => f.lojaNome || "Loja não informada")),
    ).sort((a, b) => a.localeCompare(b));
  }, [fotos]);

  const categoriasOpcoes = useMemo(
    () => categoriasParaFiltro(categorias, fotos.map(obterCategoriaFoto)),
    [categorias, fotos],
  );

  const statusOpcoes = useMemo(
    () => STATUS_FOTO_FILTRO_OPCOES.filter((s) => s !== "Todos"),
    [],
  );

  /* ---------- Lista filtrada ---------- */

  const fotosFiltradas = useMemo(() => {
    const termoBusca = buscaPromotor.trim().toLocaleLowerCase("pt-BR");

    return fotos.filter((foto) => {
      if (
        lojasSelecionadas.length > 0 &&
        !lojasSelecionadas.includes(foto.lojaNome || "Loja não informada")
      )
        return false;

      if (
        categoriasSelecionadas.length > 0 &&
        !categoriasSelecionadas.includes(obterCategoriaFoto(foto))
      )
        return false;

      if (
        statusSelecionados.length > 0 &&
        !statusSelecionados.includes(obterStatusFoto(foto.status))
      )
        return false;

      if (apenasHoje && !ehHoje(foto.criadoEm)) return false;

      if (termoBusca) {
        const nome = nomePromotor(foto).toLocaleLowerCase("pt-BR");
        const email = (foto.promotorEmail || "").toLocaleLowerCase("pt-BR");
        if (!nome.includes(termoBusca) && !email.includes(termoBusca)) {
          return false;
        }
      }

      return true;
    });
  }, [
    fotos,
    buscaPromotor,
    lojasSelecionadas,
    categoriasSelecionadas,
    statusSelecionados,
    apenasHoje,
    nomePromotor,
  ]);

  /* ---------- Chips ativos ---------- */

  const chipsAtivos = useMemo<ChipFiltro[]>(() => {
    const lista: ChipFiltro[] = [];

    lojasSelecionadas.forEach((loja) => {
      lista.push({
        id: `loja-${loja}`,
        rotulo: loja,
        remover: () =>
          setLojasSelecionadas((atuais) => atuais.filter((l) => l !== loja)),
      });
    });

    categoriasSelecionadas.forEach((cat) => {
      lista.push({
        id: `cat-${cat}`,
        rotulo: cat,
        remover: () =>
          setCategoriasSelecionadas((atuais) =>
            atuais.filter((c) => c !== cat),
          ),
      });
    });

    statusSelecionados.forEach((st) => {
      lista.push({
        id: `st-${st}`,
        rotulo: textoStatusFoto(st),
        remover: () =>
          setStatusSelecionados((atuais) => atuais.filter((s) => s !== st)),
      });
    });

    if (apenasHoje) {
      lista.push({
        id: "hoje",
        rotulo: "Hoje",
        remover: () => setApenasHoje(false),
      });
    }

    return lista;
  }, [
    lojasSelecionadas,
    categoriasSelecionadas,
    statusSelecionados,
    apenasHoje,
    setLojasSelecionadas,
    setCategoriasSelecionadas,
    setStatusSelecionados,
    setApenasHoje,
  ]);

  const totalFiltros = chipsAtivos.length;

  function limparTodosFiltros() {
    setLojasSelecionadas([]);
    setCategoriasSelecionadas([]);
    setStatusSelecionados([]);
    setApenasHoje(false);
  }

  /* ---------- Ações sobre uma foto ---------- */

  async function aprovarFoto(foto: Foto) {
    if (salvandoStatus) return;
    try {
      setSalvandoStatus(true);
      await atualizarFotoComNotificacao({
        foto,
        status: "aprovada",
        comentario: "",
      });
      setMenuFoto(null);
      Alert.alert("Sucesso", "Foto aprovada.");
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Erro",
        error.message || "Não foi possível atualizar a foto.",
      );
    } finally {
      setSalvandoStatus(false);
    }
  }

  function abrirComentario(foto: Foto, status: "refazer" | "rejeitada") {
    setMenuFoto(null);
    setComentarioAlvo({ foto, status });
    setComentarioAdmin(foto.comentarioAdmin || "");
  }

  async function salvarComentario() {
    if (!comentarioAlvo || salvandoStatus) return;
    const comentario = comentarioAdmin.trim();
    try {
      setSalvandoStatus(true);
      await atualizarFotoComNotificacao({
        foto: comentarioAlvo.foto,
        status: comentarioAlvo.status,
        comentario,
      });
      setComentarioAlvo(null);
      setComentarioAdmin("");
      Alert.alert(
        "Sucesso",
        `Foto marcada como ${textoStatusFoto(comentarioAlvo.status)}.`,
      );
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Erro",
        error.message || "Não foi possível atualizar a foto.",
      );
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function baixarFoto(foto: Foto) {
    if (baixandoFoto) return;
    try {
      setBaixandoFoto(true);
      setMenuFoto(null);
      const imagemUri = obterImagemUri(foto);
      if (!imagemUri) {
        Alert.alert("Erro", "Esta foto não possui imagem para baixar.");
        return;
      }
      if (!imagemUri.startsWith("data:")) {
        const nomeArquivo = `foto-${foto.id}.jpg`;
        const uriArquivo = `${FileSystem.cacheDirectory}${nomeArquivo}`;
        const resultado = await FileSystem.downloadAsync(imagemUri, uriArquivo);
        await MediaLibrary.saveToLibraryAsync(resultado.uri);
        Alert.alert("Sucesso", "Foto baixada na galeria.");
        return;
      }
      const dadosImagem = imagemUri.match(
        /^data:(image\/([a-zA-Z0-9.+-]+));base64,(.*)$/,
      );
      if (!dadosImagem) {
        Alert.alert("Erro", "Não foi possível preparar esta foto.");
        return;
      }
      const extensaoOriginal = dadosImagem[2].toLowerCase();
      const extensao = extensaoOriginal === "jpeg" ? "jpg" : extensaoOriginal;
      const base64 = dadosImagem[3];
      const nomeArquivo = `foto-${foto.id}.${extensao}`;
      const uriArquivo = `${FileSystem.cacheDirectory}${nomeArquivo}`;
      await FileSystem.writeAsStringAsync(uriArquivo, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await MediaLibrary.saveToLibraryAsync(uriArquivo);
      Alert.alert("Sucesso", "Foto baixada na galeria.");
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", error.message || "Não foi possível baixar a foto.");
    } finally {
      setBaixandoFoto(false);
    }
  }

  function confirmarExcluir(foto: Foto) {
    setMenuFoto(null);
    setConfirmarExcluirAlvo(foto);
  }

  async function excluirAgora() {
    if (!confirmarExcluirAlvo || excluindoFoto) return;
    const id = confirmarExcluirAlvo.id;
    try {
      setExcluindoFoto(true);
      await excluirFotoPorId(id);
      setFotos((atual) => atual.filter((f) => f.id !== id));
      setConfirmarExcluirAlvo(null);
      Alert.alert("Sucesso", "Foto excluída.");
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Erro ao excluir",
        error.message || "Não foi possível excluir a foto.",
      );
    } finally {
      setExcluindoFoto(false);
    }
  }

  const visitasFiltradas = useMemo(() => agruparFotosPorVisita(fotos, fotosFiltradas), [fotos, fotosFiltradas]);

  /* ---------- Estilos compartilhados ---------- */

  const corBordaSuave =
    scheme === "light" ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={visitasFiltradas}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 110,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListHeaderComponent={
          <View style={{ paddingBottom: 14 }}>
            {/* Título + toggle modo */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingTop: 8,
                paddingBottom: 14,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 28,
                    fontWeight: "bold",
                  }}
                >
                  Visitas
                </Text>
                <Text
                  style={{
                    color: colors.textSubtle,
                    paddingTop: 2,
                    fontSize: 13,
                  }}
                >
                  {visitasFiltradas.length} visita(s) · {fotosFiltradas.length} foto(s) nos filtros
                </Text>
              </View>
              <Pressable
                onPress={() => setModoCompacto((v) => !v)}
                accessibilityLabel={
                  modoCompacto ? "Modo detalhado" : "Modo compacto"
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: corBordaSuave,
                  backgroundColor: colors.surface,
                }}
              >
                <MaterialIcons
                  name={modoCompacto ? "view-agenda" : "view-list"}
                  size={20}
                  color={COR_FOTOS}
                />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: "bold",
                  }}
                >
                  {modoCompacto ? "Detalhado" : "Compacto"}
                </Text>
              </Pressable>
            </View>

            {/* Busca por promotor + filtro */}
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
                  value={buscaPromotor}
                  onChangeText={setBuscaPromotor}
                  placeholder="Buscar promotor..."
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
                onPress={() => setFiltrosAberto(true)}
                accessibilityLabel="Filtrar"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor:
                    totalFiltros > 0 ? COR_FOTOS : corBordaSuave,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons
                  name="filter-list"
                  size={22}
                  color={totalFiltros > 0 ? COR_FOTOS : colors.text}
                />
                {totalFiltros > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: COR_FOTOS,
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
                      }}
                    >
                      {totalFiltros}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>

            {/* Chips de filtros ativos */}
            {chipsAtivos.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 6,
                  paddingTop: 12,
                }}
              >
                {chipsAtivos.map((chip) => (
                  <View
                    key={chip.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingLeft: 9,
                      paddingRight: 5,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: COR_FOTOS_FUNDO,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: COR_FOTOS,
                        fontSize: 11,
                        fontWeight: "bold",
                        maxWidth: 130,
                      }}
                    >
                      {chip.rotulo}
                    </Text>
                    <Pressable
                      onPress={chip.remover}
                      hitSlop={6}
                      accessibilityLabel={`Remover filtro ${chip.rotulo}`}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="close" size={12} color={COR_FOTOS} />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={limparTodosFiltros}
                  hitSlop={6}
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSubtle,
                      fontSize: 11,
                      fontWeight: "bold",
                    }}
                  >
                    Limpar tudo
                  </Text>
                </Pressable>
              </View>
            ) : null}
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
              name="image-search"
              size={36}
              color={colors.iconMuted}
            />
            <Text style={{ color: colors.text, fontWeight: "bold" }}>
              Nenhuma visita encontrada
            </Text>
            <Text style={{ color: colors.textSubtle, textAlign: "center" }}>
              Ajuste os filtros ou busca para ver outros envios.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CardVisitaFotos
            key={item.correspondentes.join(",")}
            visita={item}
            nomePromotor={nomePromotor(item.fotos[0])}
            compacto={modoCompacto}
            bloqueado={salvandoStatus}
            onVisualizarFoto={setFotoVisualizando}
            onAbrirFoto={setFotoDetalhes}
            onMenuFoto={setMenuFoto}
            onAvaliarVisita={setVisitaAvaliando}
          />
        )}
      />

      <AdminBottomNav abaAtiva="fotos" tipoUsuario={tipoUsuario} />
      {visitaAvaliando ? <AvaliarVisita visita={visitaAvaliando} onFechar={() => setVisitaAvaliando(null)} /> : null}

      {/* Modal Filtros */}
      <ModalFiltros
        colors={colors}
        corBorda={corBordaSuave}
        scheme={scheme}
        visivel={filtrosAberto}
        onFechar={() => setFiltrosAberto(false)}
        lojas={lojasUnicas}
        categorias={categoriasOpcoes}
        statusOpcoes={statusOpcoes}
        lojasSelecionadas={lojasSelecionadas}
        categoriasSelecionadas={categoriasSelecionadas}
        statusSelecionados={statusSelecionados}
        apenasHoje={apenasHoje}
        onConfirmar={(novosFiltros) => {
          setLojasSelecionadas(novosFiltros.lojas);
          setCategoriasSelecionadas(novosFiltros.categorias);
          setStatusSelecionados(novosFiltros.status);
          setApenasHoje(novosFiltros.hoje);
          setFiltrosAberto(false);
        }}
      />

      {/* Modal Menu de Ações */}
      <MenuAcoesFoto
        colors={colors}
        corBorda={corBordaSuave}
        foto={menuFoto}
        onFechar={() => setMenuFoto(null)}
        onBaixar={baixarFoto}
        onAprovar={aprovarFoto}
        onRefazer={(f) => abrirComentario(f, "refazer")}
        onRejeitar={(f) => abrirComentario(f, "rejeitada")}
        onExcluir={confirmarExcluir}
        baixando={baixandoFoto}
        salvandoStatus={salvandoStatus}
      />

      {/* Modal Detalhes do envio */}
      <ModalDetalhesEnvio
        colors={colors}
        corBorda={corBordaSuave}
        scheme={scheme}
        foto={fotoDetalhesAtual}
        nomePromotor={fotoDetalhesAtual ? nomePromotor(fotoDetalhesAtual) : ""}
        fotoPromotor={fotoDetalhesAtual ? fotoPromotor(fotoDetalhesAtual) : undefined}
        onFechar={() => setFotoDetalhes(null)}
        onVisualizarImagem={() => {
          const f = fotoDetalhes;
          setFotoDetalhes(null);
          if (f) setFotoVisualizando(f);
        }}
      />

      {/* Modal Zoom da imagem (limpo) */}
      <ModalZoomImagem
        foto={fotoVisualizando}
        onFechar={() => setFotoVisualizando(null)}
      />

      {/* Modal Comentário (refazer / rejeitar) */}
      <ModalComentario
        colors={colors}
        corBorda={corBordaSuave}
        alvo={comentarioAlvo}
        comentario={comentarioAdmin}
        onComentarioChange={setComentarioAdmin}
        salvando={salvandoStatus}
        onCancelar={() => {
          setComentarioAlvo(null);
          setComentarioAdmin("");
        }}
        onSalvar={salvarComentario}
      />

      {/* Modal Confirmação de exclusão */}
      <ModalConfirmarExclusao
        colors={colors}
        corBorda={corBordaSuave}
        foto={confirmarExcluirAlvo}
        excluindo={excluindoFoto}
        onCancelar={() => setConfirmarExcluirAlvo(null)}
        onConfirmar={excluirAgora}
      />
    </View>
  );
}

/* ---------- Card de Foto ---------- */


/* ---------- Modal Filtros ---------- */

function ModalFiltros({
  colors,
  corBorda,
  scheme,
  visivel,
  onFechar,
  lojas,
  categorias,
  statusOpcoes,
  lojasSelecionadas,
  categoriasSelecionadas,
  statusSelecionados,
  apenasHoje,
  onConfirmar,
}: {
  colors: ThemeColors;
  corBorda: string;
  scheme: "light" | "dark";
  visivel: boolean;
  onFechar: () => void;
  lojas: string[];
  categorias: string[];
  statusOpcoes: string[];
  lojasSelecionadas: string[];
  categoriasSelecionadas: string[];
  statusSelecionados: string[];
  apenasHoje: boolean;
  onConfirmar: (f: {
    lojas: string[];
    categorias: string[];
    status: string[];
    hoje: boolean;
  }) => void;
}) {
  const [lojasLocais, setLojasLocais] = useState<string[]>(lojasSelecionadas);
  const [catLocais, setCatLocais] = useState<string[]>(categoriasSelecionadas);
  const [statLocais, setStatLocais] = useState<string[]>(statusSelecionados);
  const [hojeLocal, setHojeLocal] = useState(apenasHoje);

  useEffect(() => {
    if (!visivel) return;

    const timeoutId = setTimeout(() => {
      setLojasLocais(lojasSelecionadas);
      setCatLocais(categoriasSelecionadas);
      setStatLocais(statusSelecionados);
      setHojeLocal(apenasHoje);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [
    visivel,
    lojasSelecionadas,
    categoriasSelecionadas,
    statusSelecionados,
    apenasHoje,
  ]);

  function alternar(lista: string[], item: string) {
    return lista.includes(item)
      ? lista.filter((x) => x !== item)
      : [...lista, item];
  }

  function limpar() {
    setLojasLocais([]);
    setCatLocais([]);
    setStatLocais([]);
    setHojeLocal(false);
  }

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="slide"
      onRequestClose={onFechar}
    >
      <Pressable
        onPress={onFechar}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 10,
            paddingBottom: 28,
            maxHeight: "85%",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 42,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 12,
            }}
          />

          <View
            style={{
              paddingHorizontal: 20,
              paddingBottom: 14,
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
              Filtros
            </Text>
            <Pressable onPress={limpar} hitSlop={6}>
              <Text
                style={{
                  color: COR_FOTOS,
                  fontWeight: "bold",
                  fontSize: 14,
                }}
              >
                Limpar
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingVertical: 14,
              gap: 18,
            }}
          >
            {/* Filtro por dia */}
            <Pressable
              onPress={() => setHojeLocal((v) => !v)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 8,
              }}
            >
              <MaterialIcons
                name={hojeLocal ? "check-box" : "check-box-outline-blank"}
                size={22}
                color={hojeLocal ? COR_FOTOS : colors.iconMuted}
              />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 15,
                  fontWeight: "bold",
                }}
              >
                Apenas fotos de hoje
              </Text>
            </Pressable>

            {/* Status */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.textSubtle,
                  fontSize: 12,
                  fontWeight: "bold",
                  letterSpacing: 0.5,
                }}
              >
                STATUS
              </Text>
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
              >
                {statusOpcoes.map((st) => {
                  const ativo = statLocais.includes(st);
                  return (
                    <Pressable
                      key={st}
                      onPress={() => setStatLocais(alternar(statLocais, st))}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: ativo ? COR_FOTOS : corBorda,
                        backgroundColor: ativo
                          ? COR_FOTOS_FUNDO
                          : colors.surface,
                      }}
                    >
                      <Text
                        style={{
                          color: ativo ? COR_FOTOS : colors.text,
                          fontSize: 13,
                          fontWeight: "bold",
                        }}
                      >
                        {textoStatusFoto(st)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Categorias */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.textSubtle,
                  fontSize: 12,
                  fontWeight: "bold",
                  letterSpacing: 0.5,
                }}
              >
                CATEGORIA
              </Text>
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
              >
                {categorias.map((cat) => {
                  const ativo = catLocais.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCatLocais(alternar(catLocais, cat))}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: ativo ? COR_FOTOS : corBorda,
                        backgroundColor: ativo
                          ? COR_FOTOS_FUNDO
                          : colors.surface,
                      }}
                    >
                      <Text
                        style={{
                          color: ativo ? COR_FOTOS : colors.text,
                          fontSize: 13,
                          fontWeight: "bold",
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Lojas */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.textSubtle,
                  fontSize: 12,
                  fontWeight: "bold",
                  letterSpacing: 0.5,
                }}
              >
                LOJA
              </Text>
              {lojas.length === 0 ? (
                <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                  Nenhuma loja com fotos enviadas ainda.
                </Text>
              ) : (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {lojas.map((loja) => {
                    const ativo = lojasLocais.includes(loja);
                    return (
                      <Pressable
                        key={loja}
                        onPress={() =>
                          setLojasLocais(alternar(lojasLocais, loja))
                        }
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: ativo ? COR_FOTOS : corBorda,
                          backgroundColor: ativo
                            ? COR_FOTOS_FUNDO
                            : colors.surface,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: ativo ? COR_FOTOS : colors.text,
                            fontSize: 13,
                            fontWeight: "bold",
                            maxWidth: 200,
                          }}
                        >
                          {loja}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: corBorda,
            }}
          >
            <Pressable
              onPress={() =>
                onConfirmar({
                  lojas: lojasLocais,
                  categorias: catLocais,
                  status: statLocais,
                  hoje: hojeLocal,
                })
              }
              style={{
                minHeight: 52,
                borderRadius: 12,
                backgroundColor: COR_FOTOS,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
                Aplicar filtros
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Menu de ações ---------- */

function MenuAcoesFoto({
  colors,
  corBorda,
  foto,
  onFechar,
  onBaixar,
  onAprovar,
  onRefazer,
  onRejeitar,
  onExcluir,
  baixando,
  salvandoStatus,
}: {
  colors: ThemeColors;
  corBorda: string;
  foto: Foto | null;
  onFechar: () => void;
  onBaixar: (f: Foto) => void;
  onAprovar: (f: Foto) => void;
  onRefazer: (f: Foto) => void;
  onRejeitar: (f: Foto) => void;
  onExcluir: (f: Foto) => void;
  baixando: boolean;
  salvandoStatus: boolean;
}) {
  if (!foto) return null;

  return (
    <Modal
      visible={!!foto}
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
            {foto.lojaNome || "Foto"}
          </Text>

          <ItemMenu
            colors={colors}
            icone="download"
            corIcone={COR_FOTOS}
            titulo={baixando ? "Baixando..." : "Baixar foto"}
            onPress={() => onBaixar(foto)}
            disabled={baixando}
          />
          <ItemMenu
            colors={colors}
            icone="check-circle"
            corIcone="#16A34A"
            titulo="Aprovar"
            onPress={() => onAprovar(foto)}
            disabled={salvandoStatus}
          />
          <ItemMenu
            colors={colors}
            icone="replay"
            corIcone="#EA580C"
            titulo="Pedir para refazer"
            onPress={() => onRefazer(foto)}
            disabled={salvandoStatus}
          />
          <ItemMenu
            colors={colors}
            icone="cancel"
            corIcone="#DC2626"
            titulo="Rejeitar"
            onPress={() => onRejeitar(foto)}
            disabled={salvandoStatus}
          />
          <View
            style={{ height: 1, backgroundColor: corBorda, marginVertical: 4 }}
          />
          <ItemMenu
            colors={colors}
            icone="delete-outline"
            corIcone="#DC2626"
            corTexto="#DC2626"
            titulo="Excluir foto"
            onPress={() => onExcluir(foto)}
          />
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
        opacity: disabled ? 0.5 : 1,
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

/* ---------- Modal Zoom da imagem (limpo) ---------- */

function ModalZoomImagem({
  foto,
  onFechar,
}: {
  foto: Foto | null;
  onFechar: () => void;
}) {
  if (!foto) return null;
  const imagemUri = obterImagemUri(foto);

  return (
    <Modal
      visible={!!foto}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <View style={{ flex: 1, backgroundColor: "black" }}>
        <Pressable
          onPress={onFechar}
          accessibilityLabel="Fechar"
          style={{
            position: "absolute",
            top: 50,
            right: 18,
            zIndex: 10,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="close" size={24} color="white" />
        </Pressable>

        <ImageViewer
          imageUrls={imagemUri ? [{ url: imagemUri }] : []}
          backgroundColor="black"
          enableImageZoom
          enableSwipeDown
          onSwipeDown={onFechar}
          renderIndicator={() => <View />}
          saveToLocalByLongPress={false}
          style={{ flex: 1, width: "100%" }}
          useNativeDriver={false}
        />
      </View>
    </Modal>
  );
}

/* ---------- Modal de Detalhes do envio ---------- */

function ModalDetalhesEnvio({
  colors,
  corBorda,
  scheme,
  foto,
  nomePromotor,
  fotoPromotor,
  onFechar,
  onVisualizarImagem,
}: {
  colors: ThemeColors;
  corBorda: string;
  scheme: "light" | "dark";
  foto: Foto | null;
  nomePromotor: string;
  fotoPromotor?: string;
  onFechar: () => void;
  onVisualizarImagem: () => void;
}) {
  if (!foto) return null;

  const status = obterStatusFoto(foto.status);
  const visual = visualStatusPorTema(status, scheme);
  const categoria = obterCategoriaFoto(foto);
  const data = obterData(foto.criadoEm);
  const dataFormatada = data ? data.toLocaleString("pt-BR") : "Sem data";
  const avatar = corAvatarPromotor(nomePromotor);
  const iniciais = iniciaisPromotor(nomePromotor);
  const imagemUri = obterImagemUri(foto);

  return (
    <Modal
      visible={!!foto}
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
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}>
            Detalhes do envio
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
          {/* Loja */}
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: COR_LOJA_FUNDO,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="storefront" size={28} color={COR_LOJA} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.textSubtle, fontSize: 12 }}>
                Loja
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: "bold",
                  paddingTop: 2,
                }}
              >
                {foto.lojaNome || "Loja não informada"}
              </Text>
            </View>
          </View>

          {/* Badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <View
              style={{
                backgroundColor: COR_FOTOS_FUNDO,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  color: COR_FOTOS,
                  fontSize: 12,
                  fontWeight: "bold",
                }}
              >
                {categoria}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: visual.fundo,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  color: visual.texto,
                  fontSize: 12,
                  fontWeight: "bold",
                }}
              >
                {textoStatusFoto(status)}
              </Text>
            </View>
            {foto.refacaoDeId ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: "#FFEDD5",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                }}
              >
                <MaterialIcons name="history" size={13} color="#9A3412" />
                <Text
                  style={{
                    color: "#9A3412",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  Refação {foto.numeroRefacao || 1}
                </Text>
              </View>
            ) : null}
          </View>

          <HistoricoAvaliacoes key={foto.id} foto={foto} />

          {/* Foto */}
          {imagemUri ? (
            <Pressable
              onPress={onVisualizarImagem}
              style={{ borderRadius: 12, overflow: "hidden" }}
            >
              <Image
                source={{ uri: imagemUri }}
                style={{
                  width: "100%",
                  height: 240,
                  backgroundColor: colors.surfaceHighlight,
                }}
                resizeMode="cover"
              />
              <View
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <MaterialIcons name="zoom-in" size={14} color="white" />
                <Text
                  style={{ color: "white", fontSize: 12, fontWeight: "bold" }}
                >
                  Toque para ampliar
                </Text>
              </View>
            </Pressable>
          ) : null}

          {/* Promotor */}
          <CampoEnvio
            colors={colors}
            corBorda={corBorda}
            rotulo="Promotor"
            valor={nomePromotor}
            subValor={foto.promotorEmail || ""}
            leading={
              fotoPromotor ? (
                <Image
                  source={{ uri: fotoPromotor }}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: avatar.fundo,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: avatar.fundo,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: avatar.texto,
                      fontWeight: "bold",
                      fontSize: 14,
                    }}
                  >
                    {iniciais}
                  </Text>
                </View>
              )
            }
          />

          {/* Data */}
          <CampoEnvio
            colors={colors}
            corBorda={corBorda}
            icone="schedule"
            rotulo="Enviada em"
            valor={dataFormatada}
          />

          {/* Observação do promotor */}
          <CampoEnvio
            colors={colors}
            corBorda={corBorda}
            icone="chat-bubble-outline"
            rotulo="Observação do promotor"
            valor={foto.observacao || "Sem observação"}
            italico={!foto.observacao}
            multiplaLinha
          />

          {/* Comentário do admin */}
          {foto.comentarioAdmin ? (
            <View
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: visual.fundo,
                borderLeftWidth: 3,
                borderLeftColor: visual.texto,
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: visual.texto,
                  fontSize: 11,
                  fontWeight: "bold",
                  letterSpacing: 0.5,
                }}
              >
                COMENTÁRIO DO RESPONSÁVEL
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {foto.comentarioAdmin}
              </Text>
            </View>
          ) : null}

          {/* Motivo da refação anterior */}
          {foto.refacaoDeId && foto.motivoRefacao ? (
            <View
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: "#FFEDD5",
                borderLeftWidth: 3,
                borderLeftColor: "#9A3412",
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: "#9A3412",
                  fontSize: 11,
                  fontWeight: "bold",
                  letterSpacing: 0.5,
                }}
              >
                MOTIVO DA REFAÇÃO
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {foto.motivoRefacao}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CampoEnvio({
  colors,
  corBorda,
  icone,
  leading,
  rotulo,
  valor,
  subValor,
  italico,
  multiplaLinha,
}: {
  colors: ThemeColors;
  corBorda: string;
  icone?: keyof typeof MaterialIcons.glyphMap;
  leading?: React.ReactNode;
  rotulo: string;
  valor: string;
  subValor?: string;
  italico?: boolean;
  multiplaLinha?: boolean;
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
        alignItems: multiplaLinha ? "flex-start" : "center",
        gap: 14,
      }}
    >
      {leading ? (
        leading
      ) : icone ? (
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            backgroundColor: COR_FOTOS_FUNDO,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name={icone} size={22} color={COR_FOTOS} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{rotulo}</Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 15,
            fontWeight: "bold",
            fontStyle: italico ? "italic" : "normal",
            lineHeight: multiplaLinha ? 21 : undefined,
          }}
        >
          {valor}
        </Text>
        {subValor ? (
          <Text
            numberOfLines={1}
            style={{
              color: colors.textSubtle,
              fontSize: 12,
              paddingTop: 2,
            }}
          >
            {subValor}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ---------- Modal Comentário (refazer/rejeitar) ---------- */

function ModalComentario({
  colors,
  corBorda,
  alvo,
  comentario,
  onComentarioChange,
  salvando,
  onCancelar,
  onSalvar,
}: {
  colors: ThemeColors;
  corBorda: string;
  alvo: { foto: Foto; status: "refazer" | "rejeitada" } | null;
  comentario: string;
  onComentarioChange: (v: string) => void;
  salvando: boolean;
  onCancelar: () => void;
  onSalvar: () => void;
}) {
  if (!alvo) return null;

  return (
    <Modal
      visible={!!alvo}
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          onPress={onCancelar}
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.5)",
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
              padding: 20,
              gap: 14,
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}
            >
              Motivo para {textoStatusFoto(alvo.status)}
            </Text>
            <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
              Esse comentário será exibido para o promotor.
            </Text>

            <TextInput
              value={comentario}
              onChangeText={onComentarioChange}
              placeholder="Ex: foto sem preço visível"
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
              autoFocus
              style={{
                minHeight: 110,
                borderWidth: 1,
                borderColor: corBorda,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
                backgroundColor: colors.backgroundAlt,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={onCancelar}
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: corBorda,
                  backgroundColor: colors.surfaceElevated,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={onSalvar}
                disabled={salvando}
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 10,
                  backgroundColor: COR_FOTOS,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: salvando ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {salvando ? "Salvando..." : "Salvar"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Modal Confirmar exclusão ---------- */

function ModalConfirmarExclusao({
  colors,
  corBorda,
  foto,
  excluindo,
  onCancelar,
  onConfirmar,
}: {
  colors: ThemeColors;
  corBorda: string;
  foto: Foto | null;
  excluindo: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  if (!foto) return null;

  return (
    <Modal
      visible={!!foto}
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.5)",
          justifyContent: "center",
          padding: 22,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: corBorda,
            padding: 20,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "#FEE2E2",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons
              name="delete-outline"
              size={26}
              color="#DC2626"
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text
              style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}
            >
              Excluir foto
            </Text>
            <Text style={{ color: colors.textSubtle, lineHeight: 20 }}>
              Esta foto será removida permanentemente e não poderá ser
              recuperada.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, paddingTop: 4 }}>
            <Pressable
              onPress={onCancelar}
              disabled={excluindo}
              style={{
                flex: 1,
                minHeight: 46,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: corBorda,
                backgroundColor: colors.surfaceElevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "bold" }}>
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirmar}
              disabled={excluindo}
              style={{
                flex: 1,
                minHeight: 46,
                borderRadius: 10,
                backgroundColor: "#DC2626",
                alignItems: "center",
                justifyContent: "center",
                opacity: excluindo ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                {excluindo ? "Excluindo..." : "Excluir"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
