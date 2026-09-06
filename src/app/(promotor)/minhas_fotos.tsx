import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { onSnapshot } from "firebase/firestore";

import ImageViewer from "@/components/photo-zoom-viewer";
import { ROTAS } from "@/constants/routes";
import { STATUS_FOTO_FILTRO_OPCOES } from "@/constants/status-foto";
import { auth } from "@/services/firebaseConfig";
import {
  consultaFotosDoPromotor,
  excluirFoto,
  moverFotoParaLixeira,
  restaurarFotoDaLixeira,
} from "@/services/fotos-service";
import { useTheme } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import type { Foto } from "@/types/foto";
import { obterData } from "@/utils/datas";
import {
  filtrarFotosAtuais,
  filtrarFotosNaLixeira,
  obterCategoriaFoto as obterCategoria,
  obterImagemUri,
  obterRotuloVisita,
  ordenarFotosRecentes,
} from "@/utils/fotos";
import {
  obterStatusFoto,
  textoStatusFoto,
  visualStatusPorTema,
} from "@/utils/status-foto";

type ModoLista = "ativas" | "lixeira";
type Periodo = "Todas" | "Hoje" | "7 dias" | "30 dias";
type AcaoConfirmacao = "lixeira" | "definitiva" | null;

const statusOpcoes = [...STATUS_FOTO_FILTRO_OPCOES];
const periodos: Periodo[] = ["Todas", "Hoje", "7 dias", "30 dias"];

function obterStatus(foto: Foto) {
  return obterStatusFoto(foto.status);
}

function textoStatus(status: string) {
  return textoStatusFoto(status);
}

function estaNoPeriodo(dataFirebase: any, periodo: Periodo) {
  if (periodo === "Todas") return true;

  const data = obterData(dataFirebase);
  if (!data) return false;

  const agora = new Date();
  if (periodo === "Hoje") {
    return (
      data.getDate() === agora.getDate() &&
      data.getMonth() === agora.getMonth() &&
      data.getFullYear() === agora.getFullYear()
    );
  }

  const dias = periodo === "7 dias" ? 7 : 30;
  const inicio = new Date(agora);
  inicio.setDate(inicio.getDate() - dias);
  inicio.setHours(0, 0, 0, 0);
  return data >= inicio;
}

