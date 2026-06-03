import { useState } from "react";
import {
    Alert,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

export default function EnviarFoto() {
  const { lojaId, lojaNome } = useLocalSearchParams();

  const [imagem, setImagem] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissao.granted) {
      Alert.alert("Permissão necessária", "Permita acesso à câmera.");
      return;
    }

    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsEditing: false,
    });

    if (!resultado.canceled) {
      setImagem(resultado.assets[0].uri);
    }
  }

  async function escolherFoto() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissao.granted) {
      Alert.alert("Permissão necessária", "Permita acesso às fotos.");
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsEditing: false,
    });

    if (!resultado.canceled) {
      setImagem(resultado.assets[0].uri);
    }
  }

  async function enviarFoto() {
    try {
      if (!imagem) {
        Alert.alert("Atenção", "Tire ou selecione uma foto primeiro.");
        return;
      }

      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        Alert.alert("Erro", "Usuário não encontrado.");
        return;
      }

      const imagemBase64 = await FileSystem.readAsStringAsync(imagem, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const imagemFormatada = `data:image/jpeg;base64,${imagemBase64}`;

      await addDoc(collection(db, "fotos"), {
        lojaId,
        lojaNome,
        promotorId: usuarioAtual.uid,
        promotorEmail: usuarioAtual.email,
        imagemBase64: imagemFormatada,
        observacao,
        criadoEm: new Date(),
      });

      Alert.alert("Sucesso", "Foto enviada com sucesso!");

      setImagem(null);
      setObservacao("");

      router.back();
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", error.message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#121212", padding: 20 }}>
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
          Tirar Foto com Câmera
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
        <Image
          source={{ uri: imagem }}
          style={{
            width: "100%",
            height: 250,
            borderRadius: 10,
            marginBottom: 15,
          }}
        />
      )}

      <TextInput
        placeholder="Observação"
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
        style={{
          backgroundColor: "#16A34A",
          padding: 15,
          borderRadius: 10,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          Enviar
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
    </View>
  );
}
