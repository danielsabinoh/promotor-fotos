import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Appearance,
  useColorScheme as useSystemColorScheme,
  type ColorSchemeName,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { palettes, type ColorScheme, type ThemeColors } from "./colors";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeMode;
  scheme: ColorScheme;
  colors: ThemeColors;
  carregando: boolean;
  setMode: (mode: ThemeMode) => void;
};

const CHAVE_ARMAZENAMENTO = "@promotor-fotos:tema";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolverScheme(mode: ThemeMode, sistema: ColorSchemeName): ColorScheme {
  if (mode === "system") {
    return sistema === "light" ? "light" : "dark";
  }
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const sistema = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    AsyncStorage.getItem(CHAVE_ARMAZENAMENTO)
      .then((valor) => {
        if (!ativo) return;
        if (valor === "light" || valor === "dark" || valor === "system") {
          setModeState(valor);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  // Garante atualização imediata quando o sistema muda enquanto o app está aberto.
  useEffect(() => {
    if (mode !== "system") return;

    const inscricao = Appearance.addChangeListener(() => {
      // Forçar re-render setando o mesmo valor — useSystemColorScheme já reage,
      // mas isso garante consistência em alguns dispositivos antigos.
      setModeState((atual) => atual);
    });

    return () => inscricao.remove();
  }, [mode]);

  function setMode(novoModo: ThemeMode) {
    setModeState(novoModo);
    AsyncStorage.setItem(CHAVE_ARMAZENAMENTO, novoModo).catch(() => undefined);
  }

  const valor = useMemo<ThemeContextValue>(() => {
    const scheme = resolverScheme(mode, sistema ?? null);
    return {
      mode,
      scheme,
      colors: palettes[scheme],
      carregando,
      setMode,
    };
  }, [mode, sistema, carregando]);

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const contexto = useContext(ThemeContext);

  if (!contexto) {
    throw new Error("useTheme precisa ser usado dentro de <ThemeProvider>.");
  }

  return contexto;
}
