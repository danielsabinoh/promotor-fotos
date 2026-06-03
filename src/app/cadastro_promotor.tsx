import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

type Loja = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
};

export default function CadastroPromotor() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);

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

  function alternarLoja(lojaId: string) {
    if (lojasSelecionadas.includes(lojaId)) {
      setLojasSelecionadas(lojasSelecionadas.filter((id) => id !== lojaId));
    } else {
      setLojasSelecionadas([...lojasSelecionadas, lojaId]);
    }
  }

  async function salvarPromotor() {
    try {
      if (!nome || !email || !senha) {
        Alert.alert("Atenção", "Preencha nome, email e senha.");
        return;
      }

      if (lojasSelecionadas.length === 0) {
        Alert.alert("Atenção", "Selecione pelo menos uma loja.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        senha,
      );

      const uid = userCredential.user.uid;

      await setDoc(doc(db, "usuarios", uid), {
        nome,
        email,
        tipo: "promotor",
        lojasIds: lojasSelecionadas,
        criadoEm: new Date(),
      });

      Alert.alert("Sucesso", "Promotor cadastrado com sucesso!");

      setNome("");
      setEmail("");
      setSenha("");
      setLojasSelecionadas([]);

      router.back();
    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro", error.message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#121212", padding: 20 }}>
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "bold",
          marginTop: 60,
          marginBottom: 25,
        }}
      >
        Cadastro de Promotor
      </Text>

      <TextInput
        placeholder="Nome completo"
        placeholderTextColor="#888"
        value={nome}
        onChangeText={setNome}
        style={input}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={input}
      />

      <TextInput
        placeholder="Senha provisória"
        placeholderTextColor="#888"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        style={input}
      />

      <Text
        style={{
          color: "white",
          fontSize: 18,
          fontWeight: "bold",
          marginBottom: 10,
        }}
      >
        Lojas permitidas
      </Text>

      <FlatList
        data={lojas}
        keyExtractor={(item) => item.id}
        style={{ marginBottom: 20 }}
        renderItem={({ item }) => {
          const selecionada = lojasSelecionadas.includes(item.id);

          return (
            <TouchableOpacity
              onPress={() => alternarLoja(item.id)}
              style={{
                backgroundColor: selecionada ? "#2563EB" : "#1E1E1E",
                padding: 15,
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                🏪 {item.nome}
              </Text>

              <Text style={{ color: "#ccc", marginTop: 4 }}>
                📍 {item.cidade} - {item.estado}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        onPress={salvarPromotor}
        style={{
          backgroundColor: "#9333EA",
          padding: 15,
          borderRadius: 10,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          Salvar Promotor
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
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          Voltar
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const input = {
  borderWidth: 1,
  borderColor: "#444",
  borderRadius: 8,
  padding: 12,
  marginBottom: 15,
  color: "white",
};
