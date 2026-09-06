import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { ROTAS } from "@/constants/routes";
import { criarUsuarioAuth } from "@/services/criarUsuarioAuth";
import { auth } from "@/services/firebaseConfig";
import {
  atualizarUsuario,
  buscarUsuario,
  consultaAdministradores,
  criarUsuario,
} from "@/services/usuarios-service";
import type { Administrador } from "@/types/usuario";
import {
  Cabecalho,
  Campo,
  CampoBusca,
  FormularioModal,
  Vazio,
  useEstilosPainel,
} from "./lojas";

type AdminWebItem = Administrador & {
  nome: string;
  email: string;
  tipo: "admin" | "super_admin";
};

export default function AdministradoresWeb() {
  const estilos = useEstilosPainel();
  const { colors } = estilos;
  const [admins, setAdmins] = useState<AdminWebItem[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let unsubscribe: undefined | (() => void);
    async function iniciar() {
      const atual = auth.currentUser;
      if (!atual) return router.replace(ROTAS.login);
      const perfil = await buscarUsuario(atual.uid);
      if (perfil.data()?.tipo !== "super_admin") {
        router.replace(ROTAS.painel);
        return;
      }
      setAutorizado(true);
      unsubscribe = onSnapshot(consultaAdministradores(), (snapshot) => {
        const lista = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AdminWebItem[];
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        setAdmins(lista);
      });
    }
    iniciar();
    return () => unsubscribe?.();
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return admins;
    return admins.filter((item) =>
      `${item.nome} ${item.email}`.toLocaleLowerCase("pt-BR").includes(termo),
    );
  }, [admins, busca]);

  async function cadastrar() {
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      Alert.alert(
        "Atencao",
        "Preencha os dados e use uma senha de pelo menos 6 caracteres.",
      );
      return;
    }
    try {
      setSalvando(true);
      const uid = await criarUsuarioAuth(email, senha);
      await criarUsuario(uid, {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        tipo: "admin",
        ativo: true,
        primeiroAcesso: true,
        criadoEm: serverTimestamp(),
      });
      setNome("");
      setEmail("");
      setSenha("");
      setModalAberto(false);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Nao foi possivel cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAcesso(item: AdminWebItem) {
    if (item.id === auth.currentUser?.uid) {
      Alert.alert(
        "Acao bloqueada",
        "Voce nao pode desativar seu proprio acesso.",
      );
      return;
    }
    await atualizarUsuario(item.id, {
      ativo: item.ativo === false,
      atualizadoEm: serverTimestamp(),
    });
  }

  if (!autorizado) return <View style={{ flex: 1 }} />;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 18, paddingBottom: 28 }}
    >
      <Cabecalho
        titulo="Administradores"
        subtitulo={`${admins.length} contas administrativas`}
        botao="Novo administrador"
        icone="person-add"
        onPress={() => setModalAberto(true)}
      />
      <CampoBusca
        valor={busca}
        onChange={setBusca}
        placeholder="Buscar por nome ou email"
      />
      <View style={estilos.tabela}>
        <View style={estilos.cabecalhoTabela}>
          <Text style={[estilos.celulaCabecalho, { flex: 1.6 }]}>
            ADMINISTRADOR
          </Text>
          <Text style={estilos.celulaCabecalho}>NIVEL</Text>
          <Text style={estilos.celulaCabecalho}>STATUS</Text>
          <Text style={[estilos.celulaCabecalho, { flex: 0.6 }]}>ACAO</Text>
        </View>
        {filtrados.map((item, indice) => {
          const ativo = item.ativo !== false;
          const proprio = item.id === auth.currentUser?.uid;
          return (
            <View
              key={item.id}
              style={[
                estilos.linhaTabela,
                { borderBottomWidth: indice < filtrados.length - 1 ? 1 : 0 },
              ]}
            >
              <View
                style={{
                  flex: 1.6,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View style={estilos.iconeLinha}>
                  <MaterialIcons
                    name="admin-panel-settings"
                    size={19}
                    color={colors.primary}
                  />
                </View>
                <View>
                  <Text style={{ color: colors.text, fontWeight: "bold" }}>
                    {item.nome}
                    {proprio ? " (voce)" : ""}
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
              <Text style={{ flex: 1, color: colors.textMuted }}>
                {item.tipo === "super_admin" ? "Principal" : "Administrador"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={ativo ? estilos.badgeAtivo : estilos.badgeInativo}>
                  {ativo ? "Ativo" : "Inativo"}
                </Text>
              </View>
              <View style={{ flex: 0.6 }}>
                {!proprio ? (
                  <Pressable
                    onPress={() => alternarAcesso(item)}
                    style={{
                      alignSelf: "flex-start",
                      minHeight: 34,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      justifyContent: "center",
                      backgroundColor: colors.surfaceElevated,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      {ativo ? "Desativar" : "Reativar"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
        {filtrados.length === 0 ? (
          <Vazio texto="Nenhum administrador encontrado." />
        ) : null}
      </View>
      <FormularioModal
        visivel={modalAberto}
        titulo="Cadastrar administrador"
        onClose={() => setModalAberto(false)}
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
      </FormularioModal>
    </ScrollView>
  );
}
