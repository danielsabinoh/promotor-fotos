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
import CardVisitaFotos from "@/components/card-visita-fotos";
import ConfirmarAprovacaoVisita from "@/components/confirmar-aprovacao-visita";
import HistoricoAvaliacoes from "@/components/historico-avaliacoes";
import { agruparFotosPorVisita, type VisitaFotos } from "@/utils/visitas-fotos";
import { onSnapshot } from "firebase/firestore";

import { STATUS_FOTO_FILTRO_OPCOES } from "@/constants/status-foto";
import { useCategoriasFoto } from "@/hooks/use-categorias-foto";
import { categoriasParaFiltro } from "@/utils/catalogo-categorias";
import {
  consultaFotosOrdenadasPorData,
  excluirFoto as excluirFotoPorId,
} from "@/services/fotos-service";
import { atualizarFotoComNotificacao } from "@/services/notificacoes";
import { useTheme } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import type { Foto } from "@/types/foto";
import { obterData } from "@/utils/datas";
import {
  filtrarFotosAtuais,
  obterImagemUri as imagemDaFoto,
  obterRotuloVisita,
} from "@/utils/fotos";

type AcaoAvaliacao = "refazer" | "rejeitada" | null;

const statusOpcoes = [...STATUS_FOTO_FILTRO_OPCOES];

function nomePromotor(foto: Foto) {
  return foto.promotorNome || foto.promotorEmail || "Promotor nao identificado";
}

