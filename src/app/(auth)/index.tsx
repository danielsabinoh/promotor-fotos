import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { ROTAS } from "@/constants/routes";
import { auth } from "@/services/firebaseConfig";
import { aceitarConvitePendente } from "@/services/gestao-acessos";
import { buscarUsuario } from "@/services/usuarios-service";
import { useTheme } from "@/theme/theme-context";

export default function Home() {
  const { colors } = useTheme();
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

      await aceitarConvitePendente();

      const usuarioSnap = await buscarUsuario(uid);

      if (!usuarioSnap.exists()) {
        await signOut(auth);
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
          router.replace(ROTAS.alterarSenha);
        } else if (usuario.tipo === "admin" || usuario.tipo === "super_admin") {
          router.replace(
            process.env.EXPO_OS === "web" ? ROTAS.painel : ROTAS.admin,
          );
        } else {
          router.replace(ROTAS.promotor);
        }
      } else {
        Alert.alert("Erro", "Tipo de usuário inválido.");
      }
    } catch (error: any) {
      await signOut(auth).catch(() => undefined);
      Alert.alert(
        "Erro",
        error?.code === "auth/user-disabled"
          ? "Este acesso esta desativado."
          : error.message,
      );
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
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 30,
          textAlign: "center",
          color: colors.text,
        }}
      >
        Promotor Fotos
      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.placeholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 12,
          marginBottom: 15,
          color: colors.text,
          backgroundColor: colors.surface,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          marginBottom: 20,
          paddingHorizontal: 12,
          backgroundColor: colors.surface,
        }}
      >
        <TextInput
          placeholder="Senha"
          placeholderTextColor={colors.placeholder}
          value={senha}
          onChangeText={setSenha}
          secureTextEntry={!mostrarSenha}
          style={{
            flex: 1,
            paddingVertical: 12,
            color: colors.text,
          }}
        />

        <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
          <Text
            style={{
              color: colors.info,
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
          backgroundColor: colors.primary,
          padding: 15,
          borderRadius: 8,
        }}
      >
        <Text
          style={{
            color: colors.primaryText,
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
            color: colors.info,
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
