import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

export default function AlterarSenha() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  async function salvarNovaSenha() {
    try {
      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        Alert.alert("Erro", "Usuário não encontrado.");
        return;
      }

      if (novaSenha.length < 6) {
        Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      if (novaSenha !== confirmarSenha) {
        Alert.alert("Atenção", "As senhas não coincidem.");
        return;
      }

      await updatePassword(usuarioAtual, novaSenha);

      await updateDoc(doc(db, "usuarios", usuarioAtual.uid), {
        primeiroAcesso: false,
      });

      Alert.alert("Sucesso", "Senha alterada com sucesso!");

      router.replace("/promotor" as any);
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", error.message);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#121212",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        Primeiro Acesso
      </Text>

      <Text
        style={{
          color: "#aaa",
          textAlign: "center",
          marginBottom: 30,
        }}
      >
        Crie uma nova senha para continuar.
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#444",
          borderRadius: 8,
          marginBottom: 15,
          paddingHorizontal: 12,
        }}
      >
        <TextInput
          placeholder="Nova senha"
          placeholderTextColor="#888"
          value={novaSenha}
          onChangeText={setNovaSenha}
          secureTextEntry={!mostrarSenha}
          style={{
            flex: 1,
            paddingVertical: 12,
            color: "white",
          }}
        />

        <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
          <Text
            style={{
              color: "#60A5FA",
              fontSize: 18,
            }}
          >
            {mostrarSenha ? "🙈" : "👁️"}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#444",
          borderRadius: 8,
          marginBottom: 20,
          paddingHorizontal: 12,
        }}
      >
        <TextInput
          placeholder="Confirmar senha"
          placeholderTextColor="#888"
          value={confirmarSenha}
          onChangeText={setConfirmarSenha}
          secureTextEntry={!mostrarConfirmacao}
          style={{
            flex: 1,
            paddingVertical: 12,
            color: "white",
          }}
        />

        <TouchableOpacity
          onPress={() => setMostrarConfirmacao(!mostrarConfirmacao)}
        >
          <Text
            style={{
              color: "#60A5FA",
              fontSize: 18,
            }}
          >
            {mostrarConfirmacao ? "🙈" : "👁️"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={salvarNovaSenha}
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
          Salvar Nova Senha
        </Text>
      </TouchableOpacity>
    </View>
  );
}
