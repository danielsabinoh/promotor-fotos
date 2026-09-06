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
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";

import { ROTAS } from "../constants/routes";
import { auth } from "../services/firebaseConfig";
import {
  atualizarDadosPerfilUsuario,
  buscarPerfilUsuario,
} from "../services/usuarios-service";
import { useTheme, type ThemeMode } from "../theme/theme-context";
import type { ThemeColors } from "../theme/colors";

type PerfilUsuarioProps = {
  tipoEsperado: "promotor" | "admin";
  totalFotos?: number;
  totalLojas?: number;
  embutido?: boolean;
};

const OPCOES_TEMA: { valor: ThemeMode; rotulo: string; icone: keyof typeof MaterialIcons.glyphMap }[] = [
  { valor: "light", rotulo: "Claro", icone: "light-mode" },
  { valor: "dark", rotulo: "Escuro", icone: "dark-mode" },
  { valor: "system", rotulo: "Sistema", icone: "smartphone" },
];

function mensagemErro(error: any) {
  if (error?.code === "auth/wrong-password") return "A senha atual esta incorreta.";
  if (error?.code === "auth/invalid-credential") {
    return "A senha atual esta incorreta.";
  }
  if (error?.code === "auth/email-already-in-use") {
    return "Este email ja esta sendo utilizado.";
  }
  if (error?.code === "auth/invalid-email") return "Digite um email valido.";
  if (error?.code === "auth/weak-password") {
    return "A nova senha deve ter pelo menos 6 caracteres.";
  }
  if (error?.code === "auth/requires-recent-login") {
    return "Confirme sua senha atual e tente novamente.";
  }

  return error?.message || "Nao foi possivel concluir a alteracao.";
}

