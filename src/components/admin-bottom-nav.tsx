import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { ROTAS } from "../constants/routes";
import { useTheme } from "../theme/theme-context";

export type AbaAtiva =
  | "dashboard"
  | "fotos"
  | "promotores"
  | "lojas"
  | "admins";

type Props = {
  abaAtiva: AbaAtiva | null;
  tipoUsuario: "admin" | "super_admin";
};

export default function AdminBottomNav({ abaAtiva, tipoUsuario }: Props) {
  const { colors, scheme } = useTheme();
  const corBorda =
    scheme === "light" ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";
  const sombra =
    scheme === "light"
      ? "0 2px 10px rgba(15,23,42,0.06)"
      : "0 2px 10px rgba(0,0,0,0.35)";

  const abasBase: {
    chave: AbaAtiva;
    titulo: string;
    icone: keyof typeof MaterialIcons.glyphMap;
    cor: string;
    onPress: () => void;
  }[] = [
    {
      chave: "dashboard",
      titulo: "Dashboard",
      icone: "dashboard",
      cor: "#2563EB",
      onPress: () => router.push(ROTAS.admin),
    },
    {
      chave: "fotos",
      titulo: "Fotos",
      icone: "photo-library",
      cor: "#0EA5E9",
      onPress: () => router.push(ROTAS.verFotos),
    },
    {
      chave: "promotores",
      titulo: "Promotores",
      icone: "groups",
      cor: "#7C3AED",
      onPress: () => router.push(ROTAS.gerenciarPromotores),
    },
    {
      chave: "lojas",
      titulo: "Lojas",
      icone: "store",
      cor: "#16A34A",
      onPress: () => router.push(ROTAS.verLojas),
    },
  ];

  const abas =
    tipoUsuario === "super_admin"
      ? [
          ...abasBase,
          {
            chave: "admins" as AbaAtiva,
            titulo: "Admins",
            icone: "admin-panel-settings" as keyof typeof MaterialIcons.glyphMap,
            cor: "#EA580C",
            onPress: () => router.push(ROTAS.gerenciarAdmins),
          },
        ]
      : abasBase;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 18,
        left: 14,
        right: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: corBorda,
        borderRadius: 14,
        paddingTop: 10,
        paddingBottom: 10,
        paddingHorizontal: 8,
        flexDirection: "row",
        boxShadow: sombra,
      }}
    >
      {abas.map((aba) => {
        const ativo = aba.chave === abaAtiva;
        return (
          <ItemNav
            key={aba.chave}
            ativo={ativo}
            cor={aba.cor}
            icone={aba.icone}
            titulo={aba.titulo}
            corSubtle={colors.textSubtle}
            onPress={aba.onPress}
          />
        );
      })}
    </View>
  );
}

// Escalas do ícone — inativo = 1, ativo = 1.18 (com overshoot 1.32 ao virar ativo)
const ESCALA_INATIVA = 1;
const ESCALA_ATIVA = 1.18;
const ESCALA_OVERSHOOT = 1.32;

function ItemNav({
  ativo,
  cor,
  icone,
  titulo,
  corSubtle,
  onPress,
}: {
  ativo: boolean;
  cor: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  titulo: string;
  corSubtle: string;
  onPress: () => void;
}) {
  // Animação "gota d'água" estilo iOS: ao virar ativa, o ícone faz um overshoot
  // (salta pra 1.32) e assenta em 1.18 com spring. O indicador embaixo expande.
  const escalaIndicador = useSharedValue(ativo ? 1 : 0);
  const escalaIcone = useSharedValue(ativo ? ESCALA_ATIVA : ESCALA_INATIVA);
  const elevacaoIcone = useSharedValue(ativo ? -2 : 0);

  useEffect(() => {
    if (ativo) {
      // Indicador embaixo expande do centro
      escalaIndicador.value = 0;
      escalaIndicador.value = withSpring(1, {
        damping: 10,
        stiffness: 180,
        mass: 0.8,
      });

      // Ícone: salto + spring (sensação de gota caindo)
      escalaIcone.value = withSequence(
        withTiming(ESCALA_OVERSHOOT, { duration: 150 }),
        withSpring(ESCALA_ATIVA, {
          damping: 7,
          stiffness: 200,
          mass: 0.7,
        }),
      );

      // Leve elevação (translateY negativo) pra parecer destacado
      elevacaoIcone.value = withSpring(-2, {
        damping: 10,
        stiffness: 180,
      });
    } else {
      escalaIndicador.value = withTiming(0, { duration: 180 });
      escalaIcone.value = withSpring(ESCALA_INATIVA, {
        damping: 12,
        stiffness: 200,
      });
      elevacaoIcone.value = withTiming(0, { duration: 180 });
    }
  }, [ativo, elevacaoIcone, escalaIcone, escalaIndicador]);

  const estiloIndicador = useAnimatedStyle(() => ({
    transform: [{ scaleX: escalaIndicador.value }],
    opacity: escalaIndicador.value,
  }));

  const estiloIcone = useAnimatedStyle(() => ({
    transform: [
      { translateY: elevacaoIcone.value },
      { scale: escalaIcone.value },
    ],
  }));

  return (
    <Pressable
      onPress={ativo ? undefined : onPress}
      disabled={ativo}
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 4,
        paddingHorizontal: 2,
        gap: 3,
      }}
    >
      <Animated.View style={estiloIcone}>
        <MaterialIcons name={icone} size={26} color={cor} />
      </Animated.View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{
          color: ativo ? cor : corSubtle,
          fontSize: 10,
          fontWeight: ativo ? "bold" : "normal",
        }}
      >
        {titulo}
      </Text>
      <Animated.View
        style={[
          {
            width: 20,
            height: 2,
            borderRadius: 1,
            backgroundColor: cor,
            marginTop: 2,
          },
          estiloIndicador,
        ]}
      />
    </Pressable>
  );
}
