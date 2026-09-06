import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polyline,
  Rect,
  Stop,
  Text as SvgTextNative,
} from "react-native-svg";

import AdminBottomNav from "@/components/admin-bottom-nav";
import { ROTAS } from "@/constants/routes";
import { useTipoUsuario, useUsuarioAtual } from "@/contexts/usuario-context";
import { auth } from "@/services/firebaseConfig";
import { fotosCollection } from "@/services/fotos-service";
import { lojasCollection } from "@/services/lojas-service";
import { consultaPromotores } from "@/services/usuarios-service";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/theme-context";
import type { Foto } from "@/types/foto";
import { ehHoje, obterData } from "@/utils/datas";
import { filtrarFotosAtuais } from "@/utils/fotos";

type AtividadeRecente = {
  id: string;
  titulo: string;
  detalhe: string;
  data: Date | null;
  icone: keyof typeof MaterialIcons.glyphMap;
  cor: string;
  rota?: any;
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

type Periodo =
  | "hoje"
  | "7dias"
  | "15dias"
  | "30dias"
  | "3meses"
  | "6meses"
  | "12meses"
  | "esteAno"
  | "anoPassado";

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7dias", rotulo: "Últimos 7 dias" },
  { valor: "15dias", rotulo: "Últimos 15 dias" },
  { valor: "30dias", rotulo: "Últimos 30 dias" },
  { valor: "3meses", rotulo: "Últimos 3 meses" },
  { valor: "6meses", rotulo: "Últimos 6 meses" },
  { valor: "12meses", rotulo: "Últimos 12 meses" },
  { valor: "esteAno", rotulo: "Este ano" },
  { valor: "anoPassado", rotulo: "Ano passado" },
];

const PALETAS_ADMIN = {
  azul: {
    gradiente: ["#5E96F7", "#1E40AF"] as [string, string],
    texto: "#2563EB",
  },
  verde: {
    gradiente: ["#34D399", "#059669"] as [string, string],
    texto: "#16A34A",
  },
  roxo: {
    gradiente: ["#A78BFA", "#6D28D9"] as [string, string],
    texto: "#7C3AED",
  },
  laranja: {
    gradiente: ["#FB923C", "#DC2626"] as [string, string],
    texto: "#EA580C",
  },
};

function rotuloDoPeriodo(p: Periodo) {
  return PERIODOS.find((item) => item.valor === p)?.rotulo || "Período";
}

/**
 * Gera a série do gráfico com agregação automática conforme o período:
 * - Hoje → por hora (12 buckets de 2h)
 * - 7/15/30 dias → por dia
 * - 3/6 meses → por semana
 * - 12 meses / Este ano / Ano passado → por mês
 */