export default function FotosWeb() {
  const { colors } = useTheme();
  const { categorias } = useCategoriasFoto();
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [fotoSelecionada, setFotoAberta] = useState<Foto | null>(null);
  const fotoAberta = fotoSelecionada ? fotos.find((foto) => foto.id === fotoSelecionada.id) || null : null;
  const [visitaAprovando, setVisitaAprovando] = useState<VisitaFotos | null>(null);
  const [loja, setLoja] = useState("Todas");
  const [promotor, setPromotor] = useState("Todos");
  const [categoria, setCategoria] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [comentario, setComentario] = useState("");
  const [acaoAvaliacao, setAcaoAvaliacao] = useState<AcaoAvaliacao>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
    return onSnapshot(
      consultaFotosOrdenadasPorData(),
      (snapshot) => {
        const lista = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Foto[];

        setFotos(filtrarFotosAtuais(lista));
      },
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Nao foi possivel carregar as fotos.");
      },
    );
  }, []);

  const opcoes = useMemo(
    () => ({
      lojas: [
        "Todas",
        ...new Set(fotos.map((foto) => foto.lojaNome || "Sem loja")),
      ],
      promotores: ["Todos", ...new Set(fotos.map(nomePromotor))],
      categorias: [
        "Todas",
        ...categoriasParaFiltro(categorias, fotos.map((foto) => foto.categoria || "Sem categoria")),
      ],
    }),
    [categorias, fotos],
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

  const visitasFiltradas = useMemo(() => agruparFotosPorVisita(fotos, fotosFiltradas), [fotos, fotosFiltradas]);
  const colunas = width >= 1200 ? 2 : 1;
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
      Alert.alert(
        "Erro",
        error.message || "Nao foi possivel atualizar a foto.",
      );
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
      await excluirFotoPorId(fotoAberta.id);
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

  const botaoIcone = {
    width: 38,
    height: 38,
    borderRadius: 7,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

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
          <Text
            style={{ color: colors.text, fontSize: 27, fontWeight: "bold" }}
          >
            Visitas recebidas
          </Text>
          <Text style={{ color: colors.textSubtle, paddingTop: 5 }}>
            {visitasFiltradas.length} visita(s) · {fotosFiltradas.length} de {fotos.length} fotos nos filtros
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 15,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Filtro
          colors={colors}
          titulo="Loja"
          opcoes={opcoes.lojas}
          valor={loja}
          onChange={setLoja}
        />
        <Filtro
          colors={colors}
          titulo="Promotor"
          opcoes={opcoes.promotores}
          valor={promotor}
          onChange={setPromotor}
        />
        <Filtro
          colors={colors}
          titulo="Categoria"
          opcoes={opcoes.categorias}
          valor={categoria}
          onChange={setCategoria}
        />
        <Filtro
          colors={colors}
          titulo="Status"
          opcoes={statusOpcoes}
          valor={status}
          onChange={setStatus}
        />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -7 }}>
        {visitasFiltradas.map((visita) => (
          <View key={visita.id} style={{ width: larguraCard, padding: 7 }}>
            <CardVisitaFotos
              key={visita.correspondentes.join(",")}
              visita={visita}
              nomePromotor={nomePromotor(visita.fotos[0])}
              bloqueado={salvando}
              onAbrirFoto={abrirFoto}
              onAprovarVisita={setVisitaAprovando}
            />
          </View>
        ))}
      </View>

      {fotosFiltradas.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            padding: 34,
            alignItems: "center",
            gap: 8,
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
          <Text style={{ color: colors.textSubtle }}>
            Altere os filtros para consultar outros envios.
          </Text>
        </View>
      ) : null}

      {visitaAprovando ? <ConfirmarAprovacaoVisita visita={visitaAprovando} onFechar={() => setVisitaAprovando(null)} /> : null}

      <Modal
        visible={!!fotoAberta}
        transparent
        animationType="fade"
        onRequestClose={fecharFoto}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
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
                backgroundColor: colors.surface,
                borderRadius: 8,
                overflow: "hidden",
                flexDirection: width >= 900 ? "row" : "column",
                borderWidth: 1,
                borderColor: colors.border,
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
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 21,
                        fontWeight: "bold",
                      }}
                    >
                      {fotoAberta.lojaNome || "Loja nao informada"}
                    </Text>
                    <Text style={{ color: colors.textSubtle, paddingTop: 5 }}>
                      {nomePromotor(fotoAberta)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={fecharFoto}
                    accessibilityLabel="Fechar"
                    style={botaoIcone}
                  >
                    <MaterialIcons
                      name="close"
                      size={22}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>

                <View style={{ gap: 7 }}>
                  <Info
                    colors={colors}
                    titulo="Categoria"
                    valor={fotoAberta.categoria || "Sem categoria"}
                  />
                  <Info
                    colors={colors}
                    titulo="Enviada em"
                    valor={
                      obterData(fotoAberta.criadoEm)?.toLocaleString("pt-BR") ||
                      "Sem data"
                    }
                  />
                  {obterRotuloVisita(fotoAberta) ? (
                    <Info
                      colors={colors}
                      titulo="Visita"
                      valor={obterRotuloVisita(fotoAberta)}
                    />
                  ) : null}
                  <Info
                    colors={colors}
                    titulo="Observacao"
                    valor={fotoAberta.observacao || "Sem observacao"}
                  />
                  {fotoAberta.refacaoDeId ? (
                    <Info
                      colors={colors}
                      titulo={`Refação ${fotoAberta.numeroRefacao || 1}`}
                      valor={
                        fotoAberta.motivoRefacao ||
                        "Nova versão enviada pelo promotor"
                      }
                    />
                  ) : null}
                </View>

                <HistoricoAvaliacoes key={fotoAberta.id} foto={fotoAberta} />

                <View style={{ height: 1, backgroundColor: colors.border }} />

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Acao
                    colors={colors}
                    titulo={salvando ? "Salvando..." : "Aprovar"}
                    icone="check-circle"
                    cor={colors.success}
                    onPress={() => atualizarStatus("aprovada")}
                    disabled={salvando}
                  />
                  <Acao
                    colors={colors}
                    titulo="Pedir refacao"
                    icone="replay"
                    cor={colors.warning}
                    onPress={() => selecionarAcao("refazer")}
                    selecionada={acaoAvaliacao === "refazer"}
                    disabled={salvando}
                  />
                  <Acao
                    colors={colors}
                    titulo="Rejeitar"
                    icone="cancel"
                    cor={colors.danger}
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
                        acaoAvaliacao === "refazer"
                          ? colors.warning
                          : colors.danger,
                      borderRadius: 8,
                      padding: 13,
                      backgroundColor:
                        acaoAvaliacao === "refazer"
                          ? colors.warningSurface
                          : colors.dangerSurface,
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
                          acaoAvaliacao === "refazer"
                            ? colors.warning
                            : colors.danger
                        }
                      />
                      <Text
                        style={{
                          color:
                            acaoAvaliacao === "refazer"
                              ? colors.warningText
                              : colors.dangerText,
                          fontWeight: "bold",
                        }}
                      >
                        {acaoAvaliacao === "refazer"
                          ? "Solicitar nova foto"
                          : "Rejeitar esta foto"}
                      </Text>
                    </View>

                    <Text style={{ color: colors.textMuted, lineHeight: 19 }}>
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
                      placeholderTextColor={colors.placeholder}
                      style={{
                        minHeight: 94,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 7,
                        padding: 11,
                        backgroundColor: colors.surface,
                        color: colors.text,
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
                          acaoAvaliacao === "refazer"
                            ? colors.warning
                            : colors.danger,
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
                      backgroundColor: colors.successSurface,
                      borderWidth: 1,
                      borderColor: colors.success,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color={colors.success}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.successText,
                        fontWeight: "bold",
                      }}
                    >
                      {mensagemSucesso}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Acao
                    colors={colors}
                    titulo="Baixar"
                    icone="download"
                    cor={colors.primary}
                    contorno
                    onPress={baixarFoto}
                  />
                  <Acao
                    colors={colors}
                    titulo="Excluir"
                    icone="delete-outline"
                    cor={colors.danger}
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
                backgroundColor: colors.overlay,
                alignItems: "center",
                justifyContent: "center",
                padding: 22,
              }}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: 430,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 22,
                  gap: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    backgroundColor: colors.dangerSurface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={25}
                    color={colors.danger}
                  />
                </View>

                <View style={{ gap: 7 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 20,
                      fontWeight: "bold",
                    }}
                  >
                    Excluir foto
                  </Text>
                  <Text style={{ color: colors.textSubtle, lineHeight: 21 }}>
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
                      borderColor: colors.border,
                      borderRadius: 7,
                      paddingHorizontal: 15,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontWeight: "bold" }}>
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
                      backgroundColor: excluindo
                        ? colors.dangerSurface
                        : colors.danger,
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
  colors: ThemeColors;
  titulo: string;
  opcoes: string[];
  valor: string;
  onChange: (valor: string) => void;
};

function Filtro({ colors, titulo, opcoes, valor, onChange }: FiltroProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <View style={{ minWidth: 190, flex: 1, maxWidth: 280 }}>
      <Text
        style={{ color: colors.textSubtle, fontSize: 12, paddingBottom: 6 }}
      >
        {titulo}
      </Text>
      <Pressable
        onPress={() => setAberto((atual) => !atual)}
        style={{
          minHeight: 42,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 7,
          paddingHorizontal: 11,
          backgroundColor: colors.backgroundAlt,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: colors.text }}>
          {valor}
        </Text>
        <MaterialIcons name="expand-more" size={20} color={colors.iconMuted} />
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
            backgroundColor: colors.overlay,
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
              backgroundColor: colors.surface,
              borderRadius: 8,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                minHeight: 58,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingHorizontal: 17,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 17,
                  fontWeight: "bold",
                }}
              >
                Filtrar por {titulo.toLowerCase()}
              </Text>
              <Pressable
                onPress={() => setAberto(false)}
                accessibilityLabel="Fechar filtro"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  backgroundColor: colors.surfaceElevated,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={colors.textMuted}
                />
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
                      backgroundColor: selecionada
                        ? colors.primarySurface
                        : colors.surface,
                    }}
                  >
                    <Text
                      numberOfLines={2}
                      style={{
                        flex: 1,
                        color: selecionada ? colors.primary : colors.text,
                        fontWeight: selecionada ? "bold" : "normal",
                      }}
                    >
                      {opcao}
                    </Text>
                    {selecionada ? (
                      <MaterialIcons
                        name="check"
                        size={20}
                        color={colors.primary}
                      />
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

function Info({
  colors,
  titulo,
  valor,
}: {
  colors: ThemeColors;
  titulo: string;
  valor: string;
}) {
  return (
    <View>
      <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{titulo}</Text>
      <Text style={{ color: colors.text, paddingTop: 3, lineHeight: 20 }}>
        {valor}
      </Text>
    </View>
  );
}

type AcaoProps = {
  colors: ThemeColors;
  titulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  cor: string;
  onPress: () => void;
  contorno?: boolean;
  selecionada?: boolean;
  disabled?: boolean;
};

function Acao({
  colors,
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
        backgroundColor:
          contorno || selecionada ? colors.surface : cor,
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
