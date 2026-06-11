import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

type Administrador = {
  id: string;
  nome: string;
  email: string;
  tipo: "admin" | "super_admin";
  ativo?: boolean;
};

export default function GerenciarAdmins() {
  const [admins, setAdmins] = useState<Administrador[]>([]);
  const [busca, setBusca] = useState("");
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let unsubscribe: undefined | (() => void);

    async function iniciar() {
      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        router.replace("/");
        return;
      }

      const usuarioSnap = await getDoc(doc(db, "usuarios", usuarioAtual.uid));

      if (usuarioSnap.data()?.tipo !== "super_admin") {
        Alert.alert("Acesso negado", "Somente o administrador principal pode gerenciar admins.");
        router.replace("/admin");
        return;
      }

      setAutorizado(true);

      const consulta = query(
        collection(db, "usuarios"),
        where("tipo", "in", ["admin", "super_admin"]),
      );

      unsubscribe = onSnapshot(
        consulta,
        (snapshot) => {
          const lista = snapshot.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            })) as Administrador[];

          lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
          setAdmins(lista);
        },
        (error) => {
          console.log(error);
          Alert.alert("Erro", "Nao foi possivel carregar os administradores.");
        },
      );
    }

    iniciar().catch((error) => {
      console.log(error);
      Alert.alert("Erro", "Nao foi possivel validar seu acesso.");
      router.replace("/admin");
    });

    return () => unsubscribe?.();
  }, []);

  const adminsFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    if (!termo) return admins;

    return admins.filter(
      (admin) =>
        admin.nome?.toLocaleLowerCase("pt-BR").includes(termo) ||
        admin.email?.toLocaleLowerCase("pt-BR").includes(termo),
    );
  }, [admins, busca]);

  function alterarAcesso(admin: Administrador) {
    if (admin.id === auth.currentUser?.uid) {
      Alert.alert("Acao bloqueada", "Voce nao pode desativar o proprio acesso.");
      return;
    }

    const estaAtivo = admin.ativo !== false;

    Alert.alert(
      estaAtivo ? "Desativar administrador" : "Reativar administrador",
      `Deseja ${estaAtivo ? "desativar" : "reativar"} o acesso de ${admin.nome}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: estaAtivo ? "Desativar" : "Reativar",
          style: estaAtivo ? "destructive" : "default",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "usuarios", admin.id), {
                ativo: !estaAtivo,
                atualizadoEm: serverTimestamp(),
              });
            } catch (error: any) {
              console.log(error);
              Alert.alert(
                "Erro",
                error.message || "Nao foi possivel alterar o acesso.",
              );
            }
          },
        },
      ],
    );
  }

  if (!autorizado) {
    return <View style={{ flex: 1, backgroundColor: "#121212" }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <FlatList
        data={adminsFiltrados}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 18 }}>
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

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  color: "white",
                  fontSize: 28,
                  fontWeight: "bold",
                }}
              >
                Administradores
              </Text>
              <Pressable
                onPress={() => router.push("/cadastro_admin" as any)}
                accessibilityLabel="Cadastrar administrador"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: "#2563EB",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="person-add" size={23} color="white" />
              </Pressable>
            </View>

            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por nome ou email"
              placeholderTextColor="#777"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: "#444",
                borderRadius: 8,
                padding: 13,
                color: "white",
              }}
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: "#888" }}>Nenhum administrador encontrado.</Text>
        }
        renderItem={({ item }) => {
          const estaAtivo = item.ativo !== false;
          const ehUsuarioAtual = item.id === auth.currentUser?.uid;

          return (
            <View
              style={{
                backgroundColor: "#1E1E1E",
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
                gap: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    selectable
                    style={{ color: "white", fontSize: 18, fontWeight: "bold" }}
                  >
                    {item.nome || "Sem nome"}
                    {ehUsuarioAtual ? " (voce)" : ""}
                  </Text>
                  <Text selectable style={{ color: "#aaa" }}>
                    {item.email}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor:
                      item.tipo === "super_admin" ? "#854D0E" : "#1E3A8A",
                    borderRadius: 6,
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {item.tipo === "super_admin" ? "Principal" : "Admin"}
                  </Text>
                </View>
              </View>

              <Text style={{ color: estaAtivo ? "#4ADE80" : "#F87171" }}>
                {estaAtivo ? "Acesso ativo" : "Acesso desativado"}
              </Text>

              {!ehUsuarioAtual ? (
                <Pressable
                  onPress={() => alterarAcesso(item)}
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: estaAtivo ? "#7F1D1D" : "#166534",
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {estaAtivo ? "Desativar acesso" : "Reativar acesso"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
