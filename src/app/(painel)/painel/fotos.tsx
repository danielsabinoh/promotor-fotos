import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../../../services/firebaseConfig";
import { atualizarFotoComNotificacao } from "../../../services/notificacoes";

type Foto = {
  id: string;
  lojaNome?: string;
  promotorId?: string;
  promotorNome?: string;
  promotorEmail?: string;
  observacao?: string;
  imagemBase64?: string;
  imagemUrl?: string;
  categoria?: string;
  status?: string;
  comentarioAdmin?: string;
  criadoEm?: any;
  naLixeira?: boolean;
  refacaoDeId?: string;
  numeroRefacao?: number;
  motivoRefacao?: string;
};

type AcaoAvaliacao = "refazer" | "rejeitada" | null;

const statusOpcoes = ["Todos", "pendente", "aprovada", "refazer", "rejeitada"];

function obterData(valor: any) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === "function") return valor.toDate();
  return null;
}

function imagemDaFoto(foto: Foto) {
  return foto.imagemUrl || foto.imagemBase64 || "";
}

function nomePromotor(foto: Foto) {
  return foto.promotorNome || foto.promotorEmail || "Promotor nao identificado";
}

function estiloStatus(status: string) {
  if (status === "aprovada") return { fundo: "#E4F4EA", texto: "#247946" };
  if (status === "refazer") return { fundo: "#FFF1D9", texto: "#A6650B" };
  if (status === "rejeitada") return { fundo: "#FBE7E9", texto: "#B5323E" };
  return { fundo: "#E8EFFD", texto: "#2F6FED" };
}

