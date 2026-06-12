import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import ImageViewer from "react-native-image-zoom-viewer";

import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../services/firebaseConfig";
import { atualizarFotoComNotificacao } from "../services/notificacoes";

type Foto = {
  id: string;
  lojaNome: string;
  promotorId?: string;
  promotorNome?: string;
  promotorEmail?: string;
  observacao: string;
  imagemBase64?: string;
  imagemUrl?: string;
  storagePath?: string;
  categoria?: string;
  status?: string;
  comentarioAdmin?: string;
  criadoEm: any;
  naLixeira?: boolean;
  refacaoDeId?: string;
  numeroRefacao?: number;
  motivoRefacao?: string;
};

const categoriasFoto = [
  "Todas",
  "Gondola",
  "Relatório de estoque",
  "Ponta",
  "Ilha",
  "Ruptura",
  "Preco",
  "Validade",
  "Concorrente",
  "Antes/depois",
  "Sem categoria",
];

const statusFotos = ["Todos", "pendente", "aprovada", "refazer", "rejeitada"];

function obterData(valor: any) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === "function") return valor.toDate();
  if (typeof valor === "string" || typeof valor === "number") {
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  return null;
}

function obterImagemUri(foto: Foto) {
  return foto.imagemUrl || foto.imagemBase64 || "";
}

