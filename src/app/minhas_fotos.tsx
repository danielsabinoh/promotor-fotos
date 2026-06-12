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
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import ImageViewer from "react-native-image-zoom-viewer";

import { auth, db } from "../services/firebaseConfig";

type Foto = {
  id: string;
  lojaId?: string;
  lojaNome?: string;
  observacao?: string;
  imagemBase64?: string;
  imagemUrl?: string;
  categoria?: string;
  status?: string;
  comentarioAdmin?: string;
  criadoEm?: any;
  naLixeira?: boolean;
  excluidaEm?: any;
  excluidaPor?: string | null;
  refacaoDeId?: string;
  numeroRefacao?: number;
  motivoRefacao?: string;
};

type ModoLista = "ativas" | "lixeira";
type Periodo = "Todas" | "Hoje" | "7 dias" | "30 dias";
type AcaoConfirmacao = "lixeira" | "definitiva" | null;

const statusOpcoes = ["Todos", "pendente", "aprovada", "refazer", "rejeitada"];
const periodos: Periodo[] = ["Todas", "Hoje", "7 dias", "30 dias"];

function obterData(valor: any) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === "function") return valor.toDate();

  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function obterImagemUri(foto: Foto) {
  return foto.imagemUrl || foto.imagemBase64 || "";
}

function obterCategoria(foto: Foto) {
  return foto.categoria || "Sem categoria";
}

function obterStatus(foto: Foto) {
  return foto.status || "pendente";
}

function textoStatus(status: string) {
  if (status === "aprovada") return "Aprovada";
  if (status === "refazer") return "Refazer";
  if (status === "rejeitada") return "Rejeitada";
  return "Pendente";
}