function gerarSerieGrafico(
  periodo: Periodo,
  fotos: Foto[],
): { rotulo: string; valor: number }[] {
  type Bucket = { rotulo: string; inicio: Date; fim: Date; valor: number };
  const agora = new Date();
  const buckets: Bucket[] = [];

  if (periodo === "hoje") {
    const hoje00 = new Date(agora);
    hoje00.setHours(0, 0, 0, 0);
    for (let h = 0; h < 24; h += 2) {
      const inicio = new Date(hoje00);
      inicio.setHours(h);
      const fim = new Date(inicio);
      fim.setHours(h + 2);
      buckets.push({
        rotulo: h % 6 === 0 ? `${String(h).padStart(2, "0")}h` : "",
        inicio,
        fim,
        valor: 0,
      });
    }
  } else if (
    periodo === "7dias" ||
    periodo === "15dias" ||
    periodo === "30dias"
  ) {
    const dias = periodo === "7dias" ? 7 : periodo === "15dias" ? 15 : 30;
    const hoje00 = new Date(agora);
    hoje00.setHours(0, 0, 0, 0);
    for (let i = dias - 1; i >= 0; i--) {
      const inicio = new Date(hoje00);
      inicio.setDate(inicio.getDate() - i);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 1);

      let rotulo = "";
      if (dias === 7) {
        rotulo = i === 0 ? "Hoje" : DIAS_SEMANA[inicio.getDay()];
      } else if (dias === 15) {
        rotulo =
          i % 2 === 0 ? `${inicio.getDate()}/${inicio.getMonth() + 1}` : "";
      } else {
        rotulo =
          i % 5 === 0 ? `${inicio.getDate()}/${inicio.getMonth() + 1}` : "";
      }
      buckets.push({ rotulo, inicio, fim, valor: 0 });
    }
  } else if (periodo === "3meses" || periodo === "6meses") {
    const semanas = periodo === "3meses" ? 13 : 26;
    const inicioSemanaAtual = new Date(agora);
    inicioSemanaAtual.setHours(0, 0, 0, 0);
    const diaSemana = inicioSemanaAtual.getDay();
    const diffSeg = diaSemana === 0 ? -6 : 1 - diaSemana;
    inicioSemanaAtual.setDate(inicioSemanaAtual.getDate() + diffSeg);

    for (let i = semanas - 1; i >= 0; i--) {
      const inicio = new Date(inicioSemanaAtual);
      inicio.setDate(inicio.getDate() - i * 7);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 7);

      const cada = semanas === 13 ? 2 : 4;
      const rotulo =
        i % cada === 0 ? `${inicio.getDate()}/${inicio.getMonth() + 1}` : "";
      buckets.push({ rotulo, inicio, fim, valor: 0 });
    }
  } else {
    // 12meses / esteAno / anoPassado → por mês
    let inicioPeriodo: Date;
    let fimPeriodo: Date;

    if (periodo === "12meses") {
      fimPeriodo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
      inicioPeriodo = new Date(fimPeriodo);
      inicioPeriodo.setMonth(inicioPeriodo.getMonth() - 12);
    } else if (periodo === "esteAno") {
      inicioPeriodo = new Date(agora.getFullYear(), 0, 1);
      fimPeriodo = new Date(agora.getFullYear() + 1, 0, 1);
    } else {
      inicioPeriodo = new Date(agora.getFullYear() - 1, 0, 1);
      fimPeriodo = new Date(agora.getFullYear(), 0, 1);
    }

    const cursor = new Date(inicioPeriodo);
    while (cursor < fimPeriodo) {
      const inicio = new Date(cursor);
      const fim = new Date(cursor);
      fim.setMonth(fim.getMonth() + 1);
      buckets.push({
        rotulo: MESES[inicio.getMonth()],
        inicio,
        fim,
        valor: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  fotos.forEach((foto) => {
    const data = obterData(foto.criadoEm);
    if (!data) return;
    const ts = data.getTime();
    const idx = buckets.findIndex(
      (b) => ts >= b.inicio.getTime() && ts < b.fim.getTime(),
    );
    if (idx >= 0) buckets[idx].valor += 1;
  });

  return buckets.map((b) => ({ rotulo: b.rotulo, valor: b.valor }));
}

export default function Admin() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const tipoUsuario = useTipoUsuario();
  const { perfil } = useUsuarioAtual();
  const [totalLojas, setTotalLojas] = useState(0);
  const [totalPromotores, setTotalPromotores] = useState(0);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [lojasRecentes, setLojasRecentes] = useState<
    { id: string; nome: string; criadoEm: any }[]
  >([]);
  const [promotoresRecentes, setPromotoresRecentes] = useState<
    { id: string; nome: string; email: string; criadoEm: any }[]
  >([]);
  const [periodo, setPeriodo] = useState<Periodo>("7dias");
  const [seletorPeriodoAberto, setSeletorPeriodoAberto] = useState(false);
  const [agora, setAgora] = useState(0);
  const nome = perfil?.nome || "Administrador";

  useEffect(() => {
    if (!perfil) return;
    if (!perfil.ativo) {
      signOut(auth).catch(() => undefined);
      router.replace(ROTAS.login);
      return;
    }
    if (perfil.tipo !== "admin" && perfil.tipo !== "super_admin") {
      router.replace(ROTAS.promotor);
      return;
    }
  }, [perfil]);

  useEffect(() => {
    const atualizarAgora = () => setAgora(Date.now());
    const timeoutId = setTimeout(atualizarAgora, 0);
    const intervalId = setInterval(atualizarAgora, 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return onSnapshot(lojasCollection(), (snapshot) => {
      setTotalLojas(snapshot.size);
      const lista = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          nome: doc.data().nome || "Loja",
          criadoEm: doc.data().criadoEm,
        }))
        .sort(
          (a, b) =>
            (obterData(b.criadoEm)?.getTime() || 0) -
            (obterData(a.criadoEm)?.getTime() || 0),
        )
        .slice(0, 5);
      setLojasRecentes(lista);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(consultaPromotores(), (snapshot) => {
      const ativos = snapshot.docs.filter(
        (item) => item.data().ativo !== false,
      );
      setTotalPromotores(ativos.length);

      const lista = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          nome: doc.data().nome || doc.data().email || "Promotor",
          email: doc.data().email || "",
          criadoEm: doc.data().criadoEm,
        }))
        .sort(
          (a, b) =>
            (obterData(b.criadoEm)?.getTime() || 0) -
            (obterData(a.criadoEm)?.getTime() || 0),
        )
        .slice(0, 5);
      setPromotoresRecentes(lista);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(fotosCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Foto[];
      setFotos(filtrarFotosAtuais(lista));
    });
  }, []);

  const resumo = useMemo(() => {
    const fotosHoje = fotos.filter((foto) => ehHoje(foto.criadoEm)).length;
    const pendentes = fotos.filter(
      (foto) => (foto.status || "pendente") === "pendente",
    ).length;
    return { fotosHoje, pendentes };
  }, [fotos]);

  // Contador do sino: fotos pendentes + refações não atendidas há +2 dias
  const totalNotificacoes = useMemo(() => {
    const limite = 2 * 24 * 60 * 60 * 1000;
    const idsRefeitas = new Set(
      fotos.filter((f) => f.refacaoDeId).map((f) => f.refacaoDeId as string),
    );
    const refacoesPendentes = fotos.filter((f) => {
      if (f.status !== "refazer") return false;
      if (idsRefeitas.has(f.id)) return false;
      const data = obterData(f.avaliadaEm) || obterData(f.criadoEm);
      if (!data) return false;
      return agora - data.getTime() >= limite;
    }).length;
    return resumo.pendentes + refacoesPendentes;
  }, [agora, fotos, resumo.pendentes]);

  const serieGrafico = useMemo(
    () => gerarSerieGrafico(periodo, fotos),
    [fotos, periodo],
  );

  const atividades = useMemo<AtividadeRecente[]>(() => {
    const itens: AtividadeRecente[] = [];

    lojasRecentes.forEach((loja) => {
      itens.push({
        id: `loja-${loja.id}`,
        titulo: "Nova loja cadastrada",
        detalhe: loja.nome,
        data: obterData(loja.criadoEm),
        icone: "store",
        cor: PALETAS_ADMIN.verde.texto,
        rota: ROTAS.verLojas,
      });
    });

    promotoresRecentes.forEach((promotor) => {
      itens.push({
        id: `promotor-${promotor.id}`,
        titulo: "Novo promotor cadastrado",
        detalhe: promotor.nome,
        data: obterData(promotor.criadoEm),
        icone: "person-add",
        cor: PALETAS_ADMIN.roxo.texto,
        rota: ROTAS.gerenciarPromotores,
      });
    });

    if (resumo.pendentes > 0) {
      itens.push({
        id: "pendentes",
        titulo: "Pendência identificada",
        detalhe: `${resumo.pendentes} foto(s) aguardando avaliação`,
        data: new Date(),
        icone: "error-outline",
        cor: PALETAS_ADMIN.laranja.texto,
        rota: ROTAS.verFotos,
      });
    }

    return itens
      .filter((item) => item.data)
      .sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0))
      .slice(0, 4);
  }, [lojasRecentes, promotoresRecentes, resumo.pendentes]);

  const iniciaisAvatar = (nome || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 1)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");

  const compacto = width < 720;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 110,
          gap: 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.text,
                fontSize: 28,
                fontWeight: "bold",
              }}
            >
              Olá, {nome.split(" ")[0] || "Admin"}!
            </Text>
            <Text style={{ color: colors.textSubtle, fontSize: 14 }}>
              {tipoUsuario === "super_admin"
                ? "Administrador principal"
                : "Gerenciador de Promotores"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => router.push(ROTAS.notificacoesAdmin)}
              accessibilityLabel="Abrir notificações"
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons
                name={
                  totalNotificacoes > 0
                    ? "notifications-none"
                    : "notifications-none"
                }
                size={28}
                color={colors.text}
              />
              {totalNotificacoes > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: "#DC2626",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontSize: 10,
                      fontWeight: "bold",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {totalNotificacoes > 9 ? "9+" : totalNotificacoes}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => router.push(ROTAS.configuracoesAdmin)}
              accessibilityLabel="Abrir configuracoes e perfil"
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors.primaryText,
                  fontSize: 18,
                  fontWeight: "bold",
                }}
              >
                {iniciaisAvatar}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* VISÃO GERAL */}
        <View style={{ gap: 12 }}>
          <Text
            style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}
          >
            Visão geral
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <KpiCard
              colors={colors}
              titulo="Fotos hoje"
              valor={resumo.fotosHoje}
              subtitulo="Novas fotos enviadas"
              icone="photo-camera"
              paleta={PALETAS_ADMIN.azul}
              compacto={compacto}
            />
            <KpiCard
              colors={colors}
              titulo="Lojas cadastradas"
              valor={totalLojas}
              subtitulo="Total de lojas"
              icone="store"
              paleta={PALETAS_ADMIN.verde}
              compacto={compacto}
            />
            <KpiCard
              colors={colors}
              titulo="Promotores"
              valor={totalPromotores}
              subtitulo="Total de promotores"
              icone="groups"
              paleta={PALETAS_ADMIN.roxo}
              compacto={compacto}
            />
            <KpiCard
              colors={colors}
              titulo="Pendências"
              valor={resumo.pendentes}
              subtitulo="Itens pendentes"
              icone="error-outline"
              paleta={PALETAS_ADMIN.laranja}
              compacto={compacto}
            />
          </View>
        </View>

        {/* GRÁFICO 7 DIAS */}
        <Card colors={colors}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              paddingBottom: 12,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 14,
                fontWeight: "bold",
              }}
            >
              Fotos enviadas por dia
            </Text>
            <Pressable
              onPress={() => setSeletorPeriodoAberto(true)}
              accessibilityLabel="Selecionar período"
              style={{
                flexShrink: 0,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: colors.surfaceElevated,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {rotuloDoPeriodo(periodo)}
              </Text>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={16}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
          <GraficoLinha colors={colors} dados={serieGrafico} />
        </Card>

        <SeletorPeriodo
          colors={colors}
          visivel={seletorPeriodoAberto}
          valor={periodo}
          onSelecionar={(novo) => {
            setPeriodo(novo);
            setSeletorPeriodoAberto(false);
          }}
          onFechar={() => setSeletorPeriodoAberto(false)}
        />

        {/* ATIVIDADES */}
        <Card colors={colors}>
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: "bold",
              paddingBottom: 14,
            }}
          >
            Atividades recentes
          </Text>
          {atividades.length === 0 ? (
            <Text style={{ color: colors.textSubtle, paddingVertical: 16 }}>
              Sem atividades recentes.
            </Text>
          ) : (
            atividades.map((item, indice) => (
              <Pressable
                key={item.id}
                onPress={() => item.rota && router.push(item.rota)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingVertical: 12,
                  borderTopWidth: indice === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <MaterialIcons name={item.icone} size={26} color={item.cor} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "bold" }}>
                    {item.titulo}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.textSubtle,
                      fontSize: 13,
                      paddingTop: 2,
                    }}
                  >
                    {item.detalhe}
                  </Text>
                </View>
                <Text style={{ color: colors.textSubtle, fontSize: 12 }}>
                  {item.data ? tempoRelativo(item.data) : "Agora"}
                </Text>
              </Pressable>
            ))
          )}
        </Card>

        {/* AÇÕES RÁPIDAS */}
        <Card colors={colors}>
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: "bold",
              paddingBottom: 14,
            }}
          >
            Ações rápidas
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <BotaoAcao
              colors={colors}
              titulo="Novo promotor"
              icone="person-add"
              cor={PALETAS_ADMIN.azul.texto}
              onPress={() => router.push(ROTAS.cadastroPromotor)}
            />
            <BotaoAcao
              colors={colors}
              titulo="Nova loja"
              icone="add-business"
              cor={PALETAS_ADMIN.verde.texto}
              onPress={() => router.push(ROTAS.cadastroLoja)}
            />
            {tipoUsuario === "super_admin" ? (
              <BotaoAcao
                colors={colors}
                titulo="Novo administrador"
                icone="admin-panel-settings"
                cor={PALETAS_ADMIN.roxo.texto}
                onPress={() => router.push(ROTAS.cadastroAdmin)}
              />
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <AdminBottomNav abaAtiva="dashboard" tipoUsuario={tipoUsuario} />
    </View>
  );
}

