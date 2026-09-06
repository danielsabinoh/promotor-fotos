import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { onSnapshot, serverTimestamp } from "firebase/firestore";

import { criarUsuarioAuth } from "@/services/criarUsuarioAuth";
import { lojasCollection } from "@/services/lojas-service";
import { criarUsuario } from "@/services/usuarios-service";
import { useTheme } from "@/theme/theme-context";
import type { ThemeColors } from "@/theme/colors";
import type { Loja } from "@/types/loja";
import { prepararImagemBase64 } from "@/utils/imagem";

const COR_PRIMARIA = "#7C3AED";
const COR_PRIMARIA_FUNDO = "#F1ECFD";

export default function CadastroPromotor() {
  const { colors, scheme } = useTheme();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  async function escolherFonteFoto() {
    const opcoes: {
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }[] = [
      { text: "Câmera", onPress: tirarFoto },
      { text: "Galeria", onPress: escolherDaGaleria },
    ];

    if (fotoUri) {
      opcoes.push({
        text: "Remover foto",
        style: "destructive",
        onPress: () => setFotoUri(null),
      });
    }

    opcoes.push({ text: "Cancelar", style: "cancel" });

    Alert.alert(
      "Foto do promotor",
      fotoUri ? "O que deseja fazer?" : "De onde deseja escolher a foto?",
      opcoes,
    );
  }

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert(
        "Permissão necessária",
        "Permita o acesso à câmera para tirar a foto.",
      );
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!resultado.canceled) setFotoUri(resultado.assets[0].uri);
  }

  async function escolherDaGaleria() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!resultado.canceled) setFotoUri(resultado.assets[0].uri);
  }

  useEffect(() => {
    return onSnapshot(lojasCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Loja[];
      lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setLojas(lista);
    });
  }, []);

  const lojasMap = useMemo(() => {
    const mapa: Record<string, Loja> = {};
    lojas.forEach((l) => {
      mapa[l.id] = l;
    });
    return mapa;
  }, [lojas]);

  async function salvarPromotor() {
    if (salvando) return;

    if (!nome.trim() || !email.trim()) {
      Alert.alert("Atenção", "Preencha nome e email.");
      return;
    }
    if (lojasSelecionadas.length === 0) {
      Alert.alert("Atenção", "Selecione pelo menos uma loja.");
      return;
    }
    if (senha.length < 6) {
      Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      Alert.alert("Atenção", "As senhas não coincidem.");
      return;
    }

    try {
      setSalvando(true);

      let fotoBase64: string | undefined;
      if (fotoUri) {
        try {
          fotoBase64 = await prepararImagemBase64(fotoUri);
        } catch (e: any) {
          Alert.alert(
            "Foto muito grande",
            e.message || "Não foi possível processar a foto.",
          );
          setSalvando(false);
          return;
        }
      }

      const uid = await criarUsuarioAuth(email, senha);
      await criarUsuario(uid, {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        tipo: "promotor",
        lojasIds: lojasSelecionadas,
        ativo: true,
        primeiroAcesso: true,
        criadoEm: serverTimestamp(),
        ...(fotoBase64 ? { fotoBase64 } : {}),
      });
      Alert.alert("Sucesso", "Promotor cadastrado com sucesso!");
      router.back();
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", error.message || "Não foi possível cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  function removerLoja(id: string) {
    setLojasSelecionadas((atuais) => atuais.filter((l) => l !== id));
  }

  const corBorda =
    scheme === "light" ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 60,
          gap: 16,
        }}
      >
        {/* Botão voltar — só ícone */}
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          style={{
            alignSelf: "flex-start",
            width: 42,
            height: 42,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 6,
          }}
        >
          <MaterialIcons name="arrow-back" size={26} color={colors.text} />
        </Pressable>

        {/* Título + subtítulo */}
        <View style={{ gap: 8, paddingBottom: 8 }}>
          <Text
            style={{ color: colors.text, fontSize: 28, fontWeight: "bold" }}
          >
            Cadastro de Promotor
          </Text>
          <Text style={{ color: colors.textSubtle, lineHeight: 21 }}>
            Preencha os dados do promotor para realizar o cadastro.
          </Text>
        </View>

        {/* Avatar / Adicionar foto */}
        <CampoFoto fotoUri={fotoUri} onEscolher={escolherFonteFoto} />

        {/* Nome */}
        <CampoEntrada
          colors={colors}
          corBorda={corBorda}
          icone="person-outline"
          placeholder="Nome completo"
          valor={nome}
          onChange={setNome}
        />

        {/* Email */}
        <CampoEntrada
          colors={colors}
          corBorda={corBorda}
          icone="mail-outline"
          placeholder="E-mail"
          valor={email}
          onChange={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {/* Seletor de lojas */}
        <CampoLojas
          colors={colors}
          corBorda={corBorda}
          lojasSelecionadas={lojasSelecionadas
            .map((id) => lojasMap[id])
            .filter(Boolean)}
          onAbrir={() => setSheetAberto(true)}
          onRemover={removerLoja}
        />

        {/* Senha */}
        <CampoEntrada
          colors={colors}
          corBorda={corBorda}
          icone="lock-outline"
          placeholder="Senha"
          valor={senha}
          onChange={setSenha}
          secureTextEntry={!mostrarSenha}
          autoCapitalize="none"
          iconeDireita={mostrarSenha ? "visibility-off" : "visibility"}
          onIconeDireita={() => setMostrarSenha((v) => !v)}
        />

        {/* Confirmar senha */}
        <CampoEntrada
          colors={colors}
          corBorda={corBorda}
          icone="lock-outline"
          placeholder="Confirmar senha"
          valor={confirmarSenha}
          onChange={setConfirmarSenha}
          secureTextEntry={!mostrarConfirmar}
          autoCapitalize="none"
          iconeDireita={mostrarConfirmar ? "visibility-off" : "visibility"}
          onIconeDireita={() => setMostrarConfirmar((v) => !v)}
        />

        {/* Botão Salvar */}
        <Pressable
          onPress={salvarPromotor}
          disabled={salvando}
          style={{
            marginTop: 14,
            minHeight: 54,
            borderRadius: 12,
            backgroundColor: salvando ? "#B8A0F3" : COR_PRIMARIA,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
            {salvando ? "Salvando..." : "Salvar Promotor"}
          </Text>
        </Pressable>
      </ScrollView>

      <BottomSheetLojas
        colors={colors}
        corBorda={corBorda}
        visivel={sheetAberto}
        lojas={lojas}
        selecionadasIniciais={lojasSelecionadas}
        onConfirmar={(ids) => {
          setLojasSelecionadas(ids);
          setSheetAberto(false);
        }}
        onFechar={() => setSheetAberto(false)}
      />
    </KeyboardAvoidingView>
  );
}

/* ---------- Componentes ---------- */

function CampoFoto({
  fotoUri,
  onEscolher,
}: {
  fotoUri: string | null;
  onEscolher: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <Pressable
        onPress={onEscolher}
        accessibilityLabel="Adicionar foto"
        style={{
          width: 116,
          height: 116,
          borderRadius: 58,
          backgroundColor: COR_PRIMARIA_FUNDO,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {fotoUri ? (
          <Image
            source={{ uri: fotoUri }}
            style={{
              width: 116,
              height: 116,
              borderRadius: 58,
            }}
          />
        ) : (
          <MaterialIcons name="person" size={64} color={COR_PRIMARIA} />
        )}

        {/* Mini botão de câmera no canto */}
        <View
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: COR_PRIMARIA,
            borderWidth: 3,
            borderColor: "white",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="photo-camera" size={18} color="white" />
        </View>
      </Pressable>

      <Pressable onPress={onEscolher} hitSlop={6}>
        <Text
          style={{
            color: COR_PRIMARIA,
            fontWeight: "bold",
            fontSize: 14,
          }}
        >
          {fotoUri ? "Trocar foto" : "Adicionar foto"}
        </Text>
      </Pressable>
    </View>
  );
}

function CampoEntrada({
  colors,
  corBorda,
  icone,
  placeholder,
  valor,
  onChange,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  iconeDireita,
  onIconeDireita,
}: {
  colors: ThemeColors;
  corBorda: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  placeholder: string;
  valor: string;
  onChange: (v: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric";
  iconeDireita?: keyof typeof MaterialIcons.glyphMap;
  onIconeDireita?: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 56,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: corBorda,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <MaterialIcons name={icone} size={22} color={COR_PRIMARIA} />
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={{
          flex: 1,
          color: colors.text,
          fontSize: 15,
          paddingVertical: 14,
        }}
      />
      {iconeDireita && onIconeDireita ? (
        <Pressable
          onPress={onIconeDireita}
          accessibilityLabel="Alternar visibilidade"
          style={{ padding: 4 }}
        >
          <MaterialIcons
            name={iconeDireita}
            size={22}
            color={colors.iconMuted}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function CampoLojas({
  colors,
  corBorda,
  lojasSelecionadas,
  onAbrir,
  onRemover,
}: {
  colors: ThemeColors;
  corBorda: string;
  lojasSelecionadas: Loja[];
  onAbrir: () => void;
  onRemover: (id: string) => void;
}) {
  const vazio = lojasSelecionadas.length === 0;

  return (
    <Pressable
      onPress={onAbrir}
      style={{
        minHeight: 56,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: corBorda,
        backgroundColor: colors.surface,
        paddingVertical: vazio ? 0 : 10,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <MaterialIcons name="storefront" size={22} color={COR_PRIMARIA} />

      {vazio ? (
        <Text
          style={{
            flex: 1,
            color: colors.placeholder,
            fontSize: 15,
            paddingVertical: 14,
          }}
        >
          Selecionar loja
        </Text>
      ) : (
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            paddingVertical: 4,
          }}
        >
          {lojasSelecionadas.map((loja) => (
            <View
              key={loja.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingLeft: 10,
                paddingRight: 6,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: "#DBEAFE",
              }}
            >
              <Text
                style={{
                  color: "#1E40AF",
                  fontSize: 13,
                  fontWeight: "bold",
                }}
              >
                {loja.nome}
              </Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onRemover(loja.id);
                }}
                hitSlop={6}
                accessibilityLabel={`Remover ${loja.nome}`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="close" size={14} color="#1E40AF" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <MaterialIcons
        name="keyboard-arrow-down"
        size={22}
        color={colors.iconMuted}
      />
    </Pressable>
  );
}

function BottomSheetLojas({
  colors,
  corBorda,
  visivel,
  lojas,
  selecionadasIniciais,
  onConfirmar,
  onFechar,
}: {
  colors: ThemeColors;
  corBorda: string;
  visivel: boolean;
  lojas: Loja[];
  selecionadasIniciais: string[];
  onConfirmar: (ids: string[]) => void;
  onFechar: () => void;
}) {
  const [selecionadas, setSelecionadas] = useState<string[]>(
    selecionadasIniciais,
  );

  // Sincroniza quando o sheet reabre
  useEffect(() => {
    if (!visivel) return;

    const timeoutId = setTimeout(() => {
      setSelecionadas(selecionadasIniciais);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [visivel, selecionadasIniciais]);

  function alternar(id: string) {
    setSelecionadas((atuais) =>
      atuais.includes(id)
        ? atuais.filter((l) => l !== id)
        : [...atuais, id],
    );
  }

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="slide"
      onRequestClose={onFechar}
    >
      <Pressable
        onPress={onFechar}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 10,
            paddingBottom: 28,
            maxHeight: "82%",
          }}
        >
          {/* Pegador */}
          <View
            style={{
              alignSelf: "center",
              width: 42,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 12,
            }}
          />

          {/* Header */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: corBorda,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: "bold",
                }}
              >
                Selecionar lojas
              </Text>
              <Text style={{ color: colors.textSubtle, paddingTop: 3 }}>
                {selecionadas.length} selecionada
                {selecionadas.length === 1 ? "" : "s"}
              </Text>
            </View>
            <Pressable
              onPress={onFechar}
              accessibilityLabel="Fechar"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surfaceHighlight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="close" size={20} color={colors.iconMuted} />
            </Pressable>
          </View>

          {/* Lista */}
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: 6,
              gap: 8,
            }}
          >
            {lojas.length === 0 ? (
              <Text
                style={{
                  color: colors.textSubtle,
                  paddingVertical: 30,
                  textAlign: "center",
                }}
              >
                Nenhuma loja cadastrada ainda.
              </Text>
            ) : (
              lojas.map((loja) => {
                const ativa = selecionadas.includes(loja.id);
                return (
                  <Pressable
                    key={loja.id}
                    onPress={() => alternar(loja.id)}
                    style={{
                      minHeight: 60,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: ativa ? "#2563EB" : corBorda,
                      backgroundColor: ativa
                        ? "#DBEAFE"
                        : colors.surfaceElevated,
                      paddingHorizontal: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <MaterialIcons
                      name={
                        ativa ? "check-box" : "check-box-outline-blank"
                      }
                      size={22}
                      color={ativa ? "#1E40AF" : colors.iconMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: ativa ? "#1E40AF" : colors.text,
                          fontWeight: "bold",
                        }}
                      >
                        {loja.nome}
                      </Text>
                      {loja.cidade ? (
                        <Text
                          style={{
                            color: ativa ? "#1E40AF" : colors.textSubtle,
                            paddingTop: 2,
                            fontSize: 13,
                          }}
                        >
                          {loja.cidade}
                          {loja.estado ? ` - ${loja.estado}` : ""}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Botão confirmar */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: corBorda,
            }}
          >
            <Pressable
              onPress={() => onConfirmar(selecionadas)}
              style={{
                minHeight: 52,
                borderRadius: 12,
                backgroundColor: COR_PRIMARIA,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: "white", fontWeight: "bold", fontSize: 16 }}
              >
                Confirmar
                {selecionadas.length > 0 ? ` (${selecionadas.length})` : ""}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
