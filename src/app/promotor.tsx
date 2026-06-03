import { useEffect, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

type Loja = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
};

export default function Promotor() {
  const [nome, setNome] = useState("");
  const [lojas, setLojas] = useState<Loja[]>([]);

  async function carregarDadosPromotor() {
    try {
      const usuarioAtual = auth.currentUser;

      if (!usuarioAtual) {
        Alert.alert("Erro", "Usuário não encontrado.");
        router.replace("/" as any);
        return;
      }

      const usuarioRef = doc(db, "usuarios", usuarioAtual.uid);
      const usuarioSnap = await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        Alert.alert("Erro", "Usuário não cadastrado no sistema.");
        return;
      }

      const usuarioData = usuarioSnap.data();

      setNome(usuarioData.nome);

      const lojasIds = usuarioData.lojasIds || [];

      const lojasCarregadas: Loja[] = [];

      for (const lojaId of lojasIds) {
        const lojaRef = doc(db, "lojas", lojaId);
        const lojaSnap = await getDoc(lojaRef);

        if (lojaSnap.exists()) {
          lojasCarregadas.push({
            id: lojaSnap.id,
            ...lojaSnap.data(),
          } as Loja);
        }
      }

      setLojas(lojasCarregadas);
    } catch (error) {
      console.log(error);
      Alert.alert("Erro", "Não foi possível carregar as lojas.");
    }
  }

  useEffect(() => {
    carregarDadosPromotor();
  }, []);

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
          marginBottom: 10,
        }}
      >
        Área do Promotor
      </Text>

      <Text
        style={{
          color: "#aaa",
          fontSize: 16,
          marginBottom: 25,
        }}
      >
        Olá, {nome || "promotor"}
      </Text>

      <Text
        style={{
          color: "white",
          fontSize: 20,
          fontWeight: "bold",
          marginBottom: 15,
        }}
      >
        Minhas Lojas
      </Text>

      <FlatList
        data={lojas}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ color: "#888", marginTop: 10 }}>
            Nenhuma loja vinculada ao seu usuário.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: "#1E1E1E",
              padding: 15,
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontWeight: "bold",
              }}
            >
              🏪 {item.nome}
            </Text>

            <Text
              style={{
                color: "#aaa",
                marginTop: 5,
                marginBottom: 15,
              }}
            >
              📍 {item.cidade} - {item.estado}
            </Text>

            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/enviar_foto",
                  params: {
                    lojaId: item.id,
                    lojaNome: item.nome,
                  },
                } as any)
              }
              style={{
                backgroundColor: "#2563EB",
                padding: 12,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: "white",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                Enviar Foto
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity
        onPress={() => router.replace("/" as any)}
        style={{
          backgroundColor: "#444",
          padding: 15,
          borderRadius: 10,
          marginTop: 10,
        }}
      >
        <Text
          style={{
            color: "white",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Sair
        </Text>
      </TouchableOpacity>
    </View>
  );
}
