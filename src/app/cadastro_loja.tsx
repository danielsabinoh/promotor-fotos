import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

export default function CadastroLoja() {
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  async function salvarLoja() {
    try {
      await addDoc(collection(db, "lojas"), {
        nome,
        cidade,
        estado,
        criadoEm: new Date(),
      });

      Alert.alert("Sucesso", "Loja cadastrada com sucesso!");

      setNome("");
      setCidade("");
      setEstado("");
    } catch (error) {
      console.log(error);

      Alert.alert("Erro", "Não foi possível cadastrar a loja.");
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#121212",
        padding: 20,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "bold",
          marginTop: 60,
          marginBottom: 30,
        }}
      >
        Cadastro de Loja
      </Text>

      <TextInput
        placeholder="Nome da Loja"
        placeholderTextColor="#888"
        value={nome}
        onChangeText={setNome}
        style={{
          borderWidth: 1,
          borderColor: "#444",
          borderRadius: 8,
          padding: 12,
          marginBottom: 15,
          color: "white",
        }}
      />

      <TextInput
        placeholder="Cidade"
        placeholderTextColor="#888"
        value={cidade}
        onChangeText={setCidade}
        style={{
          borderWidth: 1,
          borderColor: "#444",
          borderRadius: 8,
          padding: 12,
          marginBottom: 15,
          color: "white",
        }}
      />

      <TextInput
        placeholder="Estado"
        placeholderTextColor="#888"
        value={estado}
        onChangeText={setEstado}
        style={{
          borderWidth: 1,
          borderColor: "#444",
          borderRadius: 8,
          padding: 12,
          marginBottom: 25,
          color: "white",
        }}
      />

      <TouchableOpacity
        onPress={salvarLoja}
        style={{
          backgroundColor: "#2563EB",
          padding: 15,
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
          Salvar Loja
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
          style={{
            color: "white",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Voltar
        </Text>
      </TouchableOpacity>
    </View>
  );
}