export default function VerFotos() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [promotores, setPromotores] = useState<
    Record<string, { nome: string; email: string }>
  >({});
  const [lojaFiltro, setLojaFiltro] = useState("Todas");
  const [promotorFiltro, setPromotorFiltro] = useState("Todos");
  const [filtroHoje, setFiltroHoje] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [statusFiltro, setStatusFiltro] = useState("Todos");

  const [fotoSelecionada, setFotoSelecionada] = useState<Foto | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [modalComentarioAberto, setModalComentarioAberto] = useState(false);
  const [statusComComentario, setStatusComComentario] = useState("");
  const [comentarioAdmin, setComentarioAdmin] = useState("");
  const [confirmacaoExclusaoAberta, setConfirmacaoExclusaoAberta] =
    useState(false);
  const [excluindoFoto, setExcluindoFoto] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "fotos"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
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
      },
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Nao foi possivel carregar as fotos.");
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "usuarios"),
      (snapshot) => {
        const mapa: Record<string, { nome: string; email: string }> = {};

        snapshot.docs.forEach((item) => {
          const dados = item.data();

          if (dados.tipo === "promotor") {
            mapa[item.id] = {
              nome: dados.nome || dados.email || "Promotor",
              email: dados.email || "",
            };
          }
        });

        setPromotores(mapa);
      },
      (error) => {
        console.log(error);
      },
    );

    return () => unsubscribe();
  }, []);

  function formatarData(dataFirebase: any) {
    const data = obterData(dataFirebase);

    if (!data) return "Data não disponível";

    return data.toLocaleString("pt-BR");
  }

  function ehHoje(dataFirebase: any) {
    const data = obterData(dataFirebase);

    if (!data) return false;

    const hoje = new Date();

    return (
      data.getDate() === hoje.getDate() &&
      data.getMonth() === hoje.getMonth() &&
      data.getFullYear() === hoje.getFullYear()
    );
  }

  function abrirFoto(foto: Foto) {
    setFotoSelecionada(foto);
    setMenuAberto(false);
  }

  function obterCategoria(foto: Foto) {
    return foto.categoria || "Sem categoria";
  }

  function obterStatus(foto: Foto) {
    return foto.status || "pendente";
  }

  function obterNomePromotor(foto: Foto) {
    if (foto.promotorNome) return foto.promotorNome;
    if (foto.promotorId && promotores[foto.promotorId]) {
      return promotores[foto.promotorId].nome;
    }

    return foto.promotorEmail || "Promotor nao identificado";
  }

  function obterChavePromotor(foto: Foto) {
    return foto.promotorId || foto.promotorEmail || obterNomePromotor(foto);
  }

  function textoStatus(status: string) {
    if (status === "aprovada") return "Aprovada";
    if (status === "refazer") return "Refazer";
    if (status === "rejeitada") return "Rejeitada";
    return "Pendente";
  }

  function corStatus(status: string) {
    if (status === "aprovada") return "#16A34A";
    if (status === "refazer") return "#F59E0B";
    if (status === "rejeitada") return "#EF4444";
    return "#2563EB";
  }

  function fecharFoto() {
    setFotoSelecionada(null);
    setMenuAberto(false);
    setModalComentarioAberto(false);
    setConfirmacaoExclusaoAberta(false);
    setStatusComComentario("");
    setComentarioAdmin("");
  }

  function voltarTelaAnterior() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  }

  async function excluirFoto() {
    if (!fotoSelecionada || excluindoFoto) return;

    const id = fotoSelecionada.id;

    try {
      setExcluindoFoto(true);
      await deleteDoc(doc(db, "fotos", id));

      setFotos((listaAtual) => listaAtual.filter((foto) => foto.id !== id));
      fecharFoto();
      Alert.alert("Sucesso", "Foto excluida com sucesso.");
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Erro ao excluir",
        error.message || "Nao foi possivel excluir a foto.",
      );
    } finally {
      setExcluindoFoto(false);
    }
  }

  async function baixarFoto() {
    if (!fotoSelecionada || salvandoFoto) return;

    try {
      setSalvandoFoto(true);
      setMenuAberto(false);

      const imagemUri = obterImagemUri(fotoSelecionada);

      if (!imagemUri) {
        Alert.alert("Erro", "Esta foto nao possui imagem para baixar.");
        return;
      }

      if (!imagemUri.startsWith("data:")) {
        const nomeArquivo = `foto-${fotoSelecionada.id}.jpg`;
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
        Alert.alert("Erro", "Não foi possível preparar esta foto para baixar.");
        return;
      }

      const extensaoOriginal = dadosImagem[2].toLowerCase();
      const extensao = extensaoOriginal === "jpeg" ? "jpg" : extensaoOriginal;
      const base64 = dadosImagem[3];
      const nomeArquivo = `foto-${fotoSelecionada.id}.${extensao}`;
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
      setSalvandoFoto(false);
    }
  }

  async function atualizarStatusFoto(status: string) {
    if (!fotoSelecionada) return;

    try {
      await atualizarFotoComNotificacao({
        foto: fotoSelecionada,
        status,
        comentario:
          status === "aprovada" ? "" : fotoSelecionada.comentarioAdmin || "",
      });

      setFotoSelecionada({
        ...fotoSelecionada,
        status,
        comentarioAdmin:
          status === "aprovada" ? "" : fotoSelecionada.comentarioAdmin || "",
      });
      setMenuAberto(false);

      Alert.alert("Sucesso", `Foto marcada como ${textoStatus(status)}.`);
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Erro",
        error.message || "Nao foi possivel atualizar a foto.",
      );
    }
  }

  function abrirComentarioStatus(status: string) {
    if (!fotoSelecionada) return;

    setStatusComComentario(status);
    setComentarioAdmin(fotoSelecionada.comentarioAdmin || "");
    setMenuAberto(false);
    setModalComentarioAberto(true);
  }

  function cancelarComentarioStatus() {
    setModalComentarioAberto(false);
    setStatusComComentario("");
    setComentarioAdmin("");
  }

  async function salvarComentarioStatus() {
    if (!fotoSelecionada || !statusComComentario) return;

    const comentario = comentarioAdmin.trim();

    try {
      await atualizarFotoComNotificacao({
        foto: fotoSelecionada,
        status: statusComComentario,
        comentario,
      });

      setFotoSelecionada({
        ...fotoSelecionada,
        status: statusComComentario,
        comentarioAdmin: comentario,
      });

      cancelarComentarioStatus();
      Alert.alert(
        "Sucesso",
        `Foto marcada como ${textoStatus(statusComComentario)}.`,
      );
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Erro",
        error.message || "Nao foi possivel atualizar a foto.",
      );
    }
  }

  function confirmarExcluirFoto() {
    if (!fotoSelecionada) return;

    setMenuAberto(false);
    setConfirmacaoExclusaoAberta(true);
  }

  const lojasUnicas = ["Todas", ...new Set(fotos.map((foto) => foto.lojaNome))];

  const promotoresUnicos = [
    { id: "Todos", nome: "Todos" },
    ...Array.from(
      new Map(
        fotos.map((foto) => [
          obterChavePromotor(foto),
          {
            id: obterChavePromotor(foto),
            nome: obterNomePromotor(foto),
          },
        ]),
      ).values(),
    ).sort((a, b) => a.nome.localeCompare(b.nome)),
  ];

  const fotosFiltradas = fotos.filter((foto) => {
    const filtroLojaOk = lojaFiltro === "Todas" || foto.lojaNome === lojaFiltro;

    const filtroPromotorOk =
      promotorFiltro === "Todos" || obterChavePromotor(foto) === promotorFiltro;

    const filtroDataOk = !filtroHoje || ehHoje(foto.criadoEm);
    const filtroCategoriaOk =
      categoriaFiltro === "Todas" || obterCategoria(foto) === categoriaFiltro;
    const filtroStatusOk =
      statusFiltro === "Todos" || obterStatus(foto) === statusFiltro;

    return (
      filtroLojaOk &&
      filtroPromotorOk &&
      filtroDataOk &&
      filtroCategoriaOk &&
      filtroStatusOk
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <FlatList
        data={fotosFiltradas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 60,
        }}
        ListHeaderComponent={
          <View>
            <TouchableOpacity
              onPress={voltarTelaAnterior}
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#1E1E1E",
                borderRadius: 20,
                paddingVertical: 8,
                paddingHorizontal: 14,
                marginBottom: 18,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>Voltar</Text>
            </TouchableOpacity>

            <Text
              style={{
                color: "white",
                fontSize: 28,
                fontWeight: "bold",
                marginBottom: 10,
              }}
            >
              Fotos Recebidas
            </Text>

            <Text style={{ color: "#aaa", marginBottom: 20 }}>
              Total exibido: {fotosFiltradas.length}
            </Text>

            <Text
              style={{
                color: "white",
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 8,
              }}
            >
              Filtrar por loja
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 15 }}
            >
              {lojasUnicas.map((loja) => (
                <TouchableOpacity
                  key={loja}
                  onPress={() => setLojaFiltro(loja)}
                  style={{
                    backgroundColor:
                      lojaFiltro === loja ? "#2563EB" : "#1E1E1E",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {loja}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text
              style={{
                color: "white",
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 8,
              }}
            >
              Filtrar por promotor
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 15 }}
            >
              {promotoresUnicos.map((promotor) => (
                <TouchableOpacity
                  key={promotor.id}
                  onPress={() => setPromotorFiltro(promotor.id)}
                  style={{
                    backgroundColor:
                      promotorFiltro === promotor.id ? "#9333EA" : "#1E1E1E",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {promotor.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text
              style={{
                color: "white",
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 8,
              }}
            >
              Filtrar por data
            </Text>

            <View style={{ flexDirection: "row", marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => setFiltroHoje(false)}
                style={{
                  backgroundColor: !filtroHoje ? "#16A34A" : "#1E1E1E",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Todas
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFiltroHoje(true)}
                style={{
                  backgroundColor: filtroHoje ? "#16A34A" : "#1E1E1E",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>Hoje</Text>
              </TouchableOpacity>
            </View>

            <Text
              style={{
                color: "white",
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 8,
              }}
            >
              Filtrar por categoria
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 15 }}
            >
              {categoriasFoto.map((categoria) => (
                <TouchableOpacity
                  key={categoria}
                  onPress={() => setCategoriaFiltro(categoria)}
                  style={{
                    backgroundColor:
                      categoriaFiltro === categoria ? "#F59E0B" : "#1E1E1E",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {categoria}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text
              style={{
                color: "white",
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 8,
              }}
            >
              Filtrar por status
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
            >
              {statusFotos.map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setStatusFiltro(status)}
                  style={{
                    backgroundColor:
                      statusFiltro === status ? "#0EA5E9" : "#1E1E1E",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {status === "Todos" ? "Todos" : textoStatus(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: "#888", marginTop: 20 }}>
            Nenhuma foto encontrada com os filtros selecionados.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: "#1E1E1E",
              borderRadius: 12,
              padding: 15,
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontWeight: "bold",
              }}
            >
              🏪 {item.lojaNome}
            </Text>

            <Text style={{ color: "#aaa", marginTop: 5 }}>
              👤 {obterNomePromotor(item)}
            </Text>

            {item.promotorEmail &&
            item.promotorEmail !== obterNomePromotor(item) ? (
              <Text selectable style={{ color: "#777", marginTop: 3 }}>
                {item.promotorEmail}
              </Text>
            ) : null}

            <Text style={{ color: "#aaa", marginTop: 5, marginBottom: 10 }}>
              🕒 {formatarData(item.criadoEm)}
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  backgroundColor: "#312E81",
                  borderRadius: 20,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {obterCategoria(item)}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: corStatus(obterStatus(item)),
                  borderRadius: 20,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {textoStatus(obterStatus(item))}
                </Text>
              </View>
            </View>

            {item.refacaoDeId ? (
              <View
                style={{
                  backgroundColor: "#3D2D10",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="history" size={19} color="#F4B740" />
                <Text style={{ color: "#FCE6A9", fontWeight: "bold" }}>
                  Refação {item.numeroRefacao || 1}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={() => abrirFoto(item)}>
              <Image
                source={{ uri: obterImagemUri(item) }}
                style={{
                  width: "100%",
                  height: 280,
                  borderRadius: 10,
                  backgroundColor: "#333",
                }}
                resizeMode="cover"
              />
            </TouchableOpacity>

            {item.observacao ? (
              <Text style={{ color: "white", marginTop: 10, lineHeight: 20 }}>
                📝 {item.observacao}
              </Text>
            ) : (
              <Text
                style={{
                  color: "#777",
                  marginTop: 10,
                  fontStyle: "italic",
                }}
              >
                Sem observação.
              </Text>
            )}
          </View>
        )}
      />

      <Modal visible={!!fotoSelecionada} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.95)",
            justifyContent: "center",
            alignItems: "center",
            padding: 15,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 45,
              left: 20,
              right: 20,
              zIndex: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <TouchableOpacity onPress={fecharFoto}>
              <Text style={{ color: "white", fontSize: 32 }}>×</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={confirmarExcluirFoto}
                accessibilityLabel="Excluir foto"
                style={{
                  backgroundColor: "rgba(127,29,29,0.9)",
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="delete-outline" size={25} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMenuAberto(!menuAberto)}
                accessibilityLabel="Opcoes da foto"
                style={{
                  backgroundColor: "#1E1E1E",
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "white", fontSize: 26 }}>⋮</Text>
              </TouchableOpacity>
            </View>
          </View>

          {menuAberto && (
            <View
              style={{
                position: "absolute",
                top: 95,
                right: 20,
                backgroundColor: "#1E1E1E",
                borderRadius: 10,
                padding: 10,
                zIndex: 20,
                width: 180,
              }}
            >
              <TouchableOpacity
                onPress={baixarFoto}
                disabled={salvandoFoto}
                style={{ padding: 12 }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {salvandoFoto ? "Baixando..." : "Baixar foto"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => atualizarStatusFoto("aprovada")}
                style={{ padding: 12 }}
              >
                <Text style={{ color: "#16A34A", fontWeight: "bold" }}>
                  Aprovar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => abrirComentarioStatus("refazer")}
                style={{ padding: 12 }}
              >
                <Text style={{ color: "#F59E0B", fontWeight: "bold" }}>
                  Pedir refazer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => abrirComentarioStatus("rejeitada")}
                style={{ padding: 12 }}
              >
                <Text style={{ color: "#EF4444", fontWeight: "bold" }}>
                  Rejeitar
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {fotoSelecionada && (
            <ImageViewer
              imageUrls={[{ url: obterImagemUri(fotoSelecionada) }]}
              backgroundColor="rgba(0,0,0,0)"
              enableImageZoom
              enableSwipeDown
              maxScale={4}
              minScale={1}
              onSwipeDown={fecharFoto}
              renderIndicator={() => <View />}
              saveToLocalByLongPress={false}
              style={{
                flex: 1,
                width: "100%",
              }}
              useNativeDriver={false}
            />
          )}

          {fotoSelecionada && (
            <View
              style={{
                position: "absolute",
                bottom: 30,
                left: 20,
                right: 20,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                🏪 {fotoSelecionada.lojaNome}
              </Text>
              <Text style={{ color: "#aaa", marginTop: 4 }}>
                👤 {obterNomePromotor(fotoSelecionada)}
              </Text>
              <Text style={{ color: "#aaa", marginTop: 4 }}>
                🕒 {formatarData(fotoSelecionada.criadoEm)}
              </Text>
              <Text style={{ color: "#aaa", marginTop: 4 }}>
                Categoria: {obterCategoria(fotoSelecionada)}
              </Text>
              <Text
                style={{
                  color: corStatus(obterStatus(fotoSelecionada)),
                  marginTop: 4,
                  fontWeight: "bold",
                }}
              >
                Status: {textoStatus(obterStatus(fotoSelecionada))}
              </Text>
              {fotoSelecionada.comentarioAdmin ? (
                <Text style={{ color: "white", marginTop: 4, lineHeight: 20 }}>
                  Comentario: {fotoSelecionada.comentarioAdmin}
                </Text>
              ) : null}
              {fotoSelecionada.refacaoDeId ? (
                <Text style={{ color: "#F4B740", marginTop: 4, lineHeight: 20 }}>
                  Refação {fotoSelecionada.numeroRefacao || 1}
                  {fotoSelecionada.motivoRefacao
                    ? ` · Motivo anterior: ${fotoSelecionada.motivoRefacao}`
                    : ""}
                </Text>
              ) : null}
            </View>
          )}

          {modalComentarioAberto && (
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 100,
                backgroundColor: "rgba(0,0,0,0.8)",
                justifyContent: "center",
                padding: 20,
              }}
            >
              <View
                style={{
                  backgroundColor: "#1E1E1E",
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 20,
                    fontWeight: "bold",
                    marginBottom: 8,
                  }}
                >
                  Motivo para {textoStatus(statusComComentario)}
                </Text>

                <Text style={{ color: "#aaa", marginBottom: 12 }}>
                  Esse comentario sera exibido para o promotor.
                </Text>

                <TextInput
                  value={comentarioAdmin}
                  onChangeText={setComentarioAdmin}
                  placeholder="Ex: Foto sem preco visivel"
                  placeholderTextColor="#777"
                  multiline
                  textAlignVertical="top"
                  autoFocus
                  style={{
                    minHeight: 110,
                    borderWidth: 1,
                    borderColor: "#444",
                    borderRadius: 10,
                    padding: 12,
                    color: "white",
                    marginBottom: 14,
                  }}
                />

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={cancelarComentarioStatus}
                    style={{
                      flex: 1,
                      backgroundColor: "#444",
                      padding: 14,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={salvarComentarioStatus}
                    style={{
                      flex: 1,
                      backgroundColor: "#2563EB",
                      padding: 14,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Salvar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {confirmacaoExclusaoAberta && (
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 100,
                backgroundColor: "rgba(0,0,0,0.8)",
                justifyContent: "center",
                padding: 20,
              }}
            >
              <View
                style={{
                  backgroundColor: "#1E1E1E",
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 20,
                    fontWeight: "bold",
                    marginBottom: 8,
                  }}
                >
                  Excluir foto
                </Text>

                <Text
                  style={{ color: "#aaa", lineHeight: 20, marginBottom: 16 }}
                >
                  Tem certeza que deseja excluir esta foto? Essa acao nao pode
                  ser desfeita.
                </Text>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setConfirmacaoExclusaoAberta(false)}
                    disabled={excluindoFoto}
                    style={{
                      flex: 1,
                      backgroundColor: "#444",
                      padding: 14,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={excluirFoto}
                    disabled={excluindoFoto}
                    style={{
                      flex: 1,
                      backgroundColor: excluindoFoto ? "#7F1D1D" : "#DC2626",
                      padding: 14,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {excluindoFoto ? "Excluindo..." : "Excluir"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
