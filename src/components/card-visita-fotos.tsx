import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View, type ViewToken } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "../theme/theme-context";
import type { Foto, StatusFoto } from "../types/foto";
import { obterCategoriaFoto, obterImagemUri } from "../utils/fotos";
import { formatarDataHora } from "../utils/datas";
import { textoStatusFoto, visualStatusPorTema } from "../utils/status-foto";
import { resumoStatusVisita, type VisitaFotos } from "../utils/visitas-fotos";
import { RastreioFoto } from "./historico-avaliacoes";

type Props = {
  visita: VisitaFotos;
  nomePromotor?: string;
  compacto?: boolean;
  bloqueado?: boolean;
  onAbrirFoto: (foto: Foto) => void;
  onVisualizarFoto?: (foto: Foto) => void;
  onMenuFoto?: (foto: Foto) => void;
  onAvaliarVisita: (visita: VisitaFotos) => void;
};

const CONFIGURACAO_VISIBILIDADE = { itemVisiblePercentThreshold: 60 };

export default function CardVisitaFotos({ visita, nomePromotor, compacto = false, bloqueado = false, onAbrirFoto, onVisualizarFoto, onMenuFoto, onAvaliarVisita }: Props) {
  const { colors, scheme } = useTheme();
  const [selecionada, setSelecionada] = useState(visita.correspondentes[0] || visita.fotos[0]?.id);
  const [largura, setLargura] = useState(0);
  const lista = useRef<FlatList<Foto>>(null);
  const visibilidade = useCallback(({ viewableItems }: { viewableItems: ViewToken<Foto>[] }) => {
    if (viewableItems[0]?.item) setSelecionada(viewableItems[0].item.id);
  }, []);
  const indice = Math.max(0, visita.fotos.findIndex((foto) => foto.id === selecionada));
  const foto = visita.fotos[indice];
  if (!foto) return null;
  const resumo = resumoStatusVisita(visita.fotos);
  const visual = visualStatusPorTema(foto.status, scheme);
  const altura = largura ? Math.min(largura * 0.85, compacto ? 200 : 430) : 260;
  const total = visita.fotos.length;

  function navegar(destino: number) {
    if (destino < 0 || destino >= total) return;
    lista.current?.scrollToOffset({ offset: destino * largura, animated: false });
    setSelecionada(visita.fotos[destino].id);
  }

  const botao = { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const };

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden" }}>
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MaterialIcons name="storefront" size={24} color={colors.success} />
          <Text style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 17, fontWeight: "bold" }}>{foto.lojaNome || "Loja nao informada"}</Text>
          <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{total} {total === 1 ? "foto" : "fotos"}</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 13 }}>{nomePromotor || foto.promotorNome || foto.promotorEmail || "Promotor nao identificado"}</Text>
        <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{visita.visitaId ? "Visita" : "Envio individual"} · {formatarDataHora(visita.fotos[0].criadoEm, "Sem data")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 5 }}>
          {(Object.keys(resumo) as StatusFoto[]).filter((status) => resumo[status] > 0).map((status) => (
            <Text key={status} style={{ color: visualStatusPorTema(status, scheme).texto, fontSize: 12 }}>{textoStatusFoto(status)}: {resumo[status]}</Text>
          ))}
        </View>
        {visita.correspondentes.length !== total ? <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{visita.correspondentes.length} de {total} fotos correspondem aos filtros</Text> : null}
      </View>

      <View onLayout={(event) => setLargura(Math.round(event.nativeEvent.layout.width))} style={{ height: altura, backgroundColor: colors.backgroundAlt }}>
        {largura > 0 ? <FlatList
          key={`${largura}:${visita.fotos.map((item) => item.id).join(",")}`}
          ref={lista} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          data={visita.fotos} keyExtractor={(item) => item.id}
          initialScrollIndex={indice} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
          getItemLayout={(_, index) => ({ index, length: largura, offset: largura * index })}
          viewabilityConfig={CONFIGURACAO_VISIBILIDADE} onViewableItemsChanged={visibilidade}
          renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir foto ${visita.fotos.indexOf(item) + 1} da visita`}
            onPress={() => (onVisualizarFoto || onAbrirFoto)(item)} style={{ width: largura, height: altura }}>
            <ImagemVisita key={obterImagemUri(item)} foto={item} />
          </Pressable>}
        /> : <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />}
      </View>

      <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Foto anterior" disabled={indice === 0} onPress={() => navegar(indice - 1)} style={[botao, { opacity: indice === 0 ? 0.3 : 1 }]}>
            <MaterialIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>Foto {indice + 1} de {total}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Proxima foto" disabled={indice === total - 1} onPress={() => navegar(indice + 1)} style={[botao, { opacity: indice === total - 1 ? 0.3 : 1 }]}>
            <MaterialIcons name="chevron-right" size={28} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ flex: 1, minWidth: 0, color: colors.text, fontWeight: "bold" }}>{obterCategoriaFoto(foto)}</Text>
          <Text style={{ color: visual.texto, fontWeight: "bold", fontSize: 12 }}>{textoStatusFoto(foto.status)}</Text>
        </View>
        {foto.refacaoDeId ? <Text style={{ color: colors.warning, fontSize: 12 }}>Refacao {foto.numeroRefacao || 1}</Text> : null}
        {foto.observacao ? <Text numberOfLines={compacto ? 2 : 4} style={{ color: colors.textMuted, lineHeight: 19 }}>{foto.observacao}</Text> : null}
        <RastreioFoto foto={foto} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 2 }}>
          <Pressable accessibilityRole="button" disabled={bloqueado} onPress={() => (onMenuFoto || onAbrirFoto)(foto)}
            style={{ minHeight: 44, flexDirection: "row", gap: 7, alignItems: "center", paddingHorizontal: 10, opacity: bloqueado ? 0.4 : 1 }}>
            <MaterialIcons name="fact-check" size={21} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "bold" }}>Avaliar foto</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Detalhes e historico da foto" onPress={() => onAbrirFoto(foto)} style={botao}>
            <MaterialIcons name="history" size={22} color={colors.textMuted} />
          </Pressable>
          <Pressable accessibilityRole="button" disabled={bloqueado} onPress={() => onAvaliarVisita(visita)}
            style={{ minHeight: 44, flexDirection: "row", gap: 7, alignItems: "center", paddingHorizontal: 10, opacity: bloqueado ? 0.4 : 1 }}>
            <MaterialIcons name="playlist-add-check" size={22} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "bold" }}>Avaliar visita</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ImagemVisita({ foto }: { foto: Foto }) {
  const { colors } = useTheme();
  const [erro, setErro] = useState(false);
  const uri = obterImagemUri(foto);
  if (!uri || erro) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
    <MaterialIcons name="broken-image" size={32} color={colors.iconMuted} />
    <Text style={{ color: colors.textMuted }}>Imagem indisponivel</Text>
  </View>;
  return <Image source={{ uri }} resizeMode="contain" onError={() => setErro(true)} style={{ width: "100%", height: "100%" }} />;
}
