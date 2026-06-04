import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

export default function PerfilPromotor() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [totalLojas, setTotalLojas] = useState(0);
  const [totalFotos, setTotalFotos] = useState(0);

  useEffect(() => {
    async function carregarPerfil() {
      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        router.replace("/" as any);
        return;
      }

      setEmail(usuarioAtual.email || "");

      const usuarioRef = doc(db, "usuarios", usuarioAtual.uid);
      const usuarioSnap = await getDoc(usuarioRef);

      if (usuarioSnap.exists()) {
        const dados = usuarioSnap.data();

        setNome(dados.nome || "");
        setTotalLojas(dados.lojasIds?.length || 0);
      }
    }

    carregarPerfil();
  }, []);

  useEffect(() => {
    const usuarioAtual = auth.currentUser;

    if (!usuarioAtual) return;

    const q = query(
      collection(db, "fotos"),
      where("promotorId", "==", usuarioAtual.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTotalFotos(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  async function sair() {
    try {
      await signOut(auth);
      router.replace("/" as any);
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#121212",
        padding: 20,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "bold",
          marginTop: 60,
          marginBottom: 30,
        }}
      >
        Meu Perfil
      </Text>

      <View
        style={{
          backgroundColor: "#1E1E1E",
          padding: 20,
          borderRadius: 12,
          marginBottom: 15,
        }}
      >
        <Text style={{ color: "#aaa", marginBottom: 5 }}>Nome</Text>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>
          {nome || "Promotor"}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "#1E1E1E",
          padding: 20,
          borderRadius: 12,
          marginBottom: 15,
        }}
      >
        <Text style={{ color: "#aaa", marginBottom: 5 }}>Email</Text>
        <Text style={{ color: "white", fontSize: 16 }}>{email}</Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          marginBottom: 15,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#1E1E1E",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", fontSize: 16 }}>🏪 Lojas</Text>
          <Text
            style={{
              color: "#22C55E",
              fontSize: 30,
              fontWeight: "bold",
              marginTop: 10,
            }}
          >
            {totalLojas}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: "#1E1E1E",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", fontSize: 16 }}>📷 Fotos</Text>
          <Text
            style={{
              color: "#2563EB",
              fontSize: 30,
              fontWeight: "bold",
              marginTop: 10,
            }}
          >
            {totalFotos}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/alterar_senha" as any)}
        style={{
          backgroundColor: "#9333EA",
          padding: 15,
          borderRadius: 10,
          marginTop: 10,
        }}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
          Alterar Senha
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          backgroundColor: "#444",
          padding: 15,
          borderRadius: 10,
          marginTop: 10,
        }}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
          Voltar
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={sair}
        style={{
          backgroundColor: "#DC2626",
          padding: 15,
          borderRadius: 10,
          marginTop: 10,
        }}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
          Sair
        </Text>
      </TouchableOpacity>
    </View>
  );
}