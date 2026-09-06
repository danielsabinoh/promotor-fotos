import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { signOut } from "firebase/auth";
import {
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import {
  nomeCategoriaFoto,
} from "@/constants/categorias-foto";
import {
  DESTINOS_AVARIA,
  MOTIVOS_AVARIA,
  categoriaExigeOcorrenciaEstoque,
  tipoOcorrenciaPorCategoria,
} from "@/constants/estoque";
import { ROTAS } from "@/constants/routes";
import { auth } from "@/services/firebaseConfig";
import { useCategoriasFoto } from "@/hooks/use-categorias-foto";
import { buscarCatalogoCategorias } from "@/services/categorias-service";
import { categoriaEstaAtiva } from "@/utils/catalogo-categorias";
import { criarFoto } from "@/services/fotos-service";
import { criarOcorrenciaEstoque } from "@/services/ocorrencias-estoque-service";
import { consultaProdutosAtivos } from "@/services/produtos-service";
import { buscarUsuario } from "@/services/usuarios-service";
import { criarVisita } from "@/services/visitas-service";
import { useTheme } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import type { ItemOcorrenciaEstoque } from "@/types/ocorrencia-estoque";
import type { Produto } from "@/types/produto";
import { prepararImagemBase64 } from "@/utils/imagem";
import { primeiroParametro } from "@/utils/params";

const LIMITE_OBSERVACAO = 300;

type EtapaEnvio = "preparando" | "enviando" | null;

type ItemOcorrenciaFormulario = Omit<
  ItemOcorrenciaEstoque,
  | "estoqueLoja"
  | "estoqueDisponivel"
  | "quantidadeRuptura"
  | "quantidadeAvaria"
> & {
  estoqueLoja?: string;
  estoqueDisponivel?: string;
  quantidadeRuptura?: string;
  quantidadeAvaria?: string;
};

type FotoVisitaRascunho = {
  id: string;
  imagem: string;
  categoria: string;
  categoriaNome: string;
  observacao: string;
  itensOcorrencia: ItemOcorrenciaFormulario[];
};

export default function EnviarFoto() {
  const { colors } = useTheme();
  const { categorias, categoriasAtivas, carregando: carregandoCategorias, erro: erroCategorias, recarregar: recarregarCategorias } = useCategoriasFoto();
  const parametros = useLocalSearchParams<{
    lojaId?: string | string[];
    lojaNome?: string | string[];
    categoriaInicial?: string | string[];
    refacaoDeId?: string | string[];
    numeroRefacao?: string | string[];
    motivoRefacao?: string | string[];
  }>();
  const lojaId = primeiroParametro(parametros.lojaId);
  const lojaNome = primeiroParametro(parametros.lojaNome) || "Loja";
  const categoriaInicial = primeiroParametro(parametros.categoriaInicial);
  const refacaoDeId = primeiroParametro(parametros.refacaoDeId);
  const motivoRefacao = primeiroParametro(parametros.motivoRefacao) || "";
  const numeroRefacao =
    Number(primeiroParametro(parametros.numeroRefacao)) || 1;
  const ehRefacao = !!refacaoDeId;

  const [imagem, setImagem] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [categoria, setCategoria] = useState<string | null>(
    categoriaInicial || null,
  );
  const [etapaEnvio, setEtapaEnvio] = useState<EtapaEnvio>(null);
  const [envioConcluido, setEnvioConcluido] = useState(false);
  const [fotosVisita, setFotosVisita] = useState<FotoVisitaRascunho[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [itensOcorrencia, setItensOcorrencia] = useState<
    ItemOcorrenciaFormulario[]
  >([]);

  const enviando = etapaEnvio !== null;
  const tipoOcorrencia = tipoOcorrenciaPorCategoria(categoria);
  const exigeOcorrencia = categoriaExigeOcorrenciaEstoque(categoria);
  const fotoAtualValida =
    !!imagem &&
    categoriaEstaAtiva(categoria, categorias) &&
    (!exigeOcorrencia || itensOcorrencia.length > 0);
  const formularioValido =
    (fotoAtualValida || fotosVisita.length > 0) && !enviando && !carregandoCategorias && !erroCategorias &&
    fotosVisita.every((foto) => categoriaEstaAtiva(foto.categoria, categorias));
  const categoriaExibicao = nomeCategoriaFoto(categoria);

  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLocaleLowerCase("pt-BR");
    const ativos = produtos.filter((produto) => produto.ativo !== false);
    const produtosSelecionadosIds = new Set(
      itensOcorrencia.map((item) => item.produtoId),
    );
    const selecionados = ativos.filter((produto) =>
      produtosSelecionadosIds.has(produto.id),
    );

    const resultados = !termo
      ? ativos
      : ativos.filter((produto) =>
          [
            produto.codigo,
            produto.nome,
            produto.marca,
          ]
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(termo),
        );

    return [
      ...selecionados,
      ...resultados
        .filter((produto) => !produtosSelecionadosIds.has(produto.id))
        .slice(0, Math.max(0, 8 - selecionados.length)),
    ];
  }, [buscaProduto, itensOcorrencia, produtos]);

  useEffect(() => {
    return onSnapshot(consultaProdutosAtivos(), (snapshot) => {
      setProdutos(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Produto[],
      );
    });
  }, []);

  function removerImagem() {
    if (enviando) return;
    setImagem(null);
    setCategoria(null);
    setItensOcorrencia([]);
  }

  function selecionarCategoria(novaCategoria: string) {
    setCategoria(novaCategoria);
    setBuscaProduto("");
    setItensOcorrencia([]);
  }

  async function tirarFoto() {
    if (enviando) return;

    const permissao = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissao.granted) {
      Alert.alert(
        "Permissão necessária",
        "Permita o acesso à câmera para tirar a foto.",
      );
      return;
    }

    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!resultado.canceled) {
      setImagem(resultado.assets[0].uri);
    }
  }

  async function escolherFoto() {
    if (enviando) return;

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!resultado.canceled) {
      setImagem(resultado.assets[0].uri);
    }
  }

  function numeroOuZero(valor: string) {
    const numero = Number(valor.replace(",", "."));
    return Number.isFinite(numero) && numero >= 0 ? numero : 0;
  }

  function limparFormularioItem() {
    setBuscaProduto("");
    setItensOcorrencia([]);
  }

  function limparFotoAtual() {
    setImagem(null);
    setCategoria(ehRefacao ? categoriaInicial || null : null);
    setObservacao("");
    limparFormularioItem();
  }

  function criarItemOcorrenciaFormulario(
    produto: Produto,
  ): ItemOcorrenciaFormulario {
    const itemBase = {
      produtoId: produto.id,
      codigo: produto.codigo || "",
      nome: produto.nome,
      complemento: produto.marca || "",
      observacao: "",
    };

    if (tipoOcorrencia === "avaria") {
      return {
        ...itemBase,
        quantidadeAvaria: "",
        motivoAvaria: MOTIVOS_AVARIA[0],
        destinoAvaria: DESTINOS_AVARIA[0],
      };
    }

    return {
      ...itemBase,
      estoqueLoja: "",
      estoqueDisponivel: "",
      ruptura: false,
      quantidadeRuptura: "",
    };
  }

  function alternarProdutoOcorrencia(produto: Produto) {
    if (enviando || !tipoOcorrencia) return;

    setItensOcorrencia((atuais) => {
      const jaSelecionado = atuais.some((item) => item.produtoId === produto.id);

      if (jaSelecionado) {
        return atuais.filter((item) => item.produtoId !== produto.id);
      }

      return [...atuais, criarItemOcorrenciaFormulario(produto)];
    });
  }

  function atualizarItemOcorrencia<K extends keyof ItemOcorrenciaFormulario>(
    indice: number,
    campo: K,
    valor: ItemOcorrenciaFormulario[K],
  ) {
    setItensOcorrencia((atuais) =>
      atuais.map((item, itemIndice) =>
        itemIndice === indice ? { ...item, [campo]: valor } : item,
      ),
    );
  }

  function removerItemOcorrencia(indice: number) {
    if (enviando) return;
    setItensOcorrencia((atuais) =>
      atuais.filter((_, itemIndice) => itemIndice !== indice),
    );
  }

  function indiceItemOcorrencia(produtoId: string) {
    return itensOcorrencia.findIndex((item) => item.produtoId === produtoId);
  }

  function normalizarItensOcorrencia(
    itens: ItemOcorrenciaFormulario[],
    categoriaFoto: string | null,
  ): ItemOcorrenciaEstoque[] {
    const tipo = tipoOcorrenciaPorCategoria(categoriaFoto);

    return itens.map((item) => {
      const itemBase = {
        produtoId: item.produtoId,
        codigo: item.codigo || "",
        nome: item.nome,
        complemento: item.complemento || "",
        observacao: item.observacao?.trim() || "",
      };

      if (tipo === "avaria") {
        return {
          ...itemBase,
          quantidadeAvaria: numeroOuZero(item.quantidadeAvaria || ""),
          motivoAvaria: item.motivoAvaria || MOTIVOS_AVARIA[0],
          destinoAvaria: item.destinoAvaria || DESTINOS_AVARIA[0],
        };
      }

      return {
        ...itemBase,
        estoqueLoja: numeroOuZero(item.estoqueLoja || ""),
        estoqueDisponivel: numeroOuZero(item.estoqueDisponivel || ""),
        ruptura: !!item.ruptura,
        quantidadeRuptura: item.ruptura
          ? numeroOuZero(item.quantidadeRuptura || "")
          : 0,
      };
    });
  }

  function criarRascunhoFotoAtual(): FotoVisitaRascunho | null {
    if (!fotoAtualValida || !imagem || !categoria) return null;

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      imagem,
      categoria,
      categoriaNome: nomeCategoriaFoto(categoria) || categoria,
      observacao: observacao.trim(),
      itensOcorrencia: itensOcorrencia.map((item) => ({ ...item })),
    };
  }

  function adicionarFotoNaVisita() {
    const rascunho = criarRascunhoFotoAtual();

    if (!rascunho) {
      Alert.alert(
        "Foto incompleta",
        "Anexe a foto, escolha a categoria e preencha os dados obrigatorios antes de adicionar.",
      );
      return;
    }

    setFotosVisita((atuais) => [...atuais, rascunho]);
    limparFotoAtual();
  }

  function removerFotoDaVisita(id: string) {
    if (enviando) return;
    setFotosVisita((atuais) => atuais.filter((foto) => foto.id !== id));
  }

  async function enviarFoto() {
    const fotoAtual = criarRascunhoFotoAtual();
    const fotosParaEnviar = fotoAtual
      ? [...fotosVisita, fotoAtual]
      : fotosVisita;

    if (!formularioValido || fotosParaEnviar.length === 0) return;

    try {
      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        Alert.alert("Erro", "Usuário não encontrado.");
        return;
      }

      if (!lojaId) {
        Alert.alert("Erro", "A loja deste envio não foi identificada.");
        return;
      }

      setEtapaEnvio("preparando");
      const catalogoAtual = await buscarCatalogoCategorias();
      if (fotosParaEnviar.some((foto) => !categoriaEstaAtiva(foto.categoria, catalogoAtual))) {
        Alert.alert("Categoria desativada", "Uma categoria deste envio foi desativada. Selecione outra categoria ou remova a foto da visita.");
        return;
      }
      const usuarioSnap = await buscarUsuario(usuarioAtual.uid);

      if (!usuarioSnap.exists() || usuarioSnap.data().ativo === false) {
        await signOut(auth);
        Alert.alert(
          "Acesso removido",
          "Seu cadastro não está mais ativo no sistema.",
        );
        router.replace(ROTAS.login);
        return;
      }

      const promotorNome =
        usuarioSnap.data()?.nome ||
        usuarioAtual.displayName ||
        usuarioAtual.email ||
        "";

      setEtapaEnvio("enviando");
      const visitaRef = await criarVisita({
        lojaId,
        lojaNome,
        promotorId: usuarioAtual.uid,
        promotorNome,
        promotorEmail: usuarioAtual.email || "",
        status: "pendente",
        totalFotos: fotosParaEnviar.length,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });

      for (const [indice, foto] of fotosParaEnviar.entries()) {
        setEtapaEnvio("preparando");
        const imagemBase64 = await prepararImagemBase64(foto.imagem);
        const tipoOcorrenciaSelecionada =
          tipoOcorrenciaPorCategoria(foto.categoria);
        const itensOcorrenciaNormalizados = normalizarItensOcorrencia(
          foto.itensOcorrencia,
          foto.categoria,
        );

        setEtapaEnvio("enviando");
        const fotoRef = await criarFoto({
          lojaId,
          lojaNome,
          promotorId: usuarioAtual.uid,
          promotorNome,
          promotorEmail: usuarioAtual.email || "",
          imagemBase64,
          categoria: foto.categoria,
          status: "pendente",
          comentarioAdmin: "",
          observacao: foto.observacao,
          criadoEm: serverTimestamp(),
          visitaId: visitaRef.id,
          indiceNaVisita: indice + 1,
          totalFotosVisita: fotosParaEnviar.length,
          naLixeira: false,
          refacaoDeId: ehRefacao ? refacaoDeId || null : null,
          numeroRefacao: ehRefacao ? numeroRefacao : 0,
          motivoRefacao: ehRefacao ? motivoRefacao : "",
        });

        if (
          tipoOcorrenciaSelecionada &&
          itensOcorrenciaNormalizados.length > 0
        ) {
          await criarOcorrenciaEstoque({
            tipo: tipoOcorrenciaSelecionada,
            fotoId: fotoRef.id,
            visitaId: visitaRef.id,
            lojaId,
            lojaNome,
            promotorId: usuarioAtual.uid,
            promotorNome,
            promotorEmail: usuarioAtual.email || "",
            categoriaFoto: foto.categoria,
            observacao: foto.observacao,
            itens: itensOcorrenciaNormalizados,
            status: "pendente",
            criadoEm: serverTimestamp(),
          });
        }
      }

      setEnvioConcluido(true);
    } catch (error: any) {
      console.log(error);
      Alert.alert(
        "Não foi possível enviar",
        error.message || "Verifique sua conexão e tente novamente.",
      );
    } finally {
      setEtapaEnvio(null);
    }
  }

  function prepararNovoEnvio() {
    limparFotoAtual();
    setFotosVisita([]);
    setEnvioConcluido(false);
  }

  const estilos = criarEstilos(colors);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 36,
        gap: 22,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => router.back()}
          disabled={enviando}
          accessibilityLabel="Voltar"
          style={estilos.botaoIcone}
        >
          <MaterialIcons name="arrow-back" size={23} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 27, fontWeight: "bold" }}>
            {ehRefacao ? "Refazer foto" : "Enviar foto"}
          </Text>
          <Text style={{ color: colors.textSubtle, paddingTop: 3 }}>
            {ehRefacao
              ? `Nova versão do envio · Refação ${numeroRefacao}`
              : "Novo registro de execução"}
          </Text>
        </View>
      </View>

      <View
        style={{
          minHeight: 62,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 13,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 7,
            backgroundColor: colors.primarySurface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="storefront" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textSubtle, fontSize: 12 }}>
            Loja do envio
          </Text>
          <Text
            numberOfLines={2}
            style={{ color: colors.text, fontWeight: "bold", paddingTop: 2 }}
          >
            {lojaNome}
          </Text>
        </View>
      </View>

      {ehRefacao ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.warning,
            borderRadius: 8,
            padding: 14,
            backgroundColor: colors.warningSurface,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 11,
          }}
        >
          <MaterialIcons name="rate-review" size={24} color={colors.warning} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: colors.warningText, fontWeight: "bold" }}>
              Correção solicitada pelo responsável
            </Text>
            <Text style={{ color: colors.warningText, lineHeight: 20, opacity: 0.85 }}>
              {motivoRefacao ||
                "Confira a execução e envie uma nova foto para análise."}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 11 }}>
        <TituloSecao colors={colors} numero="1" titulo="Foto" />

        {!imagem ? (
          <View
            style={{
              minHeight: 236,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.borderStrong,
              borderRadius: 8,
              backgroundColor: colors.surface,
              padding: 20,
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
            }}
          >
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 8,
                backgroundColor: colors.primarySurface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="add-a-photo" size={30} color={colors.primary} />
            </View>

            <View style={{ alignItems: "center", gap: 5 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "bold" }}>
                Adicione a foto da execução
              </Text>
              <Text style={{ color: colors.textSubtle, textAlign: "center" }}>
                Use a câmera ou escolha uma imagem já salva.
              </Text>
            </View>

            <View style={{ width: "100%", flexDirection: "row", gap: 9 }}>
              <Pressable onPress={tirarFoto} style={estilos.botaoPrimario}>
                <MaterialIcons name="photo-camera" size={20} color={colors.primaryText} />
                <Text style={{ color: colors.primaryText, fontWeight: "bold" }}>
                  Câmera
                </Text>
              </Pressable>
              <Pressable onPress={escolherFoto} style={estilos.botaoSecundario}>
                <MaterialIcons
                  name="photo-library"
                  size={20}
                  color={colors.textMuted}
                />
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Galeria
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View
            style={{
              width: "100%",
              aspectRatio: 4 / 3,
              borderRadius: 8,
              overflow: "hidden",
              backgroundColor: colors.surfaceHighlight,
            }}
          >
            <Image
              source={{ uri: imagem }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={180}
            />

            <View
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Pressable
                onPress={escolherFoto}
                disabled={enviando}
                accessibilityLabel="Trocar foto"
                style={estilos.acaoImagem}
              >
                <MaterialIcons name="sync" size={21} color="white" />
              </Pressable>
              <Pressable
                onPress={removerImagem}
                disabled={enviando}
                accessibilityLabel="Remover foto"
                style={{
                  ...estilos.acaoImagem,
                  backgroundColor: "rgba(127,29,45,0.94)",
                }}
              >
                <MaterialIcons name="delete-outline" size={22} color="white" />
              </Pressable>
            </View>

            <View
              style={{
                position: "absolute",
                left: 10,
                bottom: 10,
                backgroundColor: "rgba(15,17,21,0.86)",
                borderRadius: 6,
                paddingVertical: 7,
                paddingHorizontal: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MaterialIcons name="check-circle" size={17} color="#65D391" />
              <Text style={{ color: "white", fontWeight: "bold", fontSize: 12 }}>
                Foto anexada
              </Text>
            </View>
          </View>
        )}

        <View style={{ gap: 8 }}>
          <ItemChecklist colors={colors} texto="Imagem nítida e bem iluminada" />
          <ItemChecklist colors={colors} texto="Produto, preço ou execução visível" />
          <ItemChecklist colors={colors} texto="Enquadramento suficiente para conferência" />
        </View>
      </View>

      {imagem || fotosVisita.length > 0 ? (
        <>
          <View style={{ gap: 12 }}>
            <TituloSecao colors={colors} numero="2" titulo="Categoria e observação" />

            {carregandoCategorias ? <ActivityIndicator color={colors.primary} /> : null}
            {erroCategorias ? (
              <View style={{ gap: 8 }}>
                <Text accessibilityRole="alert" style={{ color: colors.danger }}>{erroCategorias}</Text>
                <Pressable onPress={recarregarCategorias} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text style={{ color: colors.primary }}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
            {!carregandoCategorias && !erroCategorias && !categoriasAtivas.length ? (
              <Text style={{ color: colors.warning }}>Nenhuma categoria ativa. Entre em contato com o administrador.</Text>
            ) : null}
            {!carregandoCategorias && !erroCategorias && ((categoria && !categoriaEstaAtiva(categoria, categorias)) || fotosVisita.some((foto) => !categoriaEstaAtiva(foto.categoria, categorias))) ? (
              <Text accessibilityRole="alert" style={{ color: colors.warning }}>Uma categoria selecionada foi desativada. Escolha outra categoria ou remova a foto da visita.</Text>
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {categoriasAtivas.map((item) => {
                const selecionada = categoria === item.valor;

                return (
                  <Pressable
                    key={item.valor}
                    onPress={() => selecionarCategoria(item.valor)}
                    disabled={enviando}
                    style={{
                      width: "47%",
                      minHeight: 78,
                      flexGrow: 1,
                      maxWidth: "49%",
                      borderWidth: 1,
                      borderColor: selecionada ? colors.primary : colors.border,
                      borderRadius: 8,
                      backgroundColor: selecionada
                        ? colors.primarySurface
                        : colors.surface,
                      padding: 12,
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name={item.icone}
                      size={23}
                      color={selecionada ? colors.primary : colors.iconMuted}
                    />
                    <Text
                      style={{
                        color: selecionada ? colors.primary : colors.textMuted,
                        fontWeight: "bold",
                        lineHeight: 18,
                      }}
                    >
                      {item.nome}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!categoria ? (
              <Text style={{ color: colors.warning, fontSize: 13 }}>
                Selecione a categoria correspondente à foto.
              </Text>
            ) : null}

            <View style={{ gap: 8, paddingTop: 5 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: "bold" }}>
                  Observação
                </Text>
                <Text
                  style={{
                    color: colors.textSubtle,
                    fontSize: 12,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  Opcional · {observacao.length}/{LIMITE_OBSERVACAO}
                </Text>
              </View>
              <TextInput
                placeholder="Ex.: produto em falta, preço divergente..."
                placeholderTextColor={colors.placeholder}
                value={observacao}
                onChangeText={setObservacao}
                editable={!enviando}
                maxLength={LIMITE_OBSERVACAO}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 112,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 13,
                  backgroundColor: colors.surface,
                  color: colors.text,
                  lineHeight: 20,
                }}
              />
            </View>

            {tipoOcorrencia ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  backgroundColor: colors.surface,
                  padding: 13,
                  gap: 13,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "bold" }}>
                    {tipoOcorrencia === "avaria"
                      ? "Produtos para avaria / devolucao"
                      : "Produtos do relatorio de estoque"}
                  </Text>
                  <Text style={{ color: colors.textSubtle, lineHeight: 19 }}>
                    Adicione um ou mais produtos. Esses dados vao aparecer no
                    painel em estoque e devolucoes.
                  </Text>
                </View>

                <TextInput
                  value={buscaProduto}
                  onChangeText={setBuscaProduto}
                  placeholder="Buscar produto cadastrado"
                  placeholderTextColor={colors.placeholder}
                  editable={!enviando}
                  style={{
                    minHeight: 44,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    color: colors.text,
                    backgroundColor: colors.backgroundAlt,
                  }}
                />

                <View style={{ gap: 8 }}>
                  {produtosFiltrados.map((produto) => {
                    const indiceSelecionado = indiceItemOcorrencia(produto.id);
                    const selecionado = indiceSelecionado >= 0;
                    const itemSelecionado = itensOcorrencia[indiceSelecionado];

                    return (
                      <View key={produto.id} style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => alternarProdutoOcorrencia(produto)}
                          disabled={enviando}
                          style={{
                            minHeight: 50,
                            borderWidth: 1,
                            borderColor: selecionado
                              ? colors.primary
                              : colors.border,
                            borderRadius: 8,
                            backgroundColor: selecionado
                              ? colors.primarySurface
                              : colors.backgroundAlt,
                            paddingHorizontal: 11,
                            paddingVertical: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <MaterialIcons
                            name={selecionado ? "check-circle" : "inventory-2"}
                            size={21}
                            color={selecionado ? colors.primary : colors.iconMuted}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.text,
                                fontWeight: "bold",
                              }}
                            >
                              {produto.codigo ? `${produto.codigo} - ` : ""}
                              {produto.nome}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.textSubtle,
                                fontSize: 12,
                                paddingTop: 2,
                              }}
                            >
                              {produto.marca || "Produto cadastrado"}
                            </Text>
                          </View>
                          <MaterialIcons
                            name={selecionado ? "expand-less" : "add"}
                            size={22}
                            color={selecionado ? colors.primary : colors.iconMuted}
                          />
                        </Pressable>

                        {selecionado && itemSelecionado ? (
                          <View
                            style={{
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 8,
                              backgroundColor: colors.surfaceElevated,
                              padding: 11,
                              gap: 10,
                            }}
                          >
                            {tipoOcorrencia === "estoque" ? (
                              <>
                                <View style={{ flexDirection: "row", gap: 9 }}>
                                  <CampoNumero
                                    colors={colors}
                                    rotulo="Estoque loja"
                                    valor={itemSelecionado.estoqueLoja || ""}
                                    onChange={(valor) =>
                                      atualizarItemOcorrencia(
                                        indiceSelecionado,
                                        "estoqueLoja",
                                        valor,
                                      )
                                    }
                                  />
                                  <CampoNumero
                                    colors={colors}
                                    rotulo="Estoque disponivel"
                                    valor={
                                      itemSelecionado.estoqueDisponivel || ""
                                    }
                                    onChange={(valor) =>
                                      atualizarItemOcorrencia(
                                        indiceSelecionado,
                                        "estoqueDisponivel",
                                        valor,
                                      )
                                    }
                                  />
                                </View>

                                <Pressable
                                  onPress={() =>
                                    atualizarItemOcorrencia(
                                      indiceSelecionado,
                                      "ruptura",
                                      !itemSelecionado.ruptura,
                                    )
                                  }
                                  disabled={enviando}
                                  style={{
                                    minHeight: 44,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: itemSelecionado.ruptura
                                      ? colors.warning
                                      : colors.border,
                                    backgroundColor: itemSelecionado.ruptura
                                      ? colors.warningSurface
                                      : colors.backgroundAlt,
                                    paddingHorizontal: 11,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 9,
                                  }}
                                >
                                  <MaterialIcons
                                    name={
                                      itemSelecionado.ruptura
                                        ? "check-box"
                                        : "check-box-outline-blank"
                                    }
                                    size={22}
                                    color={
                                      itemSelecionado.ruptura
                                        ? colors.warning
                                        : colors.iconMuted
                                    }
                                  />
                                  <Text
                                    style={{
                                      color: itemSelecionado.ruptura
                                        ? colors.warningText
                                        : colors.textMuted,
                                      fontWeight: "bold",
                                    }}
                                  >
                                    Produto em ruptura/falta
                                  </Text>
                                </Pressable>

                                {itemSelecionado.ruptura ? (
                                  <CampoNumero
                                    colors={colors}
                                    rotulo="Quantidade em ruptura"
                                    valor={itemSelecionado.quantidadeRuptura || ""}
                                    onChange={(valor) =>
                                      atualizarItemOcorrencia(
                                        indiceSelecionado,
                                        "quantidadeRuptura",
                                        valor,
                                      )
                                    }
                                  />
                                ) : null}
                              </>
                            ) : (
                              <>
                                <CampoNumero
                                  colors={colors}
                                  rotulo="Quantidade avariada/devolvida"
                                  valor={itemSelecionado.quantidadeAvaria || ""}
                                  onChange={(valor) =>
                                    atualizarItemOcorrencia(
                                      indiceSelecionado,
                                      "quantidadeAvaria",
                                      valor,
                                    )
                                  }
                                />
                                <GrupoOpcoes
                                  colors={colors}
                                  titulo="Motivo"
                                  opcoes={MOTIVOS_AVARIA}
                                  valor={
                                    itemSelecionado.motivoAvaria ||
                                    MOTIVOS_AVARIA[0]
                                  }
                                  onChange={(valor) =>
                                    atualizarItemOcorrencia(
                                      indiceSelecionado,
                                      "motivoAvaria",
                                      valor,
                                    )
                                  }
                                />
                                <GrupoOpcoes
                                  colors={colors}
                                  titulo="Destino"
                                  opcoes={DESTINOS_AVARIA}
                                  valor={
                                    itemSelecionado.destinoAvaria ||
                                    DESTINOS_AVARIA[0]
                                  }
                                  onChange={(valor) =>
                                    atualizarItemOcorrencia(
                                      indiceSelecionado,
                                      "destinoAvaria",
                                      valor,
                                    )
                                  }
                                />
                              </>
                            )}

                            <TextInput
                              value={itemSelecionado.observacao || ""}
                              onChangeText={(valor) =>
                                atualizarItemOcorrencia(
                                  indiceSelecionado,
                                  "observacao",
                                  valor,
                                )
                              }
                              placeholder="Observacao deste produto"
                              placeholderTextColor={colors.placeholder}
                              editable={!enviando}
                              style={{
                                minHeight: 44,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                color: colors.text,
                                backgroundColor: colors.backgroundAlt,
                              }}
                            />

                            <Pressable
                              onPress={() =>
                                removerItemOcorrencia(indiceSelecionado)
                              }
                              disabled={enviando}
                              style={{
                                minHeight: 42,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: colors.danger,
                                backgroundColor: colors.dangerSurface,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                              }}
                            >
                              <MaterialIcons
                                name="close"
                                size={20}
                                color={colors.danger}
                              />
                              <Text
                                style={{
                                  color: colors.danger,
                                  fontWeight: "bold",
                                }}
                              >
                                Remover produto
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}

                  {produtos.length === 0 ? (
                    <Text style={{ color: colors.warning, lineHeight: 19 }}>
                      Nenhum produto ativo cadastrado. Cadastre produtos no
                      painel web antes de enviar este tipo de relatorio.
                    </Text>
                  ) : null}
                </View>

                {itensOcorrencia.length > 0 ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.primary,
                      borderRadius: 8,
                      backgroundColor: colors.primarySurface,
                      padding: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="playlist-add-check"
                      size={21}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.primary,
                        fontWeight: "bold",
                      }}
                    >
                      {itensOcorrencia.length} produto
                      {itensOcorrencia.length > 1 ? "s" : ""} selecionado
                      {itensOcorrencia.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.warning, fontSize: 13 }}>
                    Selecione pelo menos um produto para enviar esta categoria.
                  </Text>
                )}
              </View>
            ) : null}
          </View>

          <View style={{ gap: 12 }}>
            <TituloSecao colors={colors} numero="3" titulo="Fotos da visita" />

            {fotosVisita.length > 0 ? (
              <View style={{ gap: 9 }}>
                {fotosVisita.map((foto, indice) => (
                  <View
                    key={foto.id}
                    style={{
                      minHeight: 72,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      backgroundColor: colors.surface,
                      padding: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Image
                      source={{ uri: foto.imagem }}
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 7,
                        backgroundColor: colors.surfaceHighlight,
                      }}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "bold" }}>
                        Foto {indice + 1} - {foto.categoriaNome}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.textSubtle,
                          fontSize: 12,
                          paddingTop: 3,
                        }}
                      >
                        {foto.itensOcorrencia.length > 0
                          ? `${foto.itensOcorrencia.length} produto(s) informado(s)`
                          : foto.observacao || "Sem observacao"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removerFotoDaVisita(foto.id)}
                      disabled={enviando}
                      accessibilityLabel="Remover foto da visita"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 7,
                        backgroundColor: colors.dangerSurface,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons
                        name="close"
                        size={20}
                        color={colors.danger}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  backgroundColor: colors.surface,
                  padding: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <MaterialIcons
                  name="collections"
                  size={22}
                  color={colors.iconMuted}
                />
                <Text style={{ flex: 1, color: colors.textSubtle }}>
                  Esta sera a primeira foto da visita.
                </Text>
              </View>
            )}

            {!ehRefacao ? (
              <Pressable
                onPress={adicionarFotoNaVisita}
                disabled={!fotoAtualValida || enviando}
                style={{
                  minHeight: 48,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: fotoAtualValida
                    ? colors.primary
                    : colors.borderStrong,
                  backgroundColor: fotoAtualValida
                    ? colors.primarySurface
                    : colors.surfaceElevated,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: fotoAtualValida && !enviando ? 1 : 0.7,
                }}
              >
                <MaterialIcons
                  name="add-photo-alternate"
                  size={21}
                  color={fotoAtualValida ? colors.primary : colors.textSubtle}
                />
                <Text
                  style={{
                    color: fotoAtualValida ? colors.primary : colors.textSubtle,
                    fontWeight: "bold",
                  }}
                >
                  Adicionar esta foto a visita
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ gap: 12 }}>
            <TituloSecao colors={colors} numero="4" titulo="Revisão" />

            <View
              style={{
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            >
              <LinhaResumo
                colors={colors}
                icone="storefront"
                titulo="Loja"
                valor={lojaNome}
              />
              <LinhaResumo
                colors={colors}
                icone="category"
                titulo="Conteudo"
                valor={
                  fotosVisita.length > 0
                    ? `${fotosVisita.length + (fotoAtualValida ? 1 : 0)} foto(s) na visita`
                    : categoriaExibicao || "Não selecionada"
                }
                separador
                alerta={!formularioValido}
              />
              <LinhaResumo
                colors={colors}
                icone="notes"
                titulo="Observação"
                valor={
                  observacao.trim()
                    ? observacao.trim()
                    : "Nenhuma observação adicionada"
                }
                separador
              />
            </View>

            <Pressable
              onPress={enviarFoto}
              disabled={!formularioValido}
              style={{
                minHeight: 52,
                borderRadius: 8,
                backgroundColor: formularioValido ? colors.success : colors.borderStrong,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                paddingHorizontal: 16,
              }}
            >
              {enviando ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <MaterialIcons
                  name="cloud-upload"
                  size={22}
                  color={formularioValido ? colors.primaryText : colors.textSubtle}
                />
              )}
              <Text
                style={{
                  color: formularioValido ? colors.primaryText : colors.textSubtle,
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                {etapaEnvio === "preparando"
                  ? "Preparando imagem..."
                  : etapaEnvio === "enviando"
                    ? "Enviando visita..."
                    : "Enviar visita"}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <Modal
        visible={envioConcluido}
        transparent
        animationType="fade"
        onRequestClose={() => router.replace(ROTAS.promotor)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
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
              padding: 21,
              gap: 18,
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 8,
                backgroundColor: colors.successSurface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="check" size={31} color={colors.success} />
            </View>

            <View style={{ gap: 7 }}>
              <Text style={{ color: colors.text, fontSize: 21, fontWeight: "bold" }}>
                {ehRefacao
                  ? "Nova foto enviada para análise"
                  : "Visita enviada para análise"}
              </Text>
              <Text style={{ color: colors.textSubtle, lineHeight: 21 }}>
                {ehRefacao
                  ? "A versão anterior foi preservada no histórico e esta nova foto está pendente de avaliação."
                  : "O responsável poderá avaliar as fotos enviadas nessa visita."}
              </Text>
            </View>

            <View style={{ gap: 9 }}>
              <Pressable
                onPress={prepararNovoEnvio}
                style={{
                  minHeight: 48,
                  borderRadius: 7,
                  backgroundColor: colors.primary,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="add-a-photo" size={20} color={colors.primaryText} />
                <Text style={{ color: colors.primaryText, fontWeight: "bold" }}>
                  {ehRefacao
                    ? "Enviar outra foto para esta loja"
                    : "Registrar outra visita nesta loja"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace(ROTAS.promotor)}
                style={{
                  minHeight: 48,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceElevated,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="dashboard" size={20} color={colors.textMuted} />
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Voltar ao painel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function TituloSecao({
  colors,
  numero,
  titulo,
}: {
  colors: ThemeColors;
  numero: string;
  titulo: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.primaryText, fontWeight: "bold" }}>
          {numero}
        </Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}>
        {titulo}
      </Text>
    </View>
  );
}

function ItemChecklist({
  colors,
  texto,
}: {
  colors: ThemeColors;
  texto: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <MaterialIcons
        name="check-circle-outline"
        size={18}
        color={colors.success}
      />
      <Text style={{ flex: 1, color: colors.textSubtle, fontSize: 13 }}>
        {texto}
      </Text>
    </View>
  );
}

function LinhaResumo({
  colors,
  icone,
  titulo,
  valor,
  separador,
  alerta,
}: {
  colors: ThemeColors;
  icone: keyof typeof MaterialIcons.glyphMap;
  titulo: string;
  valor: string;
  separador?: boolean;
  alerta?: boolean;
}) {
  return (
    <View
      style={{
        minHeight: 64,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 11,
        borderTopWidth: separador ? 1 : 0,
        borderTopColor: colors.border,
      }}
    >
      <MaterialIcons
        name={icone}
        size={21}
        color={alerta ? colors.warning : colors.iconMuted}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{titulo}</Text>
        <Text
          style={{
            color: alerta ? colors.warning : colors.text,
            fontWeight: "bold",
            paddingTop: 3,
            lineHeight: 19,
          }}
        >
          {valor}
        </Text>
      </View>
    </View>
  );
}

function CampoNumero({
  colors,
  rotulo,
  valor,
  onChange,
}: {
  colors: ThemeColors;
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <View style={{ flex: 1, gap: 7 }}>
      <Text style={{ color: colors.textMuted, fontWeight: "bold", fontSize: 13 }}>
        {rotulo}
      </Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.placeholder}
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          color: colors.text,
          backgroundColor: colors.backgroundAlt,
        }}
      />
    </View>
  );
}

function GrupoOpcoes({
  colors,
  titulo,
  opcoes,
  valor,
  onChange,
}: {
  colors: ThemeColors;
  titulo: string;
  opcoes: string[];
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textMuted, fontWeight: "bold", fontSize: 13 }}>
        {titulo}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {opcoes.map((opcao) => {
          const ativo = valor === opcao;

          return (
            <Pressable
              key={opcao}
              onPress={() => onChange(opcao)}
              style={{
                minHeight: 38,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: ativo ? colors.primary : colors.border,
                backgroundColor: ativo
                  ? colors.primarySurface
                  : colors.backgroundAlt,
                paddingHorizontal: 11,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: ativo ? colors.primary : colors.textMuted,
                  fontWeight: ativo ? "bold" : "normal",
                }}
              >
                {opcao}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
    botaoPrimario: {
      flex: 1,
      minHeight: 46,
      borderRadius: 7,
      backgroundColor: colors.primary,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
    botaoSecundario: {
      flex: 1,
      minHeight: 46,
      borderRadius: 7,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
    acaoImagem: {
      width: 42,
      height: 42,
      borderRadius: 7,
      backgroundColor: "rgba(20,24,31,0.92)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
  };
}
