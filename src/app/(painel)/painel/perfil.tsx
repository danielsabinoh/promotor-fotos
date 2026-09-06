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
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";

import { auth } from "@/services/firebaseConfig";
import {
  atualizarUsuario,
  buscarUsuario,
} from "@/services/usuarios-service";
import { useTheme, type ThemeMode } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import { Cabecalho } from "./lojas";
import ConfiguracoesAdmin from "@/components/configuracoes-admin";

const OPCOES_TEMA: {
  valor: ThemeMode;
  rotulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { valor: "light", rotulo: "Claro", icone: "light-mode" },
  { valor: "dark", rotulo: "Escuro", icone: "dark-mode" },
  { valor: "system", rotulo: "Sistema", icone: "smartphone" },
];

export default function ConfiguracoesWeb() {
  return <ConfiguracoesAdmin painel><PerfilWeb /></ConfiguracoesAdmin>;
}

function PerfilWeb() {
  const { colors, mode, setMode } = useTheme();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [emailOriginal, setEmailOriginal] = useState("");
  const [tipo, setTipo] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    async function carregar() {
      const atual = auth.currentUser;
      if (!atual) return;
      const perfil = await buscarUsuario(atual.uid);
      const dados = perfil.data();
      const emailAtual = atual.email || dados?.email || "";
      setNome(dados?.nome || atual.displayName || "");
      setEmail(emailAtual);
      setEmailOriginal(emailAtual);
      setTipo(dados?.tipo || "admin");
    }
    carregar();
  }, []);

  async function reautenticar() {
    const atual = auth.currentUser;
    if (!atual?.email || !senhaAtual)
      throw new Error("Informe sua senha atual.");
    await reauthenticateWithCredential(
      atual,
      EmailAuthProvider.credential(atual.email, senhaAtual),
    );
  }

  async function salvarDados() {
    const atual = auth.currentUser;
    if (!atual || !nome.trim() || !email.trim()) return;
    try {
      setSalvandoDados(true);
      const novoEmail = email.trim().toLowerCase();
      if (novoEmail !== emailOriginal.toLowerCase()) {
        await reautenticar();
        await updateEmail(atual, novoEmail);
      }
      await updateProfile(atual, { displayName: nome.trim() });
      await atualizarUsuario(atual.uid, {
        nome: nome.trim(),
        email: novoEmail,
        atualizadoEm: serverTimestamp(),
      });
      setEmailOriginal(novoEmail);
      setSenhaAtual("");
      Alert.alert("Sucesso", "Dados atualizados.");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Nao foi possivel atualizar.");
    } finally {
      setSalvandoDados(false);
    }
  }

  async function salvarSenha() {
    const atual = auth.currentUser;
    if (!atual || novaSenha.length < 6 || novaSenha !== confirmar) {
      Alert.alert(
        "Atencao",
        "Confira a senha atual e a confirmacao da nova senha.",
      );
      return;
    }
    try {
      setSalvandoSenha(true);
      await reautenticar();
      await updatePassword(atual, novaSenha);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmar("");
      Alert.alert("Sucesso", "Senha alterada.");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Nao foi possivel alterar a senha.");
    } finally {
      setSalvandoSenha(false);
    }
  }

  const secao = {
    flex: 1,
    minWidth: 0,
    flexBasis: 330,
    maxWidth: 620,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
    gap: 14,
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 18, padding: 20, paddingBottom: 28 }}
    >
      <Cabecalho
        titulo="Meu perfil"
        subtitulo={
          tipo === "super_admin"
            ? "Administrador principal"
            : "Administrador"
        }
      />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <View style={secao}>
          <TituloSecao
            colors={colors}
            icone="person-outline"
            titulo="Dados pessoais"
          />
          <CampoPerfil
            colors={colors}
            rotulo="Nome"
            valor={nome}
            onChange={setNome}
          />
          <CampoPerfil
            colors={colors}
            rotulo="Email"
            valor={email}
            onChange={setEmail}
          />
          {email.trim().toLowerCase() !== emailOriginal.toLowerCase() ? (
            <CampoPerfil
              colors={colors}
              rotulo="Senha atual para confirmar o email"
              valor={senhaAtual}
              onChange={setSenhaAtual}
              secure
            />
          ) : null}
          <Botao
            colors={colors}
            titulo={salvandoDados ? "Salvando..." : "Salvar dados"}
            icone="save"
            onPress={salvarDados}
          />
        </View>
        <View style={secao}>
          <TituloSecao
            colors={colors}
            icone="lock-outline"
            titulo="Alterar senha"
          />
          <CampoPerfil
            colors={colors}
            rotulo="Senha atual"
            valor={senhaAtual}
            onChange={setSenhaAtual}
            secure
          />
          <CampoPerfil
            colors={colors}
            rotulo="Nova senha"
            valor={novaSenha}
            onChange={setNovaSenha}
            secure
          />
          <CampoPerfil
            colors={colors}
            rotulo="Confirmar nova senha"
            valor={confirmar}
            onChange={setConfirmar}
            secure
          />
          <Botao
            colors={colors}
            titulo={salvandoSenha ? "Alterando..." : "Alterar senha"}
            icone="lock-reset"
            onPress={salvarSenha}
          />
        </View>
        <View style={secao}>
          <TituloSecao
            colors={colors}
            icone="palette"
            titulo="Aparencia"
          />
          <Text style={{ color: colors.textSubtle, lineHeight: 19 }}>
            Escolha como o painel deve aparecer. &quot;Sistema&quot; segue a
            configuracao do seu dispositivo.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
            {OPCOES_TEMA.map((opcao) => {
              const ativo = mode === opcao.valor;
              return (
                <Pressable
                  key={opcao.valor}
                  onPress={() => setMode(opcao.valor)}
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
      </View>
    </ScrollView>
  );
}

function TituloSecao({
  colors,
  icone,
  titulo,
}: {
  colors: ThemeColors;
  icone: keyof typeof MaterialIcons.glyphMap;
  titulo: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingBottom: 5,
      }}
    >
      <MaterialIcons name={icone} size={22} color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}>
        {titulo}
      </Text>
    </View>
  );
}

function CampoPerfil({
  colors,
  rotulo,
  valor,
  onChange,
  secure,
}: {
  colors: ThemeColors;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  secure?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.textMuted, fontWeight: "bold" }}>
        {rotulo}
      </Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        secureTextEntry={secure}
        placeholderTextColor={colors.placeholder}
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 7,
          paddingHorizontal: 11,
          color: colors.text,
          backgroundColor: colors.backgroundAlt,
        }}
      />
    </View>
  );
}

function Botao({
  colors,
  titulo,
  icone,
  onPress,
}: {
  colors: ThemeColors;
  titulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 44,
        alignSelf: "flex-start",
        borderRadius: 7,
        backgroundColor: colors.primary,
        paddingHorizontal: 15,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <MaterialIcons name={icone} size={20} color={colors.primaryText} />
      <Text style={{ color: colors.primaryText, fontWeight: "bold" }}>
        {titulo}
      </Text>
    </Pressable>
  );
}
