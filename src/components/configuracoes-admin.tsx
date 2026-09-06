import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/theme-context";
import { useTipoUsuario } from "../contexts/usuario-context";
import AdminBottomNav from "./admin-bottom-nav";
import GerenciarCategorias from "./gerenciar-categorias";

export default function ConfiguracoesAdmin({ children, painel = false }: { children: ReactNode; painel?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tipoUsuario = useTipoUsuario();
  const [aba, setAba] = useState<"perfil" | "categorias">("perfil");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: painel ? 0 : insets.top, paddingBottom: painel ? 0 : 100 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 26, fontWeight: "bold", padding: 20 }}>Configuracoes</Text>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border, marginHorizontal: 20 }}>
        {([
          { valor: "perfil", nome: "Meu perfil", icone: "person-outline" },
          { valor: "categorias", nome: "Categorias", icone: "label-outline" },
        ] as const).map((item) => (
          <Pressable key={item.valor} accessibilityRole="tab" accessibilityState={{ selected: aba === item.valor }} onPress={() => setAba(item.valor)}
            style={{ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              borderBottomWidth: 2, borderBottomColor: aba === item.valor ? colors.primary : "transparent" }}>
            <MaterialIcons name={item.icone} size={22} color={aba === item.valor ? colors.primary : colors.textSubtle} />
            <Text style={{ color: aba === item.valor ? colors.primary : colors.textSubtle, fontWeight: "bold" }}>{item.nome}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1, display: aba === "perfil" ? "flex" : "none" }}>{children}</View>
      {aba === "categorias" ? <GerenciarCategorias /> : null}
      {!painel ? <AdminBottomNav abaAtiva={null} tipoUsuario={tipoUsuario} /> : null}
    </View>
  );
}
