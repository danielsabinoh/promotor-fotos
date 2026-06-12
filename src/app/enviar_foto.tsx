import { useState } from "react";
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
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

const categoriasFoto = [
  { valor: "Gondola", nome: "Gôndola", icone: "view-stream" as const },
  {
    valor: "Relatório de estoque",
    nome: "Relatório de estoque",
    icone: "inventory-2" as const,
  },
  { valor: "Ponta", nome: "Ponta", icone: "space-dashboard" as const },
  { valor: "Ilha", nome: "Ilha", icone: "grid-view" as const },
  {
    valor: "Ruptura",
    nome: "Ruptura",
    icone: "production-quantity-limits" as const,
  },
  { valor: "Preco", nome: "Preço", icone: "sell" as const },
  { valor: "Validade", nome: "Validade", icone: "event" as const },
  {
    valor: "Concorrente",
    nome: "Concorrente",
    icone: "compare-arrows" as const,
  },
  {
    valor: "Antes/depois",
    nome: "Antes/depois",
    icone: "compare" as const,
  },
];

const LIMITE_FIRESTORE_STRING = 900_000;
const LIMITE_OBSERVACAO = 300;

type EtapaEnvio = "preparando" | "enviando" | null;

async function prepararImagemBase64(uri: string) {
  const tentativas = [
    { width: 1000, compress: 0.45 },
    { width: 800, compress: 0.35 },
    { width: 640, compress: 0.28 },
  ];

  for (const tentativa of tentativas) {
    const resultado = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: tentativa.width } }],
      {
        base64: true,
        compress: tentativa.compress,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    const imagemBase64 = resultado.base64 || "";
    const imagemFormatada = `data:image/jpeg;base64,${imagemBase64}`;

    if (imagemFormatada.length <= LIMITE_FIRESTORE_STRING) {
      return imagemFormatada;
    }
  }

  throw new Error(
    "A foto ainda ficou muito grande. Tente tirar a foto mais longe ou com menos detalhes.",
  );
}

