import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import {
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import Animated, {
  FadeInUp,
  LinearTransition,
} from "react-native-reanimated";

import { criarUsuarioAuth } from "@/services/criarUsuarioAuth";
import { lojasCollection } from "@/services/lojas-service";
import {
  atualizarUsuario,
  consultaPromotores,
  criarUsuario,
  excluirUsuario,
} from "@/services/usuarios-service";
import type { ThemeColors } from "@/theme/colors";
import type { Loja } from "@/types/loja";
import type { Promotor } from "@/types/usuario";

import {
  Cabecalho,
  Campo,
  CampoBusca,
  FormularioModal,
  Vazio,
  useEstilosPainel,
} from "./lojas";

type PromotorWebItem = Promotor & {
  nome: string;
  email: string;
};

export default function PromotoresWeb() {
  const estilos = useEstilosPainel();
  const { colors } = estilos;
  const [promotores, setPromotores] = useState<PromotorWebItem[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [busca, setBusca] = useState("");
  const [editado, setEditado] = useState<PromotorWebItem | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsubUsuarios = onSnapshot(consultaPromotores(), (snapshot) => {
      const lista = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as PromotorWebItem[];
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
      setPromotores(lista);
    });
    const unsubLojas = onSnapshot(lojasCollection(), (snapshot) => {
      setLojas(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Loja[],
      );
    });
    return () => {
      unsubUsuarios();
      unsubLojas();
    };
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return promotores;
    return promotores.filter((item) =>
      `${item.nome} ${item.email}`.toLocaleLowerCase("pt-BR").includes(termo),
    );
  }, [busca, promotores]);

  function alternarLoja(id: string) {
    setSelecionadas((atuais) =>
      atuais.includes(id)
        ? atuais.filter((item) => item !== id)
        : [...atuais, id],
    );
  }

  function abrirEdicao(promotor: PromotorWebItem) {
    setEditado(promotor);
    setSelecionadas(promotor.lojasIds || []);
  }

  async function salvarLojas() {
    if (!editado || selecionadas.length === 0) {
      Alert.alert("Atencao", "Selecione pelo menos uma loja.");
      return;
    }
    setSalvando(true);
    try {
      await atualizarUsuario(editado.id, {
        lojasIds: selecionadas,
        atualizadoEm: serverTimestamp(),
      });
      setEditado(null);
    } finally {
      setSalvando(false);
    }
  }

  async function cadastrar() {
    if (
      !nome.trim() ||
      !email.trim() ||
      senha.length < 6 ||
      selecionadas.length === 0
    ) {
      Alert.alert(
        "Atencao",
        "Preencha os dados, uma senha de 6 caracteres e selecione uma loja.",
      );
      return;
    }
    setSalvando(true);
    try {
      const uid = await criarUsuarioAuth(email, senha);
      await criarUsuario(uid, {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        tipo: "promotor",
        ativo: true,
        primeiroAcesso: true,
        lojasIds: selecionadas,
        criadoEm: serverTimestamp(),
      });
      setNome("");
      setEmail("");
      setSenha("");
      setSelecionadas([]);
      setNovoAberto(false);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Nao foi possivel cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAcesso(item: PromotorWebItem) {
    await atualizarUsuario(item.id, {
      ativo: item.ativo === false,
      atualizadoEm: serverTimestamp(),
    });
  }

  async function excluir(item: PromotorWebItem) {
    if (
      !globalThis.confirm(
        `Excluir o cadastro de ${item.nome}? As fotos serao preservadas.`,
      )
    )
      return;
    await excluirUsuario(item.id);
    globalThis.alert(
      `Cadastro removido. Exclua tambem a credencial de ${item.email} no Firebase Authentication.`,
    );
  }

  function nomesLojas(item: PromotorWebItem) {
    return (
      lojas
        .filter((loja) => item.lojasIds?.includes(loja.id))
        .map((loja) => loja.nome)
        .join(", ") || "Nenhuma loja"
    );
  }

  const seletorLojas = (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textMuted, fontWeight: "bold" }}>
        Lojas permitidas
      </Text>
      {lojas.map((loja) => {
        const ativa = selecionadas.includes(loja.id);
        return (
          <Pressable
            key={loja.id}
            onPress={() => alternarLoja(loja.id)}
            style={{
              minHeight: 44,
              borderWidth: 1,
              borderColor: ativa ? colors.primary : colors.border,
              borderRadius: 8,
              backgroundColor: ativa ? colors.primarySurface : colors.surface,
              paddingHorizontal: 11,
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
            }}
          >
            <MaterialIcons
              name={ativa ? "check-box" : "check-box-outline-blank"}
              size={21}
              color={ativa ? colors.primary : colors.iconMuted}
            />
            <Text
              style={{
                color: ativa ? colors.primary : colors.text,
                fontWeight: ativa ? "bold" : "normal",
              }}
            >
              {loja.nome}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 18, paddingBottom: 28 }}
    >
      <Cabecalho
        titulo="Promotores"
        subtitulo={`${promotores.length} profissionais cadastrados`}
        botao="Novo promotor"
        icone="person-add"
        onPress={() => {
          setSelecionadas([]);
          setNovoAberto(true);
        }}
      />
      <CampoBusca
        valor={busca}
        onChange={setBusca}
        placeholder="Buscar por nome ou email"
      />
      <Animated.View
        entering={FadeInUp.duration(260)}
        layout={LinearTransition.duration(180)}
        style={estilos.tabela}
      >
        <View style={estilos.cabecalhoTabela}>
          <Text style={[estilos.celulaCabecalho, { flex: 1.4 }]}>PROMOTOR</Text>
          <Text style={[estilos.celulaCabecalho, { flex: 1.5 }]}>LOJAS</Text>
          <Text style={[estilos.celulaCabecalho, { flex: 0.55 }]}>STATUS</Text>
          <Text style={[estilos.celulaCabecalho, { flex: 0.8 }]}>ACOES</Text>
        </View>
        {filtrados.map((item, indice) => {
          const ativo = item.ativo !== false;
          return (
            <Animated.View
              key={item.id}
              entering={FadeInUp.duration(220).delay(indice * 35)}
              layout={LinearTransition.duration(160)}
              style={[
                estilos.linhaTabela,
                { borderBottomWidth: indice < filtrados.length - 1 ? 1 : 0 },
              ]}
            >
              <View
                style={{
                  flex: 1.4,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View style={estilos.iconeLinha}>
                  <MaterialIcons name="person" size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "bold" }}>
                    {item.nome}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSubtle,
                      fontSize: 12,
                      paddingTop: 3,
                    }}
                  >
                    {item.email}
                  </Text>
                </View>
              </View>
              <Text
                numberOfLines={2}
                style={[estilos.celula, { flex: 1.5 }]}
              >
                {nomesLojas(item)}
              </Text>
              <View style={{ flex: 0.55 }}>
                <Text style={ativo ? estilos.badgeAtivo : estilos.badgeInativo}>
                  {ativo ? "Ativo" : "Inativo"}
                </Text>
              </View>
              <View style={{ flex: 0.8, flexDirection: "row", gap: 6 }}>
                <IconeAcao
                  colors={colors}
                  icone="store"
                  titulo="Alterar lojas"
                  onPress={() => abrirEdicao(item)}
                />
                <IconeAcao
                  colors={colors}
                  icone={ativo ? "block" : "check-circle"}
                  titulo={ativo ? "Desativar" : "Reativar"}
                  onPress={() => alternarAcesso(item)}
                />
                <IconeAcao
                  colors={colors}
                  icone="delete-outline"
                  titulo="Excluir"
                  perigo
                  onPress={() => excluir(item)}
                />
              </View>
            </Animated.View>
          );
        })}
        {filtrados.length === 0 ? (
          <Vazio texto="Nenhum promotor encontrado." />
        ) : null}
      </Animated.View>

      <FormularioModal
        visivel={novoAberto}
        titulo="Cadastrar promotor"
        onClose={() => setNovoAberto(false)}
        onSave={cadastrar}
        salvando={salvando}
      >
        <Campo rotulo="Nome completo" valor={nome} onChange={setNome} />
        <Campo rotulo="Email" valor={email} onChange={setEmail} />
        <Campo
          rotulo="Senha provisoria"
          valor={senha}
          onChange={setSenha}
          secureTextEntry
        />
        {seletorLojas}
      </FormularioModal>
      <FormularioModal
        visivel={!!editado}
        titulo={`Lojas de ${editado?.nome || ""}`}
        onClose={() => setEditado(null)}
        onSave={salvarLojas}
        salvando={salvando}
      >
        {seletorLojas}
      </FormularioModal>
    </ScrollView>
  );
}

function IconeAcao({
  colors,
  icone,
  titulo,
  onPress,
  perigo,
}: {
  colors: ThemeColors;
  icone: keyof typeof MaterialIcons.glyphMap;
  titulo: string;
  onPress: () => void;
  perigo?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={titulo}
      style={{
        width: 34,
        height: 34,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: perigo ? colors.danger : colors.border,
        backgroundColor: perigo
          ? colors.dangerSurface
          : colors.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialIcons
        name={icone}
        size={18}
        color={perigo ? colors.danger : colors.textMuted}
      />
    </Pressable>
  );
}
