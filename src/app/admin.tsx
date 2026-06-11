import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

function obterData(valor: any) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === "function") return valor.toDate();
  if (typeof valor === "string" || typeof valor === "number") {
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  return null;
}

function mesmaData(data: Date, referencia: Date) {
  return (
    data.getDate() === referencia.getDate() &&
    data.getMonth() === referencia.getMonth() &&
    data.getFullYear() === referencia.getFullYear()
  );
}

type BotaoPainelProps = {
  titulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  cor?: string;
  onPress: () => void;
};

function BotaoPainel({
  titulo,
  icone,
  cor = "#2563EB",
  onPress,
}: BotaoPainelProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 52,
        backgroundColor: cor,
        borderRadius: 8,
        paddingHorizontal: 15,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <MaterialIcons name={icone} size={22} color="white" />
      <Text style={{ color: "white", fontWeight: "bold", fontSize: 15 }}>
        {titulo}
      </Text>
    </Pressable>
  );
}

export default function Admin() {
  const [totalLojas, setTotalLojas] = useState(0);
  const [fotosHoje, setFotosHoje] = useState(0);
  const [tipoUsuario, setTipoUsuario] = useState<"admin" | "super_admin">(
    "admin",
  );

  useEffect(() => {
    async function carregarPerfil() {
      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        router.replace("/");
        return;
      }

      const usuarioSnap = await getDoc(doc(db, "usuarios", usuarioAtual.uid));
      const dados = usuarioSnap.data();

      if (!dados || dados.ativo === false) {
        await signOut(auth);
        router.replace("/");
        return;
      }

      if (dados.tipo !== "admin" && dados.tipo !== "super_admin") {
        router.replace("/promotor");
        return;
      }

      setTipoUsuario(dados.tipo);
    }

    carregarPerfil().catch((error) => {
      console.log(error);
      Alert.alert("Erro", "Nao foi possivel carregar seu perfil.");
    });
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "lojas"),
      (snapshot) => setTotalLojas(snapshot.size),
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Nao foi possivel carregar as lojas.");
      },
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "fotos"),
      (snapshot) => {
        const hoje = new Date();
        const fotosDoDia = snapshot.docs.filter((item) => {
          const data = obterData(item.data().criadoEm);
          return data ? mesmaData(data, hoje) : false;
        });

        setFotosHoje(fotosDoDia.length);
      },
      (error) => {
        console.log(error);
        Alert.alert("Erro", "Nao foi possivel carregar as fotos.");
      },
    );
  }, []);

  async function sair() {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#121212" }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 20,
        paddingTop: 60,
        paddingBottom: 30,
        gap: 10,
      }}
    >
      <View style={{ gap: 4, paddingBottom: 16 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "bold" }}>
          Dashboard Admin
        </Text>
        {tipoUsuario === "super_admin" ? (
          <Text style={{ color: "#FBBF24" }}>Administrador principal</Text>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          paddingBottom: 8,
        }}
      >
        <View
          style={{
            flex: 1,
            minHeight: 112,
            backgroundColor: "#1E1E1E",
            borderRadius: 8,
            padding: 16,
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#ccc" }}>Fotos hoje</Text>
          <Text
            style={{
              color: "#60A5FA",
              fontSize: 32,
              fontWeight: "bold",
              fontVariant: ["tabular-nums"],
            }}
          >
            {fotosHoje}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            minHeight: 112,
            backgroundColor: "#1E1E1E",
            borderRadius: 8,
            padding: 16,
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#ccc" }}>Lojas</Text>
          <Text
            style={{
              color: "#4ADE80",
              fontSize: 32,
              fontWeight: "bold",
              fontVariant: ["tabular-nums"],
            }}
          >
            {totalLojas}
          </Text>
        </View>
      </View>

      <BotaoPainel
        titulo="Ver fotos"
        icone="photo-library"
        onPress={() => router.push("/ver_fotos")}
      />
      <BotaoPainel
        titulo="Gerenciar promotores"
        icone="groups"
        onPress={() => router.push("/gerenciar_promotores" as any)}
      />
      <BotaoPainel
        titulo="Cadastrar promotor"
        icone="person-add"
        onPress={() => router.push("/cadastro_promotor")}
      />
      <BotaoPainel
        titulo="Ver lojas"
        icone="store"
        onPress={() => router.push("/ver_lojas")}
      />
      <BotaoPainel
        titulo="Cadastrar loja"
        icone="add-business"
        onPress={() => router.push("/cadastro_loja")}
      />

      {tipoUsuario === "super_admin" ? (
        <>
          <View
            style={{
              height: 1,
              backgroundColor: "#333",
              marginVertical: 6,
            }}
          />
          <BotaoPainel
            titulo="Gerenciar administradores"
            icone="admin-panel-settings"
            cor="#7C3AED"
            onPress={() => router.push("/gerenciar_admins" as any)}
          />
          <BotaoPainel
            titulo="Cadastrar administrador"
            icone="person-add-alt-1"
            cor="#7C3AED"
            onPress={() => router.push("/cadastro_admin" as any)}
          />
        </>
      ) : null}

      <BotaoPainel
        titulo="Sair"
        icone="logout"
        cor="#B91C1C"
        onPress={sair}
      />
    </ScrollView>
  );
}