export default function MinhasFotos() {
  const { colors, scheme } = useTheme();
  const parametros = useLocalSearchParams<{
    modoInicial?: string;
    statusInicial?: string;
    fotoInicialId?: string;
  }>();
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [modo, setModo] = useState<ModoLista>(
    parametros.modoInicial === "lixeira" ? "lixeira" : "ativas",
  );
  const [lojaFiltro, setLojaFiltro] = useState("Todas");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [statusFiltro, setStatusFiltro] = useState(
    statusOpcoes.find((status) => status === parametros.statusInicial) ||
      "Todos",
  );
  const [periodoFiltro, setPeriodoFiltro] = useState<Periodo>("Todas");
  const [fotoSelecionada, setFotoSelecionada] = useState<Foto | null>(null);
  const [confirmacao, setConfirmacao] = useState<AcaoConfirmacao>(null);
  const [processando, setProcessando] = useState(false);
  const fotoInicialProcessada = useRef(false);

  function visualStatus(status: string) {
    return visualStatusPorTema(status, scheme);
  }

  useEffect(() => {
    const usuarioAtual = auth.currentUser;

    if (!usuarioAtual) {
      router.replace(ROTAS.login);
      return;
    }

    return onSnapshot(consultaFotosDoPromotor(usuarioAtual.uid), (snapshot) => {
      const lista = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Foto[];

      setFotos(ordenarFotosRecentes(lista));
    });
  }, []);

  const fotosAtivas = useMemo(() => filtrarFotosAtuais(fotos), [fotos]);
  const fotosLixeira = useMemo(() => filtrarFotosNaLixeira(fotos), [fotos]);

  const opcoes = useMemo(
    () => ({
      lojas: [
        "Todas",
        ...new Set(
          fotosAtivas.map((foto) => foto.lojaNome || "Loja nao informada"),
        ),
      ],
      categorias: [
        "Todas",
        ...new Set(fotosAtivas.map((foto) => obterCategoria(foto))),
      ],
    }),
    [fotosAtivas],
  );

  const fotosFiltradas = useMemo(() => {
    const origem = modo === "lixeira" ? fotosLixeira : fotosAtivas;

    return origem.filter(
      (foto) =>
        (lojaFiltro === "Todas" ||
          (foto.lojaNome || "Loja nao informada") === lojaFiltro) &&
        (categoriaFiltro === "Todas" ||
          obterCategoria(foto) === categoriaFiltro) &&
        (statusFiltro === "Todos" || obterStatus(foto) === statusFiltro) &&
        estaNoPeriodo(foto.criadoEm, periodoFiltro),
    );
  }, [
    categoriaFiltro,
    fotosAtivas,
    fotosLixeira,
    lojaFiltro,
    modo,
    periodoFiltro,
    statusFiltro,
  ]);

  useEffect(() => {
    if (fotoInicialProcessada.current || !parametros.fotoInicialId) return;

    const foto = fotosAtivas.find(
      (item) => item.id === parametros.fotoInicialId,
    );
    if (!foto) return;

    fotoInicialProcessada.current = true;
    const timeoutId = setTimeout(() => {
      setFotoSelecionada(foto);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fotosAtivas, parametros.fotoInicialId]);

  function formatarData(valor: any) {
    return obterData(valor)?.toLocaleString("pt-BR") || "Data nao disponivel";
  }

  function trocarModo(novoModo: ModoLista) {
    setModo(novoModo);
    setFotoSelecionada(null);
  }

  function refazerFoto(foto: Foto) {
    if (!foto.lojaId) {
      Alert.alert(
        "Loja não identificada",
        "Esta foto antiga não possui o identificador da loja.",
      );
      return;
    }

    setFotoSelecionada(null);
    router.push({
      pathname: ROTAS.enviarFoto,
      params: {
        lojaId: foto.lojaId,
        lojaNome: foto.lojaNome,
        categoriaInicial: foto.categoria,
        refacaoDeId: foto.id,
        numeroRefacao: (foto.numeroRefacao || 0) + 1,
        motivoRefacao: foto.comentarioAdmin || "",
      },
    });
  }

  async function moverParaLixeira(foto: Foto) {
    const usuarioAtual = auth.currentUser;
    if (!usuarioAtual || processando) return;

    try {
      setProcessando(true);
      await moverFotoParaLixeira(foto.id, usuarioAtual.uid);
      setFotoSelecionada(null);
      setConfirmacao(null);
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Nao foi possivel mover a foto",
        error.message || "Verifique sua conexao e tente novamente.",
      );
    } finally {
      setProcessando(false);
    }
  }

  async function restaurarFoto(foto: Foto) {
    if (processando) return;

    try {
      setProcessando(true);
      await restaurarFotoDaLixeira(foto.id);
      setFotoSelecionada(null);
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Nao foi possivel restaurar a foto",
        error.message || "Verifique sua conexao e tente novamente.",
      );
    } finally {
      setProcessando(false);
    }
  }

  async function excluirDefinitivamente(foto: Foto) {
    if (processando) return;

    try {
      setProcessando(true);
      await excluirFoto(foto.id);
      setFotoSelecionada(null);
      setConfirmacao(null);
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Nao foi possivel excluir a foto",
        error.message || "Verifique sua conexao e tente novamente.",
      );
    } finally {
      setProcessando(false);
    }
  }

  function executarConfirmacao() {
    if (!fotoSelecionada) return;
    if (confirmacao === "lixeira") moverParaLixeira(fotoSelecionada);
    if (confirmacao === "definitiva") excluirDefinitivamente(fotoSelecionada);
  }

  const estilos = criarEstilos(colors);

  const cabecalho = (
    <View style={{ gap: 18, paddingBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          style={estilos.botaoIcone}
        >
          <MaterialIcons name="arrow-back" size={23} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 27, fontWeight: "bold" }}>
            Minhas fotos
          </Text>
          <Text style={{ color: colors.textSubtle, paddingTop: 3 }}>
            {fotosFiltradas.length} foto(s) exibida(s)
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: 4,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <SeletorModo
          colors={colors}
          titulo={`Fotos (${fotosAtivas.length})`}
          ativo={modo === "ativas"}
          onPress={() => trocarModo("ativas")}
        />
        <SeletorModo
          colors={colors}
          titulo={`Lixeira (${fotosLixeira.length})`}
          ativo={modo === "lixeira"}
          onPress={() => trocarModo("lixeira")}
        />
      </View>

      <GrupoFiltro
        colors={colors}
        titulo="Loja"
        opcoes={opcoes.lojas}
        valor={lojaFiltro}
        onChange={setLojaFiltro}
      />
      <GrupoFiltro
        colors={colors}
        titulo="Categoria"
        opcoes={opcoes.categorias}
        valor={categoriaFiltro}
        onChange={setCategoriaFiltro}
      />
      <GrupoFiltro
        colors={colors}
        titulo="Status"
        opcoes={statusOpcoes}
        valor={statusFiltro}
        onChange={(valor) => setStatusFiltro(valor as typeof statusFiltro)}
        formatar={(valor) => (valor === "Todos" ? valor : textoStatus(valor))}
      />
      <GrupoFiltro
        colors={colors}
        titulo="Periodo"
        opcoes={periodos}
        valor={periodoFiltro}
        onChange={(valor) => setPeriodoFiltro(valor as Periodo)}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={fotosFiltradas}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 34,
        }}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 28,
              alignItems: "center",
              gap: 9,
            }}
          >
            <MaterialIcons
              name={modo === "lixeira" ? "delete-outline" : "image-search"}
              size={38}
              color={colors.iconMuted}
            />
            <Text style={{ color: colors.text, fontWeight: "bold" }}>
              {modo === "lixeira"
                ? "A lixeira esta vazia"
                : "Nenhuma foto encontrada"}
            </Text>
            <Text style={{ color: colors.textSubtle, textAlign: "center" }}>
              {modo === "lixeira"
                ? "As fotos removidas por voce aparecerao aqui."
                : "Altere os filtros para consultar outros envios."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = obterStatus(item);
          const visual = visualStatus(status);

          return (
            <View
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                overflow: "hidden",
                marginBottom: 14,
              }}
            >
              <Pressable onPress={() => setFotoSelecionada(item)}>
                <Image
                  source={{ uri: obterImagemUri(item) }}
                  resizeMode="cover"
                  style={{
                    width: "100%",
                    aspectRatio: 4 / 3,
                    backgroundColor: colors.surfaceHighlight,
                  }}
                />
              </Pressable>

              <View style={{ padding: 14, gap: 11 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.text,
                        fontSize: 17,
                        fontWeight: "bold",
                      }}
                    >
                      {item.lojaNome || "Loja nao informada"}
                    </Text>
                    <Text style={{ color: colors.textSubtle, paddingTop: 4 }}>
                      {formatarData(item.criadoEm)}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: visual.fundo,
                      borderRadius: 6,
                      paddingVertical: 6,
                      paddingHorizontal: 9,
                    }}
                  >
                    <Text
                      style={{
                        color: visual.texto,
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      {textoStatus(status)}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.textMuted }}>
                  {obterCategoria(item)}
                </Text>

                {item.comentarioAdmin ? (
                  <View
                    style={{
                      backgroundColor: colors.surfaceElevated,
                      borderLeftWidth: 3,
                      borderLeftColor: visual.texto,
                      padding: 11,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSubtle,
                        fontSize: 12,
                        fontWeight: "bold",
                        paddingBottom: 4,
                      }}
                    >
                      Comentario do responsavel
                    </Text>
                    <Text style={{ color: colors.text, lineHeight: 20 }}>
                      {item.comentarioAdmin}
                    </Text>
                  </View>
                ) : null}

                {item.refacaoDeId ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <MaterialIcons
                      name="history"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={{ color: colors.primary, fontWeight: "bold" }}>
                      Refação {item.numeroRefacao || 1}
                    </Text>
                  </View>
                ) : null}

                {obterRotuloVisita(item) ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <MaterialIcons
                      name="collections"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={{ color: colors.primary, fontWeight: "bold" }}>
                      {obterRotuloVisita(item)}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: 9 }}>
                  {modo === "ativas" && status === "refazer" ? (
                    <Pressable
                      onPress={() => refazerFoto(item)}
                      style={{
                        flex: 1,
                        minHeight: 42,
                        borderRadius: 7,
                        backgroundColor: colors.warningSurface,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                      }}
                    >
                      <MaterialIcons
                        name="replay"
                        size={20}
                        color={colors.warning}
                      />
                      <Text
                        style={{
                          color: colors.warningText,
                          fontWeight: "bold",
                        }}
                      >
                        Refazer foto
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => setFotoSelecionada(item)}
                      style={{
                        flex: 1,
                        minHeight: 42,
                        borderRadius: 7,
                        backgroundColor: colors.surfaceElevated,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                      }}
                    >
                      <MaterialIcons
                        name="zoom-in"
                        size={20}
                        color={colors.primary}
                      />
                      <Text
                        style={{ color: colors.textMuted, fontWeight: "bold" }}
                      >
                        Visualizar
                      </Text>
                    </Pressable>
                  )}

                  {modo === "ativas" ? (
                    <Pressable
                      onPress={() => {
                        setFotoSelecionada(item);
                        setConfirmacao("lixeira");
                      }}
                      accessibilityLabel="Mover foto para a lixeira"
                      style={{
                        width: 44,
                        minHeight: 42,
                        borderRadius: 7,
                        backgroundColor: colors.dangerSurface,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={21}
                        color={colors.danger}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => restaurarFoto(item)}
                      disabled={processando}
                      style={{
                        flex: 1,
                        minHeight: 42,
                        borderRadius: 7,
                        backgroundColor: colors.successSurface,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                      }}
                    >
                      <MaterialIcons
                        name="restore"
                        size={20}
                        color={colors.success}
                      />
                      <Text
                        style={{
                          color: colors.successText,
                          fontWeight: "bold",
                        }}
                      >
                        Restaurar
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={!!fotoSelecionada}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmacao(null);
          setFotoSelecionada(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
          <View
            style={{
              position: "absolute",
              top: 45,
              left: 18,
              right: 18,
              zIndex: 10,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={() => {
                setConfirmacao(null);
                setFotoSelecionada(null);
              }}
              accessibilityLabel="Fechar foto"
              style={estilos.botaoModal}
            >
              <MaterialIcons name="close" size={25} color="white" />
            </Pressable>

            {fotoSelecionada ? (
              modo === "ativas" ? (
                <Pressable
                  onPress={() => setConfirmacao("lixeira")}
                  accessibilityLabel="Mover para a lixeira"
                  style={{
                    ...estilos.botaoModal,
                    backgroundColor: colors.danger,
                  }}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={24}
                    color="white"
                  />
                </Pressable>
              ) : (
                <View style={{ flexDirection: "row", gap: 9 }}>
                  <Pressable
                    onPress={() => restaurarFoto(fotoSelecionada)}
                    accessibilityLabel="Restaurar foto"
                    style={{
                      ...estilos.botaoModal,
                      backgroundColor: colors.success,
                    }}
                  >
                    <MaterialIcons name="restore" size={24} color="white" />
                  </Pressable>
                  <Pressable
                    onPress={() => setConfirmacao("definitiva")}
                    accessibilityLabel="Excluir foto definitivamente"
                    style={{
                      ...estilos.botaoModal,
                      backgroundColor: colors.danger,
                    }}
                  >
                    <MaterialIcons
                      name="delete-forever"
                      size={24}
                      color="white"
                    />
                  </Pressable>
                </View>
              )
            ) : null}
          </View>

          {fotoSelecionada ? (
            <ImageViewer
              imageUrls={[{ url: obterImagemUri(fotoSelecionada) }]}
              backgroundColor="rgba(0,0,0,0)"
              enableImageZoom
              enableSwipeDown
              maxScale={4}
              minScale={1}
              onSwipeDown={() => setFotoSelecionada(null)}
              renderIndicator={() => <View />}
              saveToLocalByLongPress={false}
              style={{ flex: 1, width: "100%" }}
              useNativeDriver={false}
            />
          ) : null}

          {fotoSelecionada ? (
            <View
              style={{
                position: "absolute",
                left: 18,
                right: 18,
                bottom: 26,
                backgroundColor: "rgba(17,19,24,0.92)",
                borderRadius: 8,
                padding: 14,
                gap: 5,
              }}
            >
              <Text
                style={{ color: "white", fontSize: 17, fontWeight: "bold" }}
              >
                {fotoSelecionada.lojaNome || "Loja nao informada"}
              </Text>
              <Text style={{ color: "#A6B0BE" }}>
                {obterCategoria(fotoSelecionada)} ·{" "}
                {formatarData(fotoSelecionada.criadoEm)}
              </Text>
              {obterRotuloVisita(fotoSelecionada) ? (
                <Text style={{ color: "#BFDBFE", fontWeight: "bold" }}>
                  {obterRotuloVisita(fotoSelecionada)}
                </Text>
              ) : null}
              <Text
                style={{
                  color: visualStatus(obterStatus(fotoSelecionada)).texto,
                  fontWeight: "bold",
                }}
              >
                {textoStatus(obterStatus(fotoSelecionada))}
              </Text>
              {fotoSelecionada.observacao ? (
                <Text style={{ color: "#E2E7EE", lineHeight: 19 }}>
                  {fotoSelecionada.observacao}
                </Text>
              ) : null}
              {fotoSelecionada.comentarioAdmin ? (
                <Text style={{ color: "#F3F4F6", lineHeight: 19 }}>
                  Comentario: {fotoSelecionada.comentarioAdmin}
                </Text>
              ) : null}
              {modo === "ativas" &&
              obterStatus(fotoSelecionada) === "refazer" ? (
                <Pressable
                  onPress={() => refazerFoto(fotoSelecionada)}
                  style={{
                    minHeight: 44,
                    borderRadius: 7,
                    backgroundColor: colors.warning,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 6,
                  }}
                >
                  <MaterialIcons name="replay" size={20} color="white" />
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    Enviar nova foto
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {confirmacao ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 30,
                backgroundColor: "rgba(0,0,0,0.78)",
                justifyContent: "center",
                padding: 22,
              }}
            >
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 20,
                  gap: 14,
                }}
              >
                <MaterialIcons
                  name={
                    confirmacao === "lixeira"
                      ? "delete-outline"
                      : "delete-forever"
                  }
                  size={32}
                  color={colors.danger}
                />
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 20,
                      fontWeight: "bold",
                    }}
                  >
                    {confirmacao === "lixeira"
                      ? "Mover para a lixeira?"
                      : "Excluir definitivamente?"}
                  </Text>
                  <Text style={{ color: colors.textSubtle, lineHeight: 21 }}>
                    {confirmacao === "lixeira"
                      ? "A foto deixara de aparecer para os administradores, mas voce podera restaura-la depois."
                      : "Essa acao remove a foto permanentemente e nao pode ser desfeita."}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 9 }}>
                  <Pressable
                    onPress={() => setConfirmacao(null)}
                    disabled={processando}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 7,
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "bold" }}>
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={executarConfirmacao}
                    disabled={processando}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 7,
                      backgroundColor: colors.danger,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ color: colors.primaryText, fontWeight: "bold" }}
                    >
                      {processando
                        ? "Aguarde..."
                        : confirmacao === "lixeira"
                          ? "Mover"
                          : "Excluir"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function SeletorModo({
  colors,
  titulo,
  ativo,
  onPress,
}: {
  colors: ThemeColors;
  titulo: string;
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 42,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: ativo ? colors.primary : "transparent",
      }}
    >
      <Text
        style={{
          color: ativo ? colors.primaryText : colors.textSubtle,
          fontWeight: "bold",
        }}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

function GrupoFiltro({
  colors,
  titulo,
  opcoes,
  valor,
  onChange,
  formatar = (opcao) => opcao,
}: {
  colors: ThemeColors;
  titulo: string;
  opcoes: readonly string[];
  valor: string;
  onChange: (valor: string) => void;
  formatar?: (valor: string) => string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "bold" }}>
        {titulo}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {opcoes.map((opcao) => {
          const selecionada = valor === opcao;

          return (
            <Pressable
              key={opcao}
              onPress={() => onChange(opcao)}
              style={{
                minHeight: 38,
                justifyContent: "center",
                borderRadius: 19,
                paddingHorizontal: 14,
                marginRight: 8,
                borderWidth: 1,
                borderColor: selecionada ? colors.primary : colors.border,
                backgroundColor: selecionada
                  ? colors.primary
                  : colors.surfaceElevated,
              }}
            >
              <Text
                style={{
                  color: selecionada ? colors.primaryText : colors.textMuted,
                  fontWeight: selecionada ? "bold" : "normal",
                }}
              >
                {formatar(opcao)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function criarEstilos(colors: ThemeColors) {
  return {
    botaoIcone: {
      width: 42,
      height: 42,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    botaoModal: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: "rgba(31,35,43,0.94)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
  };
}