function visualStatus(status: string) {
  if (status === "aprovada") return { fundo: "#123B2A", texto: "#6EE7A8" };
  if (status === "refazer") return { fundo: "#49310B", texto: "#FBBF24" };
  if (status === "rejeitada") return { fundo: "#481A20", texto: "#FDA4AF" };
  return { fundo: "#142F5E", texto: "#93C5FD" };
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
    statusOpcoes.includes(parametros.statusInicial || "")
      ? parametros.statusInicial!
      : "Todos",
  );
  const [periodoFiltro, setPeriodoFiltro] = useState<Periodo>("Todas");
  const [fotoSelecionada, setFotoSelecionada] = useState<Foto | null>(null);
  const [confirmacao, setConfirmacao] = useState<AcaoConfirmacao>(null);
  const [processando, setProcessando] = useState(false);
  const fotoInicialProcessada = useRef(false);

  useEffect(() => {
    const usuarioAtual = auth.currentUser;

    if (!usuarioAtual) {
      router.replace("/" as any);
      return;
    }

    const consulta = query(
      collection(db, "fotos"),
      where("promotorId", "==", usuarioAtual.uid),
    );

    return onSnapshot(consulta, (snapshot) => {
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
  }, []);

  const fotosAtivas = useMemo(
    () => {
      const idsSubstituidos = new Set(
        fotos
          .filter((foto) => foto.naLixeira !== true)
          .map((foto) => foto.refacaoDeId)
          .filter(Boolean),
      );

      return fotos.filter(
        (foto) =>
          foto.naLixeira !== true && !idsSubstituidos.has(foto.id),
      );
    },
    [fotos],
  );
  const fotosLixeira = useMemo(
    () => fotos.filter((foto) => foto.naLixeira === true),
    [fotos],
  );

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
    setFotoSelecionada(foto);
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
      pathname: "/enviar_foto",
      params: {
        lojaId: foto.lojaId,
        lojaNome: foto.lojaNome,
        categoriaInicial: foto.categoria,
        refacaoDeId: foto.id,
        numeroRefacao: (foto.numeroRefacao || 0) + 1,
        motivoRefacao: foto.comentarioAdmin || "",
      },
    } as any);
  }

  async function moverParaLixeira(foto: Foto) {
    const usuarioAtual = auth.currentUser;
    if (!usuarioAtual || processando) return;

    try {
      setProcessando(true);
      await updateDoc(doc(db, "fotos", foto.id), {
        naLixeira: true,
        excluidaEm: serverTimestamp(),
        excluidaPor: usuarioAtual.uid,
      });
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
      await updateDoc(doc(db, "fotos", foto.id), {
        naLixeira: false,
        excluidaEm: null,
        excluidaPor: null,
      });
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
      await deleteDoc(doc(db, "fotos", foto.id));
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

  const cabecalho = (
    <View style={{ gap: 18, paddingBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          style={estiloBotaoIcone}
        >
          <MaterialIcons name="arrow-back" size={23} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "white", fontSize: 27, fontWeight: "bold" }}>
            Minhas fotos
          </Text>
          <Text style={{ color: "#8E9AAF", paddingTop: 3 }}>
            {fotosFiltradas.length} foto(s) exibida(s)
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#1A1D23",
          borderRadius: 8,
          padding: 4,
        }}
      >
        <SeletorModo
          titulo={`Fotos (${fotosAtivas.length})`}
          ativo={modo === "ativas"}
          onPress={() => trocarModo("ativas")}
        />
        <SeletorModo
          titulo={`Lixeira (${fotosLixeira.length})`}
          ativo={modo === "lixeira"}
          onPress={() => trocarModo("lixeira")}
        />
      </View>

      <GrupoFiltro
        titulo="Loja"
        opcoes={opcoes.lojas}
        valor={lojaFiltro}
        onChange={setLojaFiltro}
      />
      <GrupoFiltro
        titulo="Categoria"
        opcoes={opcoes.categorias}
        valor={categoriaFiltro}
        onChange={setCategoriaFiltro}
      />
      <GrupoFiltro
        titulo="Status"
        opcoes={statusOpcoes}
        valor={statusFiltro}
        onChange={setStatusFiltro}
        formatar={(valor) => (valor === "Todos" ? valor : textoStatus(valor))}
      />
      <GrupoFiltro
        titulo="Periodo"
        opcoes={periodos}
        valor={periodoFiltro}
        onChange={(valor) => setPeriodoFiltro(valor as Periodo)}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#0F1115" }}>
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
              borderColor: "#2B3039",
              borderRadius: 8,
              padding: 28,
              alignItems: "center",
              gap: 9,
            }}
          >
            <MaterialIcons
              name={modo === "lixeira" ? "delete-outline" : "image-search"}
              size={38}
              color="#6B7688"
            />
            <Text style={{ color: "#DCE2EA", fontWeight: "bold" }}>
              {modo === "lixeira"
                ? "A lixeira esta vazia"
                : "Nenhuma foto encontrada"}
            </Text>
            <Text style={{ color: "#7E899A", textAlign: "center" }}>
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
                backgroundColor: "#191C22",
                borderWidth: 1,
                borderColor: "#292E37",
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
                    backgroundColor: "#252A33",
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
                        color: "white",
                        fontSize: 17,
                        fontWeight: "bold",
                      }}
                    >
                      {item.lojaNome || "Loja nao informada"}
                    </Text>
                    <Text style={{ color: "#8792A4", paddingTop: 4 }}>
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

                <Text style={{ color: "#B8C0CC" }}>{obterCategoria(item)}</Text>

                {item.comentarioAdmin ? (
                  <View
                    style={{
                      backgroundColor: "#232832",
                      borderLeftWidth: 3,
                      borderLeftColor: visual.texto,
                      padding: 11,
                    }}
                  >
                    <Text
                      style={{
                        color: "#AEB8C7",
                        fontSize: 12,
                        fontWeight: "bold",
                        paddingBottom: 4,
                      }}
                    >
                      Comentario do responsavel
                    </Text>
                    <Text style={{ color: "#EEF2F7", lineHeight: 20 }}>
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
                    <MaterialIcons name="history" size={18} color="#AFC5F5" />
                    <Text style={{ color: "#AFC5F5", fontWeight: "bold" }}>
                      Refação {item.numeroRefacao || 1}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: 9 }}>
                  {modo === "ativas" && status === "refazer" ? (
                    <Pressable
                      onPress={() => refazerFoto(item)}
                      style={estiloAcaoRefazer}
                    >
                      <MaterialIcons name="replay" size={20} color="#FDE68A" />
                      <Text style={{ color: "#FEF3C7", fontWeight: "bold" }}>
                        Refazer foto
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => setFotoSelecionada(item)}
                      style={estiloAcaoSecundaria}
                    >
                      <MaterialIcons name="zoom-in" size={20} color="#AFC5F5" />
                      <Text style={{ color: "#DDE7FB", fontWeight: "bold" }}>
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
                      style={estiloBotaoExcluir}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={21}
                        color="#FDA4AF"
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => restaurarFoto(item)}
                      disabled={processando}
                      style={estiloAcaoRestaurar}
                    >
                      <MaterialIcons name="restore" size={20} color="#86EFAC" />
                      <Text style={{ color: "#BBF7D0", fontWeight: "bold" }}>
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
              style={estiloBotaoModal}
            >
              <MaterialIcons name="close" size={25} color="white" />
            </Pressable>

            {fotoSelecionada ? (
              modo === "ativas" ? (
                <Pressable
                  onPress={() => setConfirmacao("lixeira")}
                  accessibilityLabel="Mover para a lixeira"
                  style={{ ...estiloBotaoModal, backgroundColor: "#7F1D2D" }}
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
                    style={{ ...estiloBotaoModal, backgroundColor: "#166534" }}
                  >
                    <MaterialIcons name="restore" size={24} color="white" />
                  </Pressable>
                  <Pressable
                    onPress={() => setConfirmacao("definitiva")}
                    accessibilityLabel="Excluir foto definitivamente"
                    style={{ ...estiloBotaoModal, backgroundColor: "#7F1D2D" }}
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
                    backgroundColor: "#8A5A0A",
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
                  backgroundColor: "#1B1E24",
                  borderWidth: 1,
                  borderColor: "#303641",
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
                  color="#FDA4AF"
                />
                <View style={{ gap: 6 }}>
                  <Text
                    style={{ color: "white", fontSize: 20, fontWeight: "bold" }}
                  >
                    {confirmacao === "lixeira"
                      ? "Mover para a lixeira?"
                      : "Excluir definitivamente?"}
                  </Text>
                  <Text style={{ color: "#AEB7C5", lineHeight: 21 }}>
                    {confirmacao === "lixeira"
                      ? "A foto deixara de aparecer para os administradores, mas voce podera restaura-la depois."
                      : "Essa acao remove a foto permanentemente e nao pode ser desfeita."}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 9 }}>
                  <Pressable
                    onPress={() => setConfirmacao(null)}
                    disabled={processando}
                    style={estiloBotaoCancelar}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={executarConfirmacao}
                    disabled={processando}
                    style={estiloBotaoConfirmar}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
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
  titulo,
  ativo,
  onPress,
}: {
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
        backgroundColor: ativo ? "#2F6FED" : "transparent",
      }}
    >
      <Text
        style={{
          color: ativo ? "white" : "#909BAD",
          fontWeight: "bold",
        }}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

