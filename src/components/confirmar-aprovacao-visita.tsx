import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { aprovarFotosDaVisita } from "../services/notificacoes";
import { useTheme } from "../theme/theme-context";
import type { VisitaFotos } from "../utils/visitas-fotos";

export default function ConfirmarAprovacaoVisita({ visita, onFechar }: { visita: VisitaFotos; onFechar: () => void }) {
  const { colors } = useTheme();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function aprovar() {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      await aprovarFotosDaVisita(visita.fotos);
      onFechar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel aprovar a visita.");
    } finally {
      setSalvando(false);
    }
  }
  return <Modal transparent visible animationType="fade" onRequestClose={() => { if (!salvando) onFechar(); }}>
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.overlay, padding: 20 }}>
      <View style={{ width: "100%", maxWidth: 440, borderRadius: 8, backgroundColor: colors.surface, padding: 22, gap: 16 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold" }}>Aprovar visita?</Text>
        <Text style={{ color: colors.textMuted, lineHeight: 21 }}>Confirmar a aprovacao de todas as fotos ({visita.fotos.length}) desta visita de {visita.fotos[0]?.lojaNome || "loja nao informada"}{visita.correspondentes.length < visita.fotos.length ? ", incluindo as que nao correspondem aos filtros" : ""}?</Text>
        {erro ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{erro}</Text> : null}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <Pressable accessibilityRole="button" disabled={salvando} onPress={onFechar} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}>
            <Text style={{ color: colors.textMuted }}>Cancelar</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={salvando} onPress={aprovar} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, backgroundColor: colors.success, borderRadius: 8 }}>
            {salvando ? <ActivityIndicator color="white" /> : <MaterialIcons name="done-all" size={22} color="white" />}
            <Text style={{ color: "white", fontWeight: "bold" }}>{salvando ? "Aprovando..." : "Aprovar todas"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
