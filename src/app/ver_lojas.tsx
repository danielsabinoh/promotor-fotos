import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

type Loja = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
};

export default function VerLojas() {
  const [lojas, setLojas] = useState<Loja[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "lojas"), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Loja[];

      setLojas(lista);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#121212", padding: 20 }}>
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "bold",
          marginTop: 60,
          marginBottom: 20,
        }}
      >
        Lojas Cadastradas
      </Text>

      <FlatList
        data={lojas}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ color: "#888", marginTop: 20 }}>
            Nenhuma loja cadastrada ainda.
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
            <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
              🏪 {item.nome}
            </Text>

            <Text style={{ color: "#aaa", marginTop: 5 }}>
              📍 {item.cidade} - {item.estado}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          backgroundColor: "#444",
          padding: 15,
          borderRadius: 10,
          marginTop: 10,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          Voltar
        </Text>
      </TouchableOpacity>
    </View>
  );
}
