import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { criarUsuarioAuth } from "../services/criarUsuarioAuth";
import { auth, db } from "../services/firebaseConfig";

export default function CadastroAdmin() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    async function validarAcesso() {
      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        router.replace("/");
        return;
      }

      const usuarioSnap = await getDoc(doc(db, "usuarios", usuarioAtual.uid));

      if (usuarioSnap.data()?.tipo !== "super_admin") {
        Alert.alert("Acesso negado", "Somente o administrador principal pode cadastrar admins.");
        router.replace("/admin");
        return;
      }

      setAutorizado(true);
    }

    validarAcesso().catch((error) => {
      console.log(error);
      Alert.alert("Erro", "Nao foi possivel validar seu acesso.");
      router.replace("/admin");
    });
  }, []);

  async function salvarAdmin() {
    if (salvando) return;

    if (!nome.trim() || !email.trim() || !senha) {
      Alert.alert("Atencao", "Preencha nome, email e senha.");
      return;
    }

    if (senha.length < 6) {
      Alert.alert("Atencao", "A senha provisoria deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      setSalvando(true);
      const uid = await criarUsuarioAuth(email, senha);

      await setDoc(doc(db, "usuarios", uid), {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        tipo: "admin",
        ativo: true,
        primeiroAcesso: true,
        criadoEm: serverTimestamp(),
      });

      Alert.alert("Sucesso", "Administrador cadastrado com sucesso.");
      router.back();
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", error.message || "Nao foi possivel cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!autorizado) {
    return <View style={{ flex: 1, backgroundColor: "#121212" }} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#121212" }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 30, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Voltar"
        style={{
          width: 42,
          height: 42,
          borderRadius: 8,
          backgroundColor: "#242424",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </Pressable>

      <Text style={{ color: "white", fontSize: 28, fontWeight: "bold" }}>
        Novo Administrador
      </Text>

      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome completo"
        placeholderTextColor="#777"
        style={input}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#777"
        autoCapitalize="none"
        keyboardType="email-address"
        style={input}
      />
      <TextInput
        value={senha}
        onChangeText={setSenha}
        placeholder="Senha provisoria"
        placeholderTextColor="#777"
        secureTextEntry
        style={input}
      />

      <Pressable
        onPress={salvarAdmin}
        disabled={salvando}
        style={{
          backgroundColor: salvando ? "#475569" : "#2563EB",
          borderRadius: 8,
          padding: 15,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>
          {salvando ? "Cadastrando..." : "Cadastrar administrador"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const input = {
  borderWidth: 1,
  borderColor: "#444",
  borderRadius: 8,
  padding: 13,
  color: "white",
};
