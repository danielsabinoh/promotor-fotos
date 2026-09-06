import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Host, Switch } from "@expo/ui";

import { useCategoriasFoto } from "../hooks/use-categorias-foto";
import { alterarCategoriaAtiva, cadastrarCategoria } from "../services/categorias-service";
import { useTheme } from "../theme/theme-context";
import { validarNomeCategoria, type CategoriaConfigurada } from "../utils/catalogo-categorias";

type Props = {
  categorias: CategoriaConfigurada[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
  cadastrar: (nome: string, ativa: boolean) => Promise<void>;
  alterarAtiva: (categoria: CategoriaConfigurada, ativa: boolean) => Promise<void>;
};

export default function GerenciarCategorias() {
  const catalogo = useCategoriasFoto();
  return <EditorCategorias {...catalogo} cadastrar={cadastrarCategoria} alterarAtiva={alterarCategoriaAtiva} />;
}

export function EditorCategorias({ categorias, carregando, erro, recarregar, cadastrar, alterarAtiva }: Props) {
  const { colors, scheme } = useTheme();
  const [nome, setNome] = useState("");
  const [novaAtiva, setNovaAtiva] = useState(true);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const bloqueado = carregando || !!erro || salvando !== null;
  const visiveis = categorias.filter((categoria) => categoria.nome.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR")));
  const ativas = categorias.filter((categoria) => categoria.ativa).length;

  async function executar(id: string, acao: () => Promise<void>, mensagem: string) {
    if (bloqueado) return;
    setSalvando(id);
    setErroAcao(null);
    setSucesso(null);
    try {
      await acao();
      setSucesso(mensagem);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Nao foi possivel salvar. Tente novamente.");
    } finally {
      setSalvando(null);
    }
  }

  const campo = {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.backgroundAlt,
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 24 }}>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: "bold" }}>Categorias de fotos</Text>
        <Text style={{ color: colors.textSubtle }}>{carregando ? "Carregando categorias..." : `${ativas} ativas de ${categorias.length}`}</Text>
      </View>

      {erro || erroAcao ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{erro || erroAcao}</Text> : null}
      {sucesso ? <Text accessibilityLiveRegion="polite" style={{ color: colors.success }}>{sucesso}</Text> : null}
      {erro ? (
        <Pressable onPress={recarregar} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
          <MaterialIcons name="refresh" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary }}>Tentar novamente</Text>
        </Pressable>
      ) : null}

      <View style={{ gap: 12, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 24 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "bold" }}>Nova categoria</Text>
        <TextInput accessibilityLabel="Nome da nova categoria" placeholder="Nome da categoria" placeholderTextColor={colors.placeholder}
          value={nome} onChangeText={setNome} maxLength={60} editable={!bloqueado} style={campo} />
        <Host matchContents colorScheme={scheme} seedColor={colors.primary}>
          <Switch label="Ativa para novos envios" value={novaAtiva} onValueChange={setNovaAtiva} disabled={bloqueado} />
        </Host>
        <Pressable accessibilityRole="button" disabled={bloqueado || !nome.trim()} onPress={() => executar("nova", async () => {
          const limpo = validarNomeCategoria(nome);
          await cadastrar(limpo, novaAtiva);
          setNome("");
          setNovaAtiva(true);
        }, "Categoria cadastrada.")}
          style={{ alignSelf: "flex-start", minHeight: 46, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.primary,
            opacity: bloqueado || !nome.trim() ? 0.5 : 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {salvando === "nova" ? <ActivityIndicator color={colors.primaryText} /> : <MaterialIcons name="add" size={22} color={colors.primaryText} />}
          <Text style={{ color: colors.primaryText, fontWeight: "bold" }}>{salvando === "nova" ? "Salvando..." : "Cadastrar categoria"}</Text>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <TextInput accessibilityLabel="Buscar categorias" placeholder="Buscar categorias" placeholderTextColor={colors.placeholder}
          value={busca} onChangeText={setBusca} style={campo} />
        {carregando ? <ActivityIndicator color={colors.primary} /> : null}
        {!carregando && !erro && !ativas ? <Text style={{ color: colors.textSubtle }}>Nenhuma categoria ativa para novos envios.</Text> : null}
        {!carregando && !erro && !visiveis.length ? <Text style={{ color: colors.textSubtle }}>Nenhuma categoria encontrada.</Text> : null}
        {visiveis.map((categoria) => (
          <View key={categoria.id} testID={`linha-categoria-${categoria.id}`} style={{ borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialIcons name={categoria.icone} size={24} color={categoria.ativa ? colors.primary : colors.iconMuted} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "bold", flexShrink: 1 }}>{categoria.nome}</Text>
                <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{categoria.padrao ? "Padrao" : "Personalizada"}</Text>
              </View>
              {salvando === categoria.id ? <ActivityIndicator color={colors.primary} /> : null}
            </View>
            <Host matchContents colorScheme={scheme} seedColor={colors.primary} accessibilityLabel={categoria.nome}>
              <Switch label={categoria.ativa ? "Ativa" : "Inativa"} testID={`categoria-${categoria.id}`} value={categoria.ativa} disabled={bloqueado}
                onValueChange={(ativa) => executar(categoria.id, () => alterarAtiva(categoria, ativa), `${categoria.nome}: ${ativa ? "ativada" : "desativada"}.`)} />
            </Host>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
