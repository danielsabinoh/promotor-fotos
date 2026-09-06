import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
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

// Painel lateral "marketing" mantém visual escuro fixo em ambos os temas,
// pra preservar o contraste do branding. Apenas o lado do formulário responde.
const LATERAL_BG = "#172033";
const LATERAL_TEXTO = "#FFFFFF";
const LATERAL_TEXTO_MUTED = "#AEBBD0";
const LATERAL_TEXTO_SUBTLE = "#7F90AA";
const LATERAL_ICONE = "#79A2FF";

export default function LoginWeb() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const { width } = useWindowDimensions();
  const compacto = width < 860;

  async function entrar() {
    if (!email.trim() || !senha) {
      setMensagem("Preencha email e senha.");
      return;
    }

    try {
      setCarregando(true);
      setMensagem("");
      const credencial = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        senha,
      );
      await aceitarConvitePendente();
      const perfilSnap = await buscarUsuario(credencial.user.uid);

      if (!perfilSnap.exists() || perfilSnap.data().ativo === false) {
        await signOut(auth);
        setMensagem("Este acesso nao esta ativo no sistema.");
        return;
      }

      const perfil = perfilSnap.data();

      if (perfil.primeiroAcesso === true) {
        router.replace(ROTAS.alterarSenha);
      } else if (perfil.tipo === "admin" || perfil.tipo === "super_admin") {
        router.replace(ROTAS.painel);
      } else if (perfil.tipo === "promotor") {
        router.replace(ROTAS.promotor);
      } else {
        await signOut(auth);
        setMensagem("Tipo de usuario invalido.");
      }
    } catch (error: any) {
      console.log(error);
      await signOut(auth).catch(() => undefined);
      setMensagem(
        error?.code === "auth/user-disabled"
          ? "Este acesso esta desativado."
          : error?.code === "auth/invalid-credential"
          ? "Email ou senha incorretos."
          : error?.message || "Nao foi possivel entrar. Tente novamente.",
      );
    } finally {
      setCarregando(false);
    }
  }

  async function recuperarSenha() {
    if (!email.trim()) {
      setMensagem("Digite seu email para recuperar a senha.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMensagem("Enviamos as instrucoes de recuperacao para seu email.");
    } catch (error) {
      console.log(error);
      setMensagem("Nao foi possivel enviar o email de recuperacao.");
    }
  }

  const campoContainer = {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 9,
  };

  const campo = {
    flex: 1,
    color: colors.text,
    paddingVertical: 13,
  };

  return (
    <View
      style={{
        flex: 1,
        minHeight: 620,
        flexDirection: compacto ? "column" : "row",
        backgroundColor: colors.background,
      }}
    >
      {!compacto ? (
        <View
          style={{
            flex: 1.05,
            backgroundColor: LATERAL_BG,
            padding: 64,
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="photo-camera" size={24} color="white" />
            </View>
            <Text
              style={{ color: LATERAL_TEXTO, fontSize: 20, fontWeight: "bold" }}
            >
              Promotor Fotos
            </Text>
          </View>

          <View style={{ maxWidth: 560 }}>
            <Text
              style={{
                color: LATERAL_TEXTO,
                fontSize: 42,
                fontWeight: "bold",
                lineHeight: 50,
              }}
            >
              A operacao das lojas em um unico lugar.
            </Text>
            <Text
              style={{
                color: LATERAL_TEXTO_MUTED,
                fontSize: 17,
                lineHeight: 27,
                paddingTop: 18,
                maxWidth: 500,
              }}
            >
              Acompanhe fotos, promotores, lojas e avaliacoes com uma visao
              organizada para a equipe de gestao.
            </Text>

            <View style={{ flexDirection: "row", gap: 28, paddingTop: 34 }}>
              {[
                ["photo-library", "Fotos organizadas"],
                ["groups", "Equipe centralizada"],
                ["assessment", "Indicadores claros"],
              ].map(([icone, texto]) => (
                <View
                  key={texto}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <MaterialIcons
                    name={icone as keyof typeof MaterialIcons.glyphMap}
                    size={20}
                    color={LATERAL_ICONE}
                  />
                  <Text style={{ color: LATERAL_TEXTO_MUTED }}>{texto}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={{ color: LATERAL_TEXTO_SUBTLE, fontSize: 12 }}>
            Painel administrativo
          </Text>
        </View>
      ) : null}

      <View
        style={{
          flex: 0.95,
          alignItems: "center",
          justifyContent: "center",
          padding: compacto ? 24 : 56,
        }}
      >
        <View style={{ width: "100%", maxWidth: 430 }}>
          {compacto ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingBottom: 34,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="photo-camera" size={22} color="white" />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 19,
                  fontWeight: "bold",
                }}
              >
                Promotor Fotos
              </Text>
            </View>
          ) : null}

          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "bold" }}>
            Acesse sua conta
          </Text>
          <Text
            style={{ color: colors.textSubtle, fontSize: 15, paddingTop: 8 }}
          >
            Entre com as credenciais cadastradas no sistema.
          </Text>

          <View style={{ gap: 9, paddingTop: 30 }}>
            <Text style={{ color: colors.textMuted, fontWeight: "bold" }}>
              Email
            </Text>
            <View style={campoContainer}>
              <MaterialIcons
                name="mail-outline"
                size={20}
                color={colors.iconMuted}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                style={campo}
                onSubmitEditing={entrar}
              />
            </View>
          </View>

          <View style={{ gap: 9, paddingTop: 18 }}>
            <Text style={{ color: colors.textMuted, fontWeight: "bold" }}>
              Senha
            </Text>
            <View style={campoContainer}>
              <MaterialIcons
                name="lock-outline"
                size={20}
                color={colors.iconMuted}
              />
              <TextInput
                value={senha}
                onChangeText={setSenha}
                placeholder="Digite sua senha"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!mostrarSenha}
                style={campo}
                onSubmitEditing={entrar}
              />
              <Pressable
                onPress={() => setMostrarSenha((atual) => !atual)}
                accessibilityLabel={
                  mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                }
              >
                <MaterialIcons
                  name={mostrarSenha ? "visibility-off" : "visibility"}
                  size={20}
                  color={colors.iconMuted}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={recuperarSenha}
            style={{ alignSelf: "flex-end", paddingVertical: 13 }}
          >
            <Text style={{ color: colors.primary, fontWeight: "bold" }}>
              Esqueci minha senha
            </Text>
          </Pressable>

          {mensagem ? (
            <View
              style={{
                backgroundColor: colors.primarySurface,
                borderRadius: 7,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: colors.primary }}>{mensagem}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={entrar}
            disabled={carregando}
            style={{
              minHeight: 50,
              borderRadius: 8,
              backgroundColor: carregando
                ? colors.borderStrong
                : colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {carregando ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text
                style={{
                  color: colors.primaryText,
                  fontWeight: "bold",
                  fontSize: 15,
                }}
              >
                Entrar
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
