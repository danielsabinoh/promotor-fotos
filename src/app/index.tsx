import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

export default function Home() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

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

      if (usuario.ativo === false) {
        await signOut(auth);
        Alert.alert(
          "Acesso desativado",
          "Seu acesso foi desativado por um administrador.",
        );
        return;
      }

      if (
        usuario.tipo === "admin" ||
        usuario.tipo === "super_admin" ||
        usuario.tipo === "promotor"
      ) {
        if (usuario.primeiroAcesso === true) {
          router.replace("/alterar_senha" as any);
        } else if (
          usuario.tipo === "admin" ||
          usuario.tipo === "super_admin"
        ) {
          router.replace("/admin" as any);
        } else {
          router.replace("/promotor" as any);
        }
      } else {
        Alert.alert("Erro", "Tipo de usuário inválido.");
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    }
  }

  async function esqueciSenha() {
    try {
      if (!email) {
        Alert.alert("Atenção", "Digite seu email primeiro.");
        return;
      }

      await sendPasswordResetEmail(auth, email);

      Alert.alert(
        "Email enviado",
        "Verifique sua caixa de entrada para redefinir sua senha.",
      );
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
          placeholder="Senha"
          placeholderTextColor="#888"
          value={senha}
          onChangeText={setSenha}
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

      <TouchableOpacity
        onPress={esqueciSenha}
        style={{
          marginTop: 15,
        }}
      >
        <Text
          style={{
            color: "#60A5FA",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Esqueci minha senha
        </Text>
      </TouchableOpacity>
    </View>
  );
}