function GrupoFiltro({
  titulo,
  opcoes,
  valor,
  onChange,
  formatar = (opcao) => opcao,
}: {
  titulo: string;
  opcoes: readonly string[];
  valor: string;
  onChange: (valor: string) => void;
  formatar?: (valor: string) => string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: "#C8CFD9", fontSize: 13, fontWeight: "bold" }}>
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
                borderColor: selecionada ? "#4D82EE" : "#303640",
                backgroundColor: selecionada ? "#234D9C" : "#191C22",
              }}
            >
              <Text
                style={{
                  color: selecionada ? "white" : "#A6B0BE",
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

const estiloBotaoIcone = {
  width: 42,
  height: 42,
  borderRadius: 8,
  backgroundColor: "#1B1F26",
  borderWidth: 1,
  borderColor: "#303640",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const estiloBotaoModal = {
  width: 44,
  height: 44,
  borderRadius: 8,
  backgroundColor: "rgba(31,35,43,0.94)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const estiloAcaoSecundaria = {
  flex: 1,
  minHeight: 42,
  borderRadius: 7,
  backgroundColor: "#232A37",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 7,
};

const estiloAcaoRestaurar = {
  flex: 1,
  minHeight: 42,
  borderRadius: 7,
  backgroundColor: "#153727",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 7,
};

const estiloAcaoRefazer = {
  flex: 1,
  minHeight: 42,
  borderRadius: 7,
  backgroundColor: "#49310B",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 7,
};

const estiloBotaoExcluir = {
  width: 44,
  minHeight: 42,
  borderRadius: 7,
  backgroundColor: "#431B22",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const estiloBotaoCancelar = {
  flex: 1,
  minHeight: 44,
  borderRadius: 7,
  backgroundColor: "#3A3F48",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const estiloBotaoConfirmar = {
  flex: 1,
  minHeight: 44,
  borderRadius: 7,
  backgroundColor: "#B42336",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
