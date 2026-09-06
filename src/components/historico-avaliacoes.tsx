import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { onSnapshot } from "firebase/firestore";

import { consultaAvaliacoesFoto } from "../services/notificacoes";
import { useTheme } from "../theme/theme-context";
import type { AvaliacaoFoto } from "../types/avaliacao-foto";
import type { Foto } from "../types/foto";
import { formatarDataHora } from "../utils/datas";
import { descricaoAvaliacao, textoRastreioFoto } from "../utils/visitas-fotos";

export function RastreioFoto({ foto }: { foto: Foto }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>{textoRastreioFoto(foto)}</Text>;
}

export default function HistoricoAvaliacoes({ foto }: { foto: Foto }) {
  const { colors } = useTheme();
  const [estado, setEstado] = useState<{ fotoId: string; itens: AvaliacaoFoto[]; erro: boolean } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => onSnapshot(consultaAvaliacoesFoto(foto.id), (snapshot) => {
    setEstado({ fotoId: foto.id, itens: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AvaliacaoFoto), erro: false });
  }, () => setEstado({ fotoId: foto.id, itens: [], erro: true })), [foto.id, tentativa]);
  const atual = estado?.fotoId === foto.id ? estado : null;
  return (
    <View style={{ gap: 12, borderTopWidth: 1, borderColor: colors.border, paddingTop: 16 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <MaterialIcons name="history" size={22} color={colors.primary} />
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "bold" }}>Historico de avaliacoes</Text>
      </View>
      <RastreioFoto foto={foto} />
      {!atual ? <ActivityIndicator color={colors.primary} /> : null}
      {atual?.erro ? <View style={{ gap: 6 }}>
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>Nao foi possivel carregar o historico.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setEstado(null); setTentativa((valor) => valor + 1); }} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: colors.primary }}>Tentar novamente</Text>
        </Pressable>
      </View> : null}
      {atual && !atual.erro && !atual.itens.length ? <Text style={{ color: colors.textSubtle }}>Nenhuma alteracao registrada no historico.</Text> : null}
      {atual?.itens.map((item) => <View key={item.id} style={{ borderLeftWidth: 2, borderColor: colors.border, paddingLeft: 12, gap: 5 }}>
        <Text style={{ color: colors.text, fontWeight: "bold" }}>{descricaoAvaliacao(item.status)} por {item.adminNome || "Administrador"}</Text>
        <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{formatarDataHora(item.criadoEm, "Sincronizando horario")}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Anterior: {descricaoAvaliacao(item.statusAnterior)}</Text>
        {item.comentario ? <Text style={{ color: colors.text, lineHeight: 20 }}>{item.comentario}</Text> : null}
      </View>)}
    </View>
  );
}
