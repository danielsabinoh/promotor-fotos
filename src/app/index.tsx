import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

export default function Home() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function fazerLogin() {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        senha,
      );

      const uid = userCredential.user.uid;

      const usuarioRef = doc(db, "usuarios", uid);
      const usuarioSnap = await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        Alert.alert(
          "Erro",
          "Usuário autenticado, mas não cadastrado no sistema.",
        );
        return;
      }

      const usuario = usuarioSnap.data();

      if (usuario.tipo === "admin") {
        router.replace("/admin" as any);
      } else if (usuario.tipo === "promotor") {
        router.replace("/promotor" as any);
      } else {
        Alert.alert("Erro", "Tipo de usuário inválido.");
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 20,
        backgroundColor: "#121212",
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 30,
          textAlign: "center",
          color: "white",
        }}
      >
        Promotor Fotos
      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
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
        placeholder="Senha"
        placeholderTextColor="#888"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: "#444",
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
          color: "white",
        }}
      />

      <TouchableOpacity
        onPress={fazerLogin}
        style={{
          backgroundColor: "#2563EB",
          padding: 15,
          borderRadius: 8,
        }}
      >
        <Text
          style={{
            color: "white",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Entrar
        </Text>
      </TouchableOpacity>
    </View>
  );
}
