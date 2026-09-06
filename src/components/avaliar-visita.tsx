import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { avaliarFotosDaVisita } from "../services/notificacoes";
import { useTheme } from "../theme/theme-context";
import type { StatusAvaliacao } from "../types/avaliacao-foto";
import type { VisitaFotos } from "../utils/visitas-fotos";

const OPCOES: {
  status: StatusAvaliacao;
  titulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  cor: "success" | "warning" | "danger";
}[] = [
  { status: "aprovada", titulo: "Aprovar todas", icone: "done-all", cor: "success" },
  { status: "refazer", titulo: "Refazer todas", icone: "replay", cor: "warning" },
  { status: "rejeitada", titulo: "Rejeitar todas", icone: "cancel", cor: "danger" },
];

export default function AvaliarVisita({ visita, onFechar }: { visita: VisitaFotos; onFechar: () => void }) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<StatusAvaliacao | null>(null);
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const exigeComentario = status === "refazer" || status === "rejeitada";
  const loja = visita.fotos[0]?.lojaNome || "loja nao informada";

  async function confirmar() {
    if (!status || salvando) return;
    if (exigeComentario && !comentario.trim()) {
      setErro("Informe o motivo para orientar o promotor.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await avaliarFotosDaVisita(visita.fotos, status, comentario);
      onFechar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel avaliar a visita.");
    } finally {
      setSalvando(false);
    }
  }

  return <Modal transparent visible animationType="fade" onRequestClose={() => { if (!salvando) onFechar(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.overlay }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <View style={{ width: "100%", maxWidth: 480, borderRadius: 8, backgroundColor: colors.surface, padding: 22, gap: 16 }}>
        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold" }}>Avaliar visita</Text>
          <Text style={{ color: colors.textMuted, lineHeight: 21 }}>
            A decisao sera aplicada a todas as fotos ({visita.fotos.length}) da visita de {loja}{visita.correspondentes.length < visita.fotos.length ? ", inclusive as que nao correspondem aos filtros" : ""}.
          </Text>
        </View>

        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {OPCOES.map((opcao) => {
            const selecionada = status === opcao.status;
            const cor = colors[opcao.cor];
            return <Pressable key={opcao.status} accessibilityRole="radio" accessibilityState={{ checked: selecionada, disabled: salvando }}
              disabled={salvando} onPress={() => { setStatus(opcao.status); setErro(null); }}
              style={{ minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: selecionada ? cor : colors.borderStrong, backgroundColor: selecionada ? colors[`${opcao.cor}Surface`] : colors.surfaceHighlight, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialIcons name={opcao.icone} size={22} color={cor} />
              <Text style={{ flex: 1, color: selecionada ? cor : colors.text, fontWeight: "bold" }}>{opcao.titulo}</Text>
              <MaterialIcons name={selecionada ? "radio-button-checked" : "radio-button-unchecked"} size={20} color={selecionada ? cor : colors.iconMuted} />
            </Pressable>;
          })}
        </View>

        {exigeComentario ? <View style={{ gap: 7 }}>
          <Text style={{ color: colors.text, fontWeight: "bold" }}>Motivo</Text>
          <TextInput value={comentario} onChangeText={(valor) => { setComentario(valor); setErro(null); }} editable={!salvando}
            placeholder={status === "refazer" ? "Explique o que precisa ser refeito" : "Explique o motivo da rejeicao"}
            placeholderTextColor={colors.placeholder} multiline textAlignVertical="top"
            style={{ minHeight: 96, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, color: colors.text, backgroundColor: colors.backgroundAlt }} />
        </View> : null}

        {erro ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{erro}</Text> : null}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <Pressable accessibilityRole="button" disabled={salvando} onPress={onFechar} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}>
            <Text style={{ color: colors.textMuted }}>Cancelar</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!status || salvando} onPress={confirmar}
            style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, backgroundColor: colors.primary, borderRadius: 8, opacity: !status || salvando ? 0.45 : 1 }}>
            {salvando ? <ActivityIndicator color={colors.primaryText} /> : <MaterialIcons name="fact-check" size={21} color={colors.primaryText} />}
            <Text style={{ color: colors.primaryText, fontWeight: "bold" }}>{salvando ? "Salvando..." : "Confirmar avaliacao"}</Text>
          </Pressable>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}