export default function PerfilUsuario({
  tipoEsperado,
  totalFotos,
  totalLojas,
  embutido = false,
}: PerfilUsuarioProps) {
  const { colors, mode, setMode } = useTheme();
  const estilos = criarEstilos(colors);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [emailOriginal, setEmailOriginal] = useState("");
  const [tipo, setTipo] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    async function carregarPerfil() {
      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        router.replace(ROTAS.login);
        return;
      }

      const perfil = await buscarPerfilUsuario(usuarioAtual.uid);

      if (!perfil || perfil.ativo === false) {
        await signOut(auth);
        router.replace(ROTAS.login);
        return;
      }

      const ehAdmin = perfil.tipo === "admin" || perfil.tipo === "super_admin";

      if (
        (tipoEsperado === "admin" && !ehAdmin) ||
        (tipoEsperado === "promotor" && perfil.tipo !== "promotor")
      ) {
        router.replace(ehAdmin ? ROTAS.admin : ROTAS.promotor);
        return;
      }

      const emailAtual = usuarioAtual.email || perfil.email || "";
      setNome(perfil.nome || usuarioAtual.displayName || "");
      setEmail(emailAtual);
      setEmailOriginal(emailAtual);
      setTipo(perfil.tipo || "");
    }

    carregarPerfil().catch((error) => {
      console.log(error);
      Alert.alert("Erro", "Nao foi possivel carregar o perfil.");
    });
  }, [tipoEsperado]);

  async function reautenticar(senha: string) {
    const usuarioAtual = auth.currentUser;

    if (!usuarioAtual?.email) {
      throw new Error("Usuario nao encontrado.");
    }

    const credencial = EmailAuthProvider.credential(
      usuarioAtual.email,
      senha,
    );
    await reauthenticateWithCredential(usuarioAtual, credencial);
  }

  async function salvarDados() {
    const usuarioAtual = auth.currentUser;
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();
    const emailMudou = emailLimpo !== emailOriginal.toLowerCase();

    if (!usuarioAtual) return;

    if (!nomeLimpo || !emailLimpo) {
      Alert.alert("Atencao", "Preencha nome e email.");
      return;
    }

    if (emailMudou && !senhaAtual) {
      Alert.alert(
        "Senha atual",
        "Informe sua senha atual para alterar o email.",
      );
      return;
    }

    try {
      setSalvandoDados(true);

      if (emailMudou) {
        await reautenticar(senhaAtual);
        await updateEmail(usuarioAtual, emailLimpo);
      }

      await updateProfile(usuarioAtual, { displayName: nomeLimpo });
      await atualizarDadosPerfilUsuario(usuarioAtual.uid, {
        nome: nomeLimpo,
        email: emailLimpo,
      });

      setNome(nomeLimpo);
      setEmail(emailLimpo);
      setEmailOriginal(emailLimpo);
      setSenhaAtual("");
      Alert.alert("Sucesso", "Dados atualizados.");
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", mensagemErro(error));
    } finally {
      setSalvandoDados(false);
    }
  }

  async function salvarNovaSenha() {
    const usuarioAtual = auth.currentUser;

    if (!usuarioAtual) return;

    if (!senhaAtual) {
      Alert.alert("Atencao", "Informe sua senha atual.");
      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert("Atencao", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert("Atencao", "As novas senhas nao coincidem.");
      return;
    }

    try {
      setSalvandoSenha(true);
      await reautenticar(senhaAtual);
      await updatePassword(usuarioAtual, novaSenha);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      Alert.alert("Sucesso", "Senha alterada.");
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", mensagemErro(error));
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function sair() {
    await signOut(auth);
    router.replace(ROTAS.login);
  }

  const tituloTipo =
    tipo === "super_admin"
      ? "Administrador principal"
      : tipo === "admin"
        ? "Administrador"
        : "Promotor";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 20,
        paddingTop: embutido ? 20 : 60,
        paddingBottom: 30,
        gap: 14,
      }}
    >
      {!embutido ? <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            backgroundColor: colors.surfaceHighlight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "bold" }}>
            Meu Perfil
          </Text>
          <Text style={{ color: colors.textSubtle, paddingTop: 3 }}>
            {tituloTipo}
          </Text>
        </View>
      </View>

      : null}

      {tipoEsperado === "promotor" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={estilos.resumo}>
            <MaterialIcons name="store" size={22} color={colors.success} />
            <Text style={estilos.rotuloResumo}>Lojas</Text>
            <Text style={[estilos.valorResumo, { color: colors.success }]}>
              {totalLojas || 0}
            </Text>
          </View>
          <View style={estilos.resumo}>
            <MaterialIcons name="photo-library" size={22} color={colors.info} />
            <Text style={estilos.rotuloResumo}>Fotos</Text>
            <Text style={[estilos.valorResumo, { color: colors.info }]}>
              {totalFotos || 0}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={estilos.secao}>
        <Text style={estilos.tituloSecao}>Aparencia</Text>
        <Text style={estilos.descricao}>
          Escolha como o app deve aparecer. &quot;Sistema&quot; segue a
          configuracao do seu celular.
        </Text>

        <View style={{ flexDirection: "row", gap: 8, paddingTop: 6 }}>
          {OPCOES_TEMA.map((opcao) => {
            const ativo = mode === opcao.valor;

            return (
              <Pressable
                key={opcao.valor}
                onPress={() => setMode(opcao.valor)}
                accessibilityLabel={`Tema ${opcao.rotulo}`}
                style={{
                  flex: 1,
                  minHeight: 76,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: ativo ? colors.primary : colors.border,
                  backgroundColor: ativo
                    ? colors.primarySurface
                    : colors.surfaceElevated,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: 8,
                }}
              >
                <MaterialIcons
                  name={opcao.icone}
                  size={22}
                  color={ativo ? colors.primary : colors.iconMuted}
                />
                <Text
                  style={{
                    color: ativo ? colors.primary : colors.textMuted,
                    fontWeight: "bold",
                    fontSize: 13,
                  }}
                >
                  {opcao.rotulo}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={estilos.secao}>
        <Text style={estilos.tituloSecao}>Dados pessoais</Text>

        <Text style={estilos.rotuloCampo}>Nome</Text>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Nome completo"
          placeholderTextColor={colors.placeholder}
          style={estilos.campo}
        />

        <Text style={estilos.rotuloCampo}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          keyboardType="email-address"
          style={estilos.campo}
        />

        {email.trim().toLowerCase() !== emailOriginal.toLowerCase() ? (
          <>
            <Text style={estilos.rotuloCampo}>Senha atual</Text>
            <TextInput
              value={senhaAtual}
              onChangeText={setSenhaAtual}
              placeholder="Confirme sua senha"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              style={estilos.campo}
            />
          </>
        ) : null}

        <Pressable
          onPress={salvarDados}
          disabled={salvandoDados}
          style={[
            estilos.botao,
            {
              backgroundColor: salvandoDados
                ? colors.borderStrong
                : colors.primary,
            },
          ]}
        >
          <MaterialIcons name="save" size={21} color={colors.primaryText} />
          <Text style={[estilos.textoBotao, { color: colors.primaryText }]}>
            {salvandoDados ? "Salvando..." : "Salvar dados"}
          </Text>
        </Pressable>
      </View>

      <View style={estilos.secao}>
        <Text style={estilos.tituloSecao}>Alterar senha</Text>

        <Text style={estilos.rotuloCampo}>Senha atual</Text>
        <TextInput
          value={senhaAtual}
          onChangeText={setSenhaAtual}
          placeholder="Senha atual"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          style={estilos.campo}
        />

        <Text style={estilos.rotuloCampo}>Nova senha</Text>
        <TextInput
          value={novaSenha}
          onChangeText={setNovaSenha}
          placeholder="Minimo de 6 caracteres"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          style={estilos.campo}
        />

        <Text style={estilos.rotuloCampo}>Confirmar nova senha</Text>
        <TextInput
          value={confirmarSenha}
          onChangeText={setConfirmarSenha}
          placeholder="Repita a nova senha"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          style={estilos.campo}
        />

        <Pressable
          onPress={salvarNovaSenha}
          disabled={salvandoSenha}
          style={[
            estilos.botao,
            {
              backgroundColor: salvandoSenha
                ? colors.borderStrong
                : "#7C3AED",
            },
          ]}
        >
          <MaterialIcons name="lock-reset" size={22} color={colors.primaryText} />
          <Text style={[estilos.textoBotao, { color: colors.primaryText }]}>
            {salvandoSenha ? "Alterando..." : "Alterar senha"}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={sair}
        style={[estilos.botao, { backgroundColor: colors.danger }]}
      >
        <MaterialIcons name="logout" size={21} color={colors.primaryText} />
        <Text style={[estilos.textoBotao, { color: colors.primaryText }]}>
          Sair
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function criarEstilos(colors: ThemeColors) {
  return {
    secao: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tituloSecao: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "bold" as const,
      paddingBottom: 4,
    },
    descricao: {
      color: colors.textSubtle,
      fontSize: 13,
      lineHeight: 19,
    },
    rotuloCampo: {
      color: colors.textMuted,
      fontSize: 14,
    },
    campo: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 13,
      color: colors.text,
      marginBottom: 4,
      backgroundColor: colors.backgroundAlt,
    },
    botao: {
      minHeight: 48,
      borderRadius: 8,
      paddingHorizontal: 14,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
    textoBotao: {
      color: colors.primaryText,
      fontWeight: "bold" as const,
    },
    resumo: {
      flex: 1,
      minHeight: 108,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 14,
      gap: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rotuloResumo: {
      color: colors.textMuted,
    },
    valorResumo: {
      fontSize: 28,
      fontWeight: "bold" as const,
      fontVariant: ["tabular-nums"] as ("tabular-nums")[],
    },
  };
}