/* ---------- Componentes auxiliares ---------- */

function Card({
  colors,
  children,
}: {
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  const { scheme } = useTheme();
  const corBorda =
    scheme === "light" ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";
  const sombra =
    scheme === "light"
      ? "0 2px 10px rgba(15,23,42,0.06)"
      : "0 2px 10px rgba(0,0,0,0.35)";

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: corBorda,
        borderRadius: 12,
        padding: 16,
        boxShadow: sombra,
      }}
    >
      {children}
    </View>
  );
}

function KpiCard({
  colors,
  titulo,
  valor,
  subtitulo,
  icone,
  paleta,
  compacto,
}: {
  colors: ThemeColors;
  titulo: string;
  valor: number;
  subtitulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  paleta: { gradiente: [string, string]; texto: string };
  compacto: boolean;
}) {
  const { scheme } = useTheme();
  const corBorda =
    scheme === "light" ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";
  const sombra =
    scheme === "light"
      ? "0 2px 10px rgba(15,23,42,0.06)"
      : "0 2px 10px rgba(0,0,0,0.35)";

  return (
    <View
      style={{
        width: compacto ? "48%" : "23.5%",
        flexGrow: 1,
        minWidth: 152,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: corBorda,
        borderRadius: 12,
        padding: 14,
        gap: 10,
        boxShadow: sombra,
      }}
    >
      <IconeGradiente icone={icone} gradiente={paleta.gradiente} tamanho={56} />
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{titulo}</Text>
      <Text
        style={{
          color: paleta.texto,
          fontSize: 30,
          fontWeight: "bold",
          fontVariant: ["tabular-nums"],
          lineHeight: 36,
        }}
      >
        {valor}
      </Text>
      <Text style={{ color: colors.textSubtle, fontSize: 11 }}>
        {subtitulo}
      </Text>
    </View>
  );
}

