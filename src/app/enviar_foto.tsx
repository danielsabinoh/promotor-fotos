import { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

const categoriasFoto = [
  "Gondola",
  "Relatório de estoque",
  "Ponta",
  "Ilha",
  "Ruptura",
  "Preco",
  "Validade",
  "Concorrente",
  "Antes/depois",
];

const LIMITE_FIRESTORE_STRING = 900_000;

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

  throw new Error("A foto ainda ficou muito grande. Tente tirar a foto mais longe ou com menos detalhes.");
}

export default function EnviarFoto() {
  const { lojaId, lojaNome } = useLocalSearchParams();

  const [imagem, setImagem] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [categoria, setCategoria] = useState(categoriasFoto[0]);
  const [enviando, setEnviando] = useState(false);

  function removerImagem() {
    setImagem(null);
    setCategoria(categoriasFoto[0]);
  }

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissao.granted) {
      Alert.alert("Permissao necessaria", "Permita acesso a camera.");
      return;
    }

    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: false,
    });

    if (!resultado.canceled) {
      setImagem(resultado.assets[0].uri);
    }
  }

  async function escolherFoto() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: false,
    });

    if (!resultado.canceled) {
      setImagem(resultado.assets[0].uri);
    }
  }

  async function enviarFoto() {
    if (enviando) return;

    try {
      if (!imagem) {
        Alert.alert("Atencao", "Tire ou selecione uma foto primeiro.");
        return;
      }

      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        Alert.alert("Erro", "Usuario nao encontrado.");
        return;
      }

      setEnviando(true);

      const imagemBase64 = await prepararImagemBase64(imagem);
      const usuarioSnap = await getDoc(doc(db, "usuarios", usuarioAtual.uid));
      const promotorNome =
        usuarioSnap.data()?.nome || usuarioAtual.displayName || usuarioAtual.email;

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
        observacao,
        criadoEm: serverTimestamp(),
      });

      Alert.alert("Sucesso", "Foto enviada com sucesso!");

      setImagem(null);
      setObservacao("");
      setCategoria(categoriasFoto[0]);

      router.back();
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", error.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#121212" }}
      contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "bold",
          marginTop: 60,
          marginBottom: 10,
        }}
      >
        Enviar Foto
      </Text>

      <Text style={{ color: "#aaa", marginBottom: 25 }}>Loja: {lojaNome}</Text>

      <TouchableOpacity
        onPress={tirarFoto}
        style={{
          backgroundColor: "#2563EB",
          padding: 15,
          borderRadius: 10,
          marginBottom: 10,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          Tirar Foto com Camera
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={escolherFoto}
        style={{
          backgroundColor: "#9333EA",
          padding: 15,
          borderRadius: 10,
          marginBottom: 15,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          Selecionar da Galeria
        </Text>
      </TouchableOpacity>

      {imagem && (
        <View
          style={{
            width: "100%",
            height: 250,
            marginBottom: 15,
            position: "relative",
          }}
        >
          <Image
            source={{ uri: imagem }}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 10,
            }}
            resizeMode="cover"
          />

          <TouchableOpacity
            onPress={removerImagem}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(0,0,0,0.75)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>
              X
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {imagem && (
        <View style={{ marginBottom: 15 }}>
          <Text
            style={{
              color: "white",
              fontSize: 16,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            Categoria da foto
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44 }}
            contentContainerStyle={{
              alignItems: "center",
              gap: 8,
            }}
          >
            {categoriasFoto.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setCategoria(item)}
                style={{
                  backgroundColor: categoria === item ? "#2563EB" : "#1E1E1E",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 18,
                  minHeight: 36,
                  justifyContent: "center",
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <TextInput
        placeholder="Observacao"
        placeholderTextColor="#888"
        value={observacao}
        onChangeText={setObservacao}
        style={{
          borderWidth: 1,
          borderColor: "#444",
          borderRadius: 8,
          padding: 12,
          marginBottom: 15,
          color: "white",
        }}
      />

      <TouchableOpacity
        onPress={enviarFoto}
        disabled={enviando}
        style={{
          backgroundColor: enviando ? "#64748B" : "#16A34A",
          padding: 15,
          borderRadius: 10,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          {enviando ? "Enviando..." : "Enviar"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          backgroundColor: "#444",
          padding: 15,
          borderRadius: 10,
          marginTop: 10,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          Voltar
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