export default function FotosWeb() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [fotoAberta, setFotoAberta] = useState<Foto | null>(null);
  const [loja, setLoja] = useState("Todas");
  const [promotor, setPromotor] = useState("Todos");
  const [categoria, setCategoria] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [comentario, setComentario] = useState("");
  const [acaoAvaliacao, setAcaoAvaliacao] =
    useState<AcaoAvaliacao>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const consulta = query(
      collection(db, "fotos"),
      orderBy("criadoEm", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
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
      },
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Nao foi possivel carregar as fotos.");
      },
    );
  }, []);

  const opcoes = useMemo(
    () => ({
      lojas: ["Todas", ...new Set(fotos.map((foto) => foto.lojaNome || "Sem loja"))],
      promotores: ["Todos", ...new Set(fotos.map(nomePromotor))],
      categorias: [
        "Todas",
        ...new Set(fotos.map((foto) => foto.categoria || "Sem categoria")),
      ],
    }),
    [fotos],
  );

  const fotosFiltradas = useMemo(
    () =>
      fotos.filter(
        (foto) =>
          (loja === "Todas" || (foto.lojaNome || "Sem loja") === loja) &&
          (promotor === "Todos" || nomePromotor(foto) === promotor) &&
          (categoria === "Todas" ||
            (foto.categoria || "Sem categoria") === categoria) &&
          (status === "Todos" || (foto.status || "pendente") === status),
      ),
    [categoria, fotos, loja, promotor, status],
  );

  const colunas = width >= 1450 ? 4 : width >= 1080 ? 3 : width >= 760 ? 2 : 1;
  const larguraCard = `${100 / colunas}%` as `${number}%`;

  async function atualizarStatus(novoStatus: string) {
    if (!fotoAberta || salvando) return;

    try {
      setSalvando(true);
      const comentarioLimpo = comentario.trim();
      await atualizarFotoComNotificacao({
        foto: fotoAberta,
        status: novoStatus,
        comentario: novoStatus === "aprovada" ? "" : comentarioLimpo,
      });
      setFotoAberta({
        ...fotoAberta,
        status: novoStatus,
        comentarioAdmin: novoStatus === "aprovada" ? "" : comentarioLimpo,
      });
      setMensagemSucesso(
        novoStatus === "aprovada"
          ? "Foto aprovada e promotor notificado."
          : novoStatus === "refazer"
            ? "Refação solicitada e promotor notificado."
            : "Foto rejeitada e promotor notificado.",
      );
      if (novoStatus === "aprovada") {
        setComentario("");
        setAcaoAvaliacao(null);
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Nao foi possivel atualizar a foto.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (!fotoAberta) return;
    setConfirmandoExclusao(true);
  }

  async function excluirFoto() {
    if (!fotoAberta || excluindo) return;

    try {
      setExcluindo(true);
      await deleteDoc(doc(db, "fotos", fotoAberta.id));
      setConfirmandoExclusao(false);
      setFotoAberta(null);
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Erro ao excluir",
        error.message || "Nao foi possivel excluir a foto.",
      );
    } finally {
      setExcluindo(false);
    }
  }

  function baixarFoto() {
    if (!fotoAberta) return;
    const uri = imagemDaFoto(fotoAberta);
    const documento = globalThis.document;
    const link = documento.createElement("a");
    link.href = uri;
    link.download = `foto-${fotoAberta.id}.jpg`;
    documento.body.appendChild(link);
    link.click();
    documento.body.removeChild(link);
  }

  function abrirFoto(foto: Foto) {
    setFotoAberta(foto);
    setComentario(foto.comentarioAdmin || "");
    setAcaoAvaliacao(null);
    setMensagemSucesso("");
    setConfirmandoExclusao(false);
  }

  function fecharFoto() {
    if (excluindo) return;
    setConfirmandoExclusao(false);
    setAcaoAvaliacao(null);
    setMensagemSucesso("");
    setFotoAberta(null);
  }

  function selecionarAcao(acao: Exclude<AcaoAvaliacao, null>) {
    setAcaoAvaliacao(acao);
    setMensagemSucesso("");
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 18, paddingBottom: 28 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <View>
          <Text style={{ color: "#172033", fontSize: 27, fontWeight: "bold" }}>
            Fotos recebidas
          </Text>
          <Text style={{ color: "#68758A", paddingTop: 5 }}>
            {fotosFiltradas.length} de {fotos.length} fotos exibidas
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: "white",
          borderWidth: 1,
          borderColor: "#E0E5ED",
          borderRadius: 8,
          padding: 15,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Filtro titulo="Loja" opcoes={opcoes.lojas} valor={loja} onChange={setLoja} />
        <Filtro
          titulo="Promotor"
          opcoes={opcoes.promotores}
          valor={promotor}
          onChange={setPromotor}
        />
        <Filtro
          titulo="Categoria"
          opcoes={opcoes.categorias}
          valor={categoria}
          onChange={setCategoria}
        />
        <Filtro titulo="Status" opcoes={statusOpcoes} valor={status} onChange={setStatus} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -7 }}>
        {fotosFiltradas.map((foto) => {
          const estado = foto.status || "pendente";
          const visual = estiloStatus(estado);
          const data = obterData(foto.criadoEm);

          return (
            <View key={foto.id} style={{ width: larguraCard, padding: 7 }}>
              <Pressable
                onPress={() => abrirFoto(foto)}
                style={{
                  backgroundColor: "white",
                  borderWidth: 1,
                  borderColor: "#DFE4EC",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: imagemDaFoto(foto) }}
                  resizeMode="cover"
                  style={{
                    width: "100%",
                    aspectRatio: 4 / 3,
                    backgroundColor: "#E8EBF0",
                  }}
                />
                <View style={{ padding: 14, gap: 8 }}>
                  {foto.refacaoDeId ? (
                    <View
                      style={{
                        alignSelf: "flex-start",
                        backgroundColor: "#FFF1D9",
                        borderRadius: 5,
                        paddingVertical: 5,
                        paddingHorizontal: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <MaterialIcons name="history" size={15} color="#A6650B" />
                      <Text
                        style={{
                          color: "#A6650B",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      >
                        Refação {foto.numeroRefacao || 1}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: "#1E2A3E", fontWeight: "bold", fontSize: 15 }}
                      >
                        {foto.lojaNome || "Loja nao informada"}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: "#728096", fontSize: 13, paddingTop: 4 }}
                      >
                        {nomePromotor(foto)}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: visual.fundo,
                        borderRadius: 5,
                        paddingVertical: 5,
                        paddingHorizontal: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: visual.texto,
                          fontSize: 11,
                          fontWeight: "bold",
                          textTransform: "capitalize",
                        }}
                      >
                        {estado}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <Text style={{ color: "#59677D", fontSize: 12 }}>
                      {foto.categoria || "Sem categoria"}
                    </Text>
                    <Text style={{ color: "#8995A8", fontSize: 12 }}>
                      {data ? data.toLocaleDateString("pt-BR") : "Sem data"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      {fotosFiltradas.length === 0 ? (
        <View
          style={{
            backgroundColor: "white",
            borderWidth: 1,
            borderColor: "#E0E5ED",
            borderRadius: 8,
            padding: 34,
            alignItems: "center",
            gap: 8,
          }}
        >
          <MaterialIcons name="image-search" size={36} color="#97A3B5" />
          <Text style={{ color: "#526076", fontWeight: "bold" }}>
            Nenhuma foto encontrada
          </Text>
          <Text style={{ color: "#8995A8" }}>Altere os filtros para consultar outros envios.</Text>
        </View>
      ) : null}

      <Modal
        visible={!!fotoAberta}
        transparent
        animationType="fade"
        onRequestClose={fecharFoto}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(20,28,42,0.72)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {fotoAberta ? (
            <View
              style={{
                width: "100%",
                maxWidth: 1180,
                maxHeight: "92%",
                backgroundColor: "white",
                borderRadius: 8,
                overflow: "hidden",
                flexDirection: width >= 900 ? "row" : "column",
              }}
            >
              <View
                style={{
                  flex: 1.45,
                  minHeight: width >= 900 ? 620 : 340,
                  backgroundColor: "#111827",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={{ uri: imagemDaFoto(fotoAberta) }}
                  resizeMode="contain"
                  style={{ width: "100%", height: "100%", minHeight: 340 }}
                />
              </View>

              <ScrollView
                style={{ flex: 0.8, maxHeight: width >= 900 ? 620 : 420 }}
                contentContainerStyle={{ padding: 22, gap: 17 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#172033", fontSize: 21, fontWeight: "bold" }}>
                      {fotoAberta.lojaNome || "Loja nao informada"}
                    </Text>
                    <Text style={{ color: "#68758A", paddingTop: 5 }}>
                      {nomePromotor(fotoAberta)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={fecharFoto}
                    accessibilityLabel="Fechar"
                    style={botaoIcone}
                  >
                    <MaterialIcons name="close" size={22} color="#526076" />
                  </Pressable>
                </View>

                <View style={{ gap: 7 }}>
                  <Info titulo="Categoria" valor={fotoAberta.categoria || "Sem categoria"} />
                  <Info
                    titulo="Enviada em"
                    valor={
                      obterData(fotoAberta.criadoEm)?.toLocaleString("pt-BR") ||
                      "Sem data"
                    }
                  />
                  <Info
                    titulo="Observacao"
                    valor={fotoAberta.observacao || "Sem observacao"}
                  />
                  {fotoAberta.refacaoDeId ? (
                    <Info
                      titulo={`Refação ${fotoAberta.numeroRefacao || 1}`}
                      valor={
                        fotoAberta.motivoRefacao ||
                        "Nova versão enviada pelo promotor"
                      }
                    />
                  ) : null}
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: "#E4E8EF",
                  }}
                />

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Acao
                    titulo={salvando ? "Salvando..." : "Aprovar"}
                    icone="check-circle"
                    cor="#24864B"
                    onPress={() => atualizarStatus("aprovada")}
                    disabled={salvando}
                  />
                  <Acao
                    titulo="Pedir refacao"
                    icone="replay"
                    cor="#B87312"
                    onPress={() => selecionarAcao("refazer")}
                    selecionada={acaoAvaliacao === "refazer"}
                    disabled={salvando}
                  />
                  <Acao
                    titulo="Rejeitar"
                    icone="cancel"
                    cor="#B5323E"
                    onPress={() => selecionarAcao("rejeitada")}
                    selecionada={acaoAvaliacao === "rejeitada"}
                    disabled={salvando}
                  />
                </View>

                {acaoAvaliacao ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor:
                        acaoAvaliacao === "refazer" ? "#E0B568" : "#E4A1A8",
                      borderRadius: 8,
                      padding: 13,
                      backgroundColor:
                        acaoAvaliacao === "refazer" ? "#FFF9EF" : "#FFF5F6",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <MaterialIcons
                        name={
                          acaoAvaliacao === "refazer" ? "replay" : "cancel"
                        }
                        size={20}
                        color={
                          acaoAvaliacao === "refazer" ? "#A6650B" : "#B5323E"
                        }
                      />
                      <Text
                        style={{
                          color:
                            acaoAvaliacao === "refazer"
                              ? "#7A4B08"
                              : "#8F2630",
                          fontWeight: "bold",
                        }}
                      >
                        {acaoAvaliacao === "refazer"
                          ? "Solicitar nova foto"
                          : "Rejeitar esta foto"}
                      </Text>
                    </View>

                    <Text style={{ color: "#68758A", lineHeight: 19 }}>
                      O comentário é opcional e será exibido ao promotor.
                    </Text>

                    <TextInput
                      value={comentario}
                      onChangeText={setComentario}
                      editable={!salvando}
                      multiline
                      placeholder={
                        acaoAvaliacao === "refazer"
                          ? "Ex.: enquadrar toda a gôndola"
                          : "Ex.: foto não corresponde à loja"
                      }
                      placeholderTextColor="#9AA5B5"
                      style={{
                        minHeight: 94,
                        borderWidth: 1,
                        borderColor: "#D5DBE5",
                        borderRadius: 7,
                        padding: 11,
                        backgroundColor: "white",
                        color: "#172033",
                        textAlignVertical: "top",
                      }}
                    />

                    <Pressable
                      onPress={() => atualizarStatus(acaoAvaliacao)}
                      disabled={salvando}
                      style={{
                        minHeight: 43,
                        borderRadius: 7,
                        backgroundColor:
                          acaoAvaliacao === "refazer" ? "#B87312" : "#B5323E",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: salvando ? 0.65 : 1,
                      }}
                    >
                      <Text style={{ color: "white", fontWeight: "bold" }}>
                        {salvando
                          ? "Salvando..."
                          : acaoAvaliacao === "refazer"
                            ? "Confirmar refação"
                            : "Confirmar rejeição"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {mensagemSucesso ? (
                  <View
                    style={{
                      minHeight: 44,
                      borderRadius: 7,
                      backgroundColor: "#E5F5EB",
                      borderWidth: 1,
                      borderColor: "#A9D8BA",
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color="#24864B"
                    />
                    <Text style={{ flex: 1, color: "#247946", fontWeight: "bold" }}>
                      {mensagemSucesso}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Acao
                    titulo="Baixar"
                    icone="download"
                    cor="#2F6FED"
                    contorno
                    onPress={baixarFoto}
                  />
                  <Acao
                    titulo="Excluir"
                    icone="delete-outline"
                    cor="#B5323E"
                    contorno
                    onPress={confirmarExclusao}
                  />
                </View>
              </ScrollView>
            </View>
          ) : null}

          {confirmandoExclusao ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 50,
                backgroundColor: "rgba(20,28,42,0.58)",
                alignItems: "center",
                justifyContent: "center",
                padding: 22,
              }}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: 430,
                  backgroundColor: "white",
                  borderRadius: 8,
                  padding: 22,
                  gap: 15,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    backgroundColor: "#FBE7E9",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={25}
                    color="#B5323E"
                  />
                </View>

                <View style={{ gap: 7 }}>
                  <Text
                    style={{
                      color: "#172033",
                      fontSize: 20,
                      fontWeight: "bold",
                    }}
                  >
                    Excluir foto
                  </Text>
                  <Text style={{ color: "#68758A", lineHeight: 21 }}>
                    Essa foto sera removida permanentemente e nao podera ser
                    recuperada.
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 9,
                    paddingTop: 3,
                  }}
                >
                  <Pressable
                    onPress={() => setConfirmandoExclusao(false)}
                    disabled={excluindo}
                    style={{
                      minHeight: 42,
                      borderWidth: 1,
                      borderColor: "#D7DDE7",
                      borderRadius: 7,
                      paddingHorizontal: 15,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#526076", fontWeight: "bold" }}>
                      Cancelar
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={excluirFoto}
                    disabled={excluindo}
                    style={{
                      minHeight: 42,
                      minWidth: 104,
                      borderRadius: 7,
                      paddingHorizontal: 15,
                      backgroundColor: excluindo ? "#D7838B" : "#B5323E",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      {excluindo ? "Excluindo..." : "Excluir"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

type FiltroProps = {
  titulo: string;
  opcoes: string[];
  valor: string;
  onChange: (valor: string) => void;
};

function Filtro({ titulo, opcoes, valor, onChange }: FiltroProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <View style={{ minWidth: 190, flex: 1, maxWidth: 280 }}>
      <Text style={{ color: "#657189", fontSize: 12, paddingBottom: 6 }}>{titulo}</Text>
      <Pressable
        onPress={() => setAberto((atual) => !atual)}
        style={{
          minHeight: 42,
          borderWidth: 1,
          borderColor: "#D7DDE7",
          borderRadius: 7,
          paddingHorizontal: 11,
          backgroundColor: "#FAFBFC",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: "#34415A" }}>
          {valor}
        </Text>
        <MaterialIcons name="expand-more" size={20} color="#738097" />
      </Pressable>

      <Modal
        visible={aberto}
        transparent
        animationType="fade"
        onRequestClose={() => setAberto(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(20,28,42,0.35)",
            alignItems: "center",
            justifyContent: "center",
            padding: 22,
          }}
        >
          <Pressable
            onPress={() => setAberto(false)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />

          <View
            style={{
              width: "100%",
              maxWidth: 420,
              maxHeight: "70%",
              backgroundColor: "white",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 12px 36px rgba(25, 37, 58, 0.22)",
            }}
          >
            <View
              style={{
                minHeight: 58,
                borderBottomWidth: 1,
                borderBottomColor: "#E5E9EF",
                paddingHorizontal: 17,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <Text style={{ color: "#172033", fontSize: 17, fontWeight: "bold" }}>
                Filtrar por {titulo.toLowerCase()}
              </Text>
              <Pressable
                onPress={() => setAberto(false)}
                accessibilityLabel="Fechar filtro"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  backgroundColor: "#F0F2F6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="close" size={20} color="#526076" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 7 }}>
              {opcoes.map((opcao) => {
                const selecionada = opcao === valor;

                return (
                  <Pressable
                    key={opcao}
                    onPress={() => {
                      onChange(opcao);
                      setAberto(false);
                    }}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 17,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      backgroundColor: selecionada ? "#EEF3FD" : "white",
                    }}
                  >
                    <Text
                      numberOfLines={2}
                      style={{
                        flex: 1,
                        color: selecionada ? "#2F6FED" : "#34415A",
                        fontWeight: selecionada ? "bold" : "normal",
                      }}
                    >
                      {opcao}
                    </Text>
                    {selecionada ? (
                      <MaterialIcons name="check" size={20} color="#2F6FED" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View>
      <Text style={{ color: "#8995A8", fontSize: 12 }}>{titulo}</Text>
      <Text style={{ color: "#34415A", paddingTop: 3, lineHeight: 20 }}>{valor}</Text>
    </View>
  );
}

type AcaoProps = {
  titulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  cor: string;
  onPress: () => void;
  contorno?: boolean;
  selecionada?: boolean;
  disabled?: boolean;
};

function Acao({
  titulo,
  icone,
  cor,
  onPress,
  contorno,
  selecionada,
  disabled,
}: AcaoProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 42,
        flexGrow: 1,
        borderRadius: 7,
        borderWidth: contorno || selecionada ? 2 : 0,
        borderColor: cor,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        backgroundColor: contorno || selecionada ? "white" : cor,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <MaterialIcons
        name={icone}
        size={19}
        color={contorno || selecionada ? cor : "white"}
      />
      <Text
        style={{
          color: contorno || selecionada ? cor : "white",
          fontWeight: "bold",
        }}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

const botaoIcone = {
  width: 38,
  height: 38,
  borderRadius: 7,
  backgroundColor: "#F0F2F6",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