function IconeGradiente({
  icone,
  gradiente,
  tamanho = 56,
}: {
  icone: keyof typeof MaterialIcons.glyphMap;
  gradiente: [string, string];
  tamanho?: number;
}) {
  // ID único pro defs do SVG (pra não conflitar quando vários gradientes coexistirem).
  const idGrad = `g-${gradiente[0]}-${gradiente[1]}`.replace(
    /[^a-zA-Z0-9]/g,
    "",
  );
  const raio = tamanho * 0.24;

  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Svg width={tamanho} height={tamanho}>
        <Defs>
          <LinearGradient id={idGrad} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradiente[0]} stopOpacity={1} />
            <Stop offset="1" stopColor={gradiente[1]} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={tamanho}
          height={tamanho}
          rx={raio}
          ry={raio}
          fill={`url(#${idGrad})`}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: tamanho,
          height: tamanho,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons
          name={icone}
          size={Math.round(tamanho * 0.55)}
          color="white"
        />
      </View>
    </View>
  );
}

function GraficoLinha({
  colors,
  dados,
}: {
  colors: ThemeColors;
  dados: { rotulo: string; valor: number }[];
}) {
  const { width: larguraTela } = useWindowDimensions();
  const largura = Math.min(larguraTela - 18 * 2 - 16 * 2, 720);
  const altura = 188;
  // Padding lateral igual nos dois lados (sem eixo Y) — gráfico centrado no card.
  const padLeft = 16;
  const padRight = 16;
  const padTop = 28;
  const padBottom = 32;
  // Offset visual: garante que pontos com valor 0 fiquem ligeiramente acima
  // da linha base, em vez de enterrados nos rótulos dos dias.
  const offsetBase = 8;

  const valores = dados.map((d) => d.valor);
  const maxValor = Math.max(...valores, 1);
  const niveis = 4;
  const stepValor = Math.ceil(maxValor / niveis) || 1;
  const topo = stepValor * niveis;

  const innerW = largura - padLeft - padRight;
  const innerH = altura - padTop - padBottom;
  const innerHUtil = innerH - offsetBase;

  const pontos = dados.map((d, i) => {
    const x = padLeft + (i / (dados.length - 1)) * innerW;
    const y = padTop + (1 - d.valor / topo) * innerHUtil;
    return { x, y, valor: d.valor, rotulo: d.rotulo };
  });

  const linha = pontos.map((p) => `${p.x},${p.y}`).join(" ");

  const baseY = padTop + innerHUtil;
  const areaPath = [
    `M ${pontos[0].x} ${baseY}`,
    ...pontos.map((p) => `L ${p.x} ${p.y}`),
    `L ${pontos[pontos.length - 1].x} ${baseY}`,
    "Z",
  ].join(" ");

  return (
    <View>
      <Svg width={largura} height={altura}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.25} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Linhas guia horizontais (sem rótulos numéricos) */}
        {Array.from({ length: niveis + 1 }, (_, i) => {
          const y = padTop + (i / niveis) * innerHUtil;
          return (
            <Path
              key={`grid-${i}`}
              d={`M ${padLeft} ${y} L ${largura - padRight} ${y}`}
              stroke={colors.border}
              strokeDasharray="2,4"
              strokeWidth={1}
              opacity={0.6}
            />
          );
        })}

        {/* Área sob a curva */}
        <Path d={areaPath} fill="url(#grad)" />

        {/* Linha */}
        <Polyline
          points={linha}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Pontos + valores */}
        {pontos.map((p, i) => (
          <>
            <Circle
              key={`circle-${i}`}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={colors.surface}
              stroke={colors.primary}
              strokeWidth={2.5}
            />
            <SvgText
              key={`valor-${i}`}
              x={p.x}
              y={p.y - 10}
              fill={colors.text}
              fontSize={11}
              fontWeight="bold"
              textAnchor="middle"
            >
              {p.valor}
            </SvgText>
          </>
        ))}

        {/* Rótulos dos dias */}
        {pontos.map((p, i) => (
          <SvgText
            key={`dia-${i}`}
            x={p.x}
            y={altura - 8}
            fill={i === pontos.length - 1 ? colors.primary : colors.textSubtle}
            fontSize={11}
            fontWeight={i === pontos.length - 1 ? "bold" : "normal"}
            textAnchor="middle"
          >
            {p.rotulo}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function BotaoAcao({
  colors,
  titulo,
  icone,
  cor,
  onPress,
}: {
  colors: ThemeColors;
  titulo: string;
  icone: keyof typeof MaterialIcons.glyphMap;
  cor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 160,
        minHeight: 64,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <MaterialIcons name={icone} size={22} color={cor} />
      <Text
        style={{ color: colors.text, fontWeight: "bold", fontSize: 14 }}
        numberOfLines={1}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

function SeletorPeriodo({
  colors,
  visivel,
  valor,
  onSelecionar,
  onFechar,
}: {
  colors: ThemeColors;
  visivel: boolean;
  valor: Periodo;
  onSelecionar: (p: Periodo) => void;
  onFechar: () => void;
}) {
  const { scheme } = useTheme();
  const sombra =
    scheme === "light"
      ? "0 18px 40px rgba(15,23,42,0.18)"
      : "0 18px 40px rgba(0,0,0,0.6)";

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <Pressable
        onPress={onFechar}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.45)",
          alignItems: "center",
          justifyContent: "center",
          padding: 22,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.06)",
            borderRadius: 14,
            paddingVertical: 8,
            boxShadow: sombra,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 14,
              fontWeight: "bold",
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 6,
            }}
          >
            Selecionar período
          </Text>
          {PERIODOS.map((item) => {
            const selecionado = item.valor === valor;
            return (
              <Pressable
                key={item.valor}
                onPress={() => onSelecionar(item.valor)}
                style={{
                  minHeight: 46,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: selecionado
                    ? colors.surfaceHighlight
                    : "transparent",
                }}
              >
                <Text
                  style={{
                    color: selecionado ? colors.primary : colors.text,
                    fontWeight: selecionado ? "bold" : "normal",
                    fontSize: 14,
                  }}
                >
                  {item.rotulo}
                </Text>
                {selecionado ? (
                  <MaterialIcons
                    name="check"
                    size={20}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Utilitários ---------- */

function tempoRelativo(data: Date) {
  const segundos = Math.floor((Date.now() - data.getTime()) / 1000);
  if (segundos < 60) return "Agora";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Há ${dias}d`;
  return data.toLocaleDateString("pt-BR");
}

// react-native-svg exporta Text como "Text" mesmo, mas conflita com Text de RN.
// Renomeamos no import abaixo.
const SvgText = SvgTextNative;