function primeiroParametro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default function EnviarFoto() {
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

  const enviando = etapaEnvio !== null;
  const formularioValido = !!imagem && !!categoria && !enviando;
  const categoriaExibicao =
    categoriasFoto.find((item) => item.valor === categoria)?.nome || categoria;

  function removerImagem() {
    if (enviando) return;
    setImagem(null);
    setCategoria(null);
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

  async function enviarFoto() {
    if (!formularioValido || !imagem || !categoria) return;

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
      const imagemBase64 = await prepararImagemBase64(imagem);
      const usuarioSnap = await getDoc(doc(db, "usuarios", usuarioAtual.uid));

      if (!usuarioSnap.exists() || usuarioSnap.data().ativo === false) {
        await signOut(auth);
        Alert.alert(
          "Acesso removido",
          "Seu cadastro não está mais ativo no sistema.",
        );
        router.replace("/");
        return;
      }

      const promotorNome =
        usuarioSnap.data()?.nome ||
        usuarioAtual.displayName ||
        usuarioAtual.email;

      setEtapaEnvio("enviando");
      await addDoc(collection(db, "fotos"), {
        lojaId,
        lojaNome,
        promotorId: usuarioAtual.uid,
        promotorNome,
        promotorEmail: usuarioAtual.email,
        imagemBase64,
        categoria,
        status: "pendente",
        comentarioAdmin: "",
        observacao: observacao.trim(),
        criadoEm: serverTimestamp(),
        naLixeira: false,
        refacaoDeId: refacaoDeId || null,
        numeroRefacao: ehRefacao ? numeroRefacao : 0,
        motivoRefacao: ehRefacao ? motivoRefacao : "",
      });

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
    setImagem(null);
    setCategoria(ehRefacao ? categoriaInicial || null : null);
    setObservacao("");
    setEnvioConcluido(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0F1115" }}
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
          style={estiloBotaoIcone}
        >
          <MaterialIcons name="arrow-back" size={23} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "white", fontSize: 27, fontWeight: "bold" }}>
            {ehRefacao ? "Refazer foto" : "Enviar foto"}
          </Text>
          <Text style={{ color: "#8E9AAF", paddingTop: 3 }}>
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
          borderColor: "#2B3039",
          borderRadius: 8,
          paddingHorizontal: 13,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          backgroundColor: "#191C22",
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 7,
            backgroundColor: "#253759",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="storefront" size={22} color="#8CB1FA" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#8792A4", fontSize: 12 }}>Loja do envio</Text>
          <Text
            numberOfLines={2}
            style={{ color: "white", fontWeight: "bold", paddingTop: 2 }}
          >
            {lojaNome}
          </Text>
        </View>
      </View>

      {ehRefacao ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: "#71551B",
            borderRadius: 8,
            padding: 14,
            backgroundColor: "#3D2D10",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 11,
          }}
        >
          <MaterialIcons name="rate-review" size={24} color="#F4B740" />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: "#FCE6A9", fontWeight: "bold" }}>
              Correção solicitada pelo responsável
            </Text>
            <Text style={{ color: "#D7C99F", lineHeight: 20 }}>
              {motivoRefacao ||
                "Confira a execução e envie uma nova foto para análise."}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 11 }}>
        <TituloSecao numero="1" titulo="Foto" />

        {!imagem ? (
          <View
            style={{
              minHeight: 236,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "#465064",
              borderRadius: 8,
              backgroundColor: "#171A20",
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
                backgroundColor: "#24344F",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="add-a-photo" size={30} color="#8CB1FA" />
            </View>

            <View style={{ alignItems: "center", gap: 5 }}>
              <Text style={{ color: "white", fontSize: 17, fontWeight: "bold" }}>
                Adicione a foto da execução
              </Text>
              <Text style={{ color: "#8994A6", textAlign: "center" }}>
                Use a câmera ou escolha uma imagem já salva.
              </Text>
            </View>

            <View style={{ width: "100%", flexDirection: "row", gap: 9 }}>
              <Pressable onPress={tirarFoto} style={estiloBotaoPrimario}>
                <MaterialIcons name="photo-camera" size={20} color="white" />
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Câmera
                </Text>
              </Pressable>
              <Pressable onPress={escolherFoto} style={estiloBotaoSecundario}>
                <MaterialIcons
                  name="photo-library"
                  size={20}
                  color="#B9CAEF"
                />
                <Text style={{ color: "#DFE7F7", fontWeight: "bold" }}>
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
              backgroundColor: "#252A33",
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
                style={estiloAcaoImagem}
              >
                <MaterialIcons name="sync" size={21} color="white" />
              </Pressable>
              <Pressable
                onPress={removerImagem}
                disabled={enviando}
                accessibilityLabel="Remover foto"
                style={{
                  ...estiloAcaoImagem,
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
          <ItemChecklist texto="Imagem nítida e bem iluminada" />
          <ItemChecklist texto="Produto, preço ou execução visível" />
          <ItemChecklist texto="Enquadramento suficiente para conferência" />
        </View>
      </View>

      {imagem ? (
        <>
          <View style={{ gap: 12 }}>
            <TituloSecao numero="2" titulo="Categoria e observação" />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {categoriasFoto.map((item) => {
                const selecionada = categoria === item.valor;

                return (
                  <Pressable
                    key={item.valor}
                    onPress={() => setCategoria(item.valor)}
                    disabled={enviando}
                    style={{
                      width: "47%",
                      minHeight: 78,
                      flexGrow: 1,
                      maxWidth: "49%",
                      borderWidth: 1,
                      borderColor: selecionada ? "#5E8FF2" : "#303640",
                      borderRadius: 8,
                      backgroundColor: selecionada ? "#234D9C" : "#191C22",
                      padding: 12,
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name={item.icone}
                      size={23}
                      color={selecionada ? "#DCE8FF" : "#8996AB"}
                    />
                    <Text
                      style={{
                        color: selecionada ? "white" : "#C3CAD5",
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
              <Text style={{ color: "#F4B740", fontSize: 13 }}>
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
                <Text style={{ color: "#D7DDE6", fontWeight: "bold" }}>
                  Observação
                </Text>
                <Text
                  style={{
                    color: "#747F91",
                    fontSize: 12,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  Opcional · {observacao.length}/{LIMITE_OBSERVACAO}
                </Text>
              </View>
              <TextInput
                placeholder="Ex.: produto em falta, preço divergente..."
                placeholderTextColor="#687386"
                value={observacao}
                onChangeText={setObservacao}
                editable={!enviando}
                maxLength={LIMITE_OBSERVACAO}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 112,
                  borderWidth: 1,
                  borderColor: "#353C47",
                  borderRadius: 8,
                  padding: 13,
                  backgroundColor: "#171A20",
                  color: "white",
                  lineHeight: 20,
                }}
              />
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <TituloSecao numero="3" titulo="Revisão" />

            <View
              style={{
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#2B3039",
              }}
            >
              <LinhaResumo
                icone="storefront"
                titulo="Loja"
                valor={lojaNome}
              />
              <LinhaResumo
                icone="category"
                titulo="Categoria"
                valor={categoriaExibicao || "Não selecionada"}
                separador
                alerta={!categoria}
              />
              <LinhaResumo
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
                backgroundColor: formularioValido ? "#23864B" : "#30353E",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                paddingHorizontal: 16,
              }}
            >
              {enviando ? (
                <ActivityIndicator color="white" />
              ) : (
                <MaterialIcons
                  name="cloud-upload"
                  size={22}
                  color={formularioValido ? "white" : "#737D8C"}
                />
              )}
              <Text
                style={{
                  color: formularioValido ? "white" : "#7F8998",
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                {etapaEnvio === "preparando"
                  ? "Preparando imagem..."
                  : etapaEnvio === "enviando"
                    ? "Enviando foto..."
                    : "Enviar foto"}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <Modal
        visible={envioConcluido}
        transparent
        animationType="fade"
        onRequestClose={() => router.replace("/promotor" as any)}
      >
        <View
          style={{
            flex: 1,
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
              padding: 21,
              gap: 18,
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 8,
                backgroundColor: "#153C28",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="check" size={31} color="#6EE7A8" />
            </View>

            <View style={{ gap: 7 }}>
              <Text style={{ color: "white", fontSize: 21, fontWeight: "bold" }}>
                {ehRefacao
                  ? "Nova foto enviada para análise"
                  : "Foto enviada para análise"}
              </Text>
              <Text style={{ color: "#AAB3C1", lineHeight: 21 }}>
                {ehRefacao
                  ? "A versão anterior foi preservada no histórico e esta nova foto está pendente de avaliação."
                  : "O responsável poderá aprovar, rejeitar ou solicitar uma nova foto."}
              </Text>
            </View>

            <View style={{ gap: 9 }}>
              <Pressable
                onPress={prepararNovoEnvio}
                style={{
                  minHeight: 48,
                  borderRadius: 7,
                  backgroundColor: "#2F6FED",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="add-a-photo" size={20} color="white" />
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {ehRefacao
                    ? "Enviar outra foto para esta loja"
                    : "Enviar outra para esta loja"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace("/promotor" as any)}
                style={{
                  minHeight: 48,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: "#3B424E",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="dashboard" size={20} color="#C4CDDA" />
                <Text style={{ color: "#E0E5EC", fontWeight: "bold" }}>
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

function TituloSecao({ numero, titulo }: { numero: string; titulo: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: "#2F6FED",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>{numero}</Text>
      </View>
      <Text style={{ color: "#F1F4F8", fontSize: 18, fontWeight: "bold" }}>
        {titulo}
      </Text>
    </View>
  );
}

function ItemChecklist({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <MaterialIcons name="check-circle-outline" size={18} color="#65D391" />
      <Text style={{ flex: 1, color: "#9DA7B6", fontSize: 13 }}>{texto}</Text>
    </View>
  );
}

function LinhaResumo({
  icone,
  titulo,
  valor,
  separador,
  alerta,
}: {
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
        borderTopColor: "#2B3039",
      }}
    >
      <MaterialIcons
        name={icone}
        size={21}
        color={alerta ? "#F4B740" : "#8090A8"}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#7F899A", fontSize: 12 }}>{titulo}</Text>
        <Text
          style={{
            color: alerta ? "#F4B740" : "#E3E7ED",
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

const estiloBotaoPrimario = {
  flex: 1,
  minHeight: 46,
  borderRadius: 7,
  backgroundColor: "#2F6FED",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
};

const estiloBotaoSecundario = {
  flex: 1,
  minHeight: 46,
  borderRadius: 7,
  backgroundColor: "#252B35",
  borderWidth: 1,
  borderColor: "#3A4352",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
};

const estiloAcaoImagem = {
  width: 42,
  height: 42,
  borderRadius: 7,
  backgroundColor: "rgba(20,24,31,0.92)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
