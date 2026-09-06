import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { onSnapshot } from "firebase/firestore";
import Animated, {
  FadeInUp,
  LinearTransition,
} from "react-native-reanimated";

import { emailParecePessoal } from "@/constants/acesso";
import { useUsuarioAtual } from "@/contexts/usuario-context";
import {
  alterarStatusPromotor,
  atualizarPromotorAdministrativamente,
  convidarPromotor,
  enviarRedefinicaoSenhaPromotor,
  reenviarConvitePromotor,
} from "@/services/gestao-acessos";
import { lojasCollection } from "@/services/lojas-service";
import { consultaPromotores } from "@/services/usuarios-service";
import type { ThemeColors } from "@/theme/colors";
import type { Loja } from "@/types/loja";
import type { Promotor } from "@/types/usuario";

import {
  Cabecalho,
  Campo,
  CampoBusca,
  FormularioModal,
  Vazio,
  useEstilosPainel,
} from "./lojas";

type PromotorWebItem = Promotor & {
  nome: string;
  email: string;
};

type AvisoPainel = {
  tipo: "sucesso" | "erro";
  texto: string;
};

export default function PromotoresWeb() {
  const estilos = useEstilosPainel();
  const { colors } = estilos;
  const { perfil } = useUsuarioAtual();
  const [promotores, setPromotores] = useState<PromotorWebItem[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [busca, setBusca] = useState("");
  const [editado, setEditado] = useState<PromotorWebItem | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [emailEdicao, setEmailEdicao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<AvisoPainel | null>(null);

  useEffect(() => {
    const unsubUsuarios = onSnapshot(consultaPromotores(perfil?.equipeId), (snapshot) => {
      const lista = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as PromotorWebItem[];
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
      setPromotores(lista);
    });
    const unsubLojas = onSnapshot(lojasCollection(), (snapshot) => {
      setLojas(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Loja[],
      );
    });
    return () => {
      unsubUsuarios();
      unsubLojas();
    };
  }, [perfil?.equipeId]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return promotores;
    return promotores.filter((item) =>
      `${item.nome} ${item.email}`.toLocaleLowerCase("pt-BR").includes(termo),
    );
  }, [busca, promotores]);

  function alternarLoja(id: string) {
    setSelecionadas((atuais) =>
      atuais.includes(id)
        ? atuais.filter((item) => item !== id)
        : [...atuais, id],
    );
  }

  function abrirEdicao(promotor: PromotorWebItem) {
    setEditado(promotor);
    setNomeEdicao(promotor.nome);
    setEmailEdicao(promotor.email);
    setSelecionadas(promotor.lojasIds || []);
  }

  async function salvarEdicao() {
    if (!editado || !nomeEdicao.trim() || !emailEdicao.trim() || selecionadas.length === 0) {
      setAviso({ tipo: "erro", texto: "Preencha nome, email e selecione pelo menos uma loja." });
      return;
    }
    setSalvando(true);
    try {
      await atualizarPromotorAdministrativamente(editado.id, {
        nome: nomeEdicao.trim(),
        email: emailEdicao.trim().toLowerCase(),
        lojasIds: selecionadas,
      });
      setEditado(null);
      setAviso({ tipo: "sucesso", texto: "Dados atualizados e registrados na auditoria." });
    } catch (error: any) {
      console.error("Falha ao atualizar promotor", error);
      setAviso({ tipo: "erro", texto: error.message || "Nao foi possivel atualizar o promotor." });
    } finally {
      setSalvando(false);
    }
  }

  async function cadastrar() {
    if (
      !nome.trim() ||
      !email.trim() ||
      selecionadas.length === 0
    ) {
      setAviso({ tipo: "erro", texto: "Preencha nome, email e selecione uma loja." });
      return;
    }
    setSalvando(true);
    try {
      await convidarPromotor({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        lojasIds: selecionadas,
      });
      setNome("");
      setEmail("");
      setSelecionadas([]);
      setNovoAberto(false);
      setAviso({ tipo: "sucesso", texto: "Convite enviado. O promotor recebera um email para criar a propria senha." });
    } catch (error: any) {
      console.error("Falha ao convidar promotor", error);
      setAviso({ tipo: "erro", texto: error.message || "Nao foi possivel cadastrar." });
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAcesso(item: PromotorWebItem) {
    const novoStatus = item.ativo === false;
    if (!globalThis.confirm(`${novoStatus ? "Reativar" : "Desativar"} o acesso de ${item.nome}?`)) return;
    setSalvando(true);
    try {
      await alterarStatusPromotor(item.id, novoStatus);
      setAviso({ tipo: "sucesso", texto: `Acesso de ${item.nome} ${novoStatus ? "reativado" : "desativado"}.` });
    } catch (error: any) {
      console.error("Falha ao alterar acesso", error);
      setAviso({ tipo: "erro", texto: error.message || "Nao foi possivel alterar o acesso." });
    } finally {
      setSalvando(false);
    }
  }

  async function enviarEmailAcesso(item: PromotorWebItem) {
    setSalvando(true);
    try {
      if (item.statusAcesso === "convite_pendente") {
        await reenviarConvitePromotor(item.id);
        setAviso({ tipo: "sucesso", texto: `Novo convite enviado para ${item.email}.` });
      } else {
        await enviarRedefinicaoSenhaPromotor(item.id);
        setAviso({ tipo: "sucesso", texto: `Redefinicao de senha enviada para ${item.email}.` });
      }
    } catch (error: any) {
      console.error("Falha ao enviar email de acesso", error);
      setAviso({ tipo: "erro", texto: error.message || "Nao foi possivel enviar o email." });
    } finally {
      setSalvando(false);
    }
  }

  function nomesLojas(item: PromotorWebItem) {
    return (
      lojas
        .filter((loja) => item.lojasIds?.includes(loja.id))
        .map((loja) => loja.nome)
        .join(", ") || "Nenhuma loja"
    );
  }

  const seletorLojas = (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textMuted, fontWeight: "bold" }}>
        Lojas permitidas
      </Text>
      {lojas.map((loja) => {
        const ativa = selecionadas.includes(loja.id);
        return (
          <Pressable
            key={loja.id}
            onPress={() => alternarLoja(loja.id)}
            style={{
              minHeight: 44,
              borderWidth: 1,
              borderColor: ativa ? colors.primary : colors.border,
              borderRadius: 8,
              backgroundColor: ativa ? colors.primarySurface : colors.surface,
              paddingHorizontal: 11,
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
            }}
          >
            <MaterialIcons
              name={ativa ? "check-box" : "check-box-outline-blank"}
              size={21}
              color={ativa ? colors.primary : colors.iconMuted}
            />
            <Text
              style={{
                color: ativa ? colors.primary : colors.text,
                fontWeight: ativa ? "bold" : "normal",
              }}
            >
              {loja.nome}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 18, paddingBottom: 28 }}
    >
      <Cabecalho
        titulo="Promotores"
        subtitulo={`${promotores.length} profissionais cadastrados`}
        botao="Novo promotor"
        icone="person-add"
        onPress={() => {
          setAviso(null);
          setSelecionadas([]);
          setNovoAberto(true);
        }}
      />
      {aviso ? (
        <View
          accessibilityRole="alert"
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: aviso.tipo === "erro" ? colors.danger : colors.success,
            borderRadius: 8,
            backgroundColor: aviso.tipo === "erro" ? colors.dangerSurface : colors.successSurface,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <MaterialIcons
            name={aviso.tipo === "erro" ? "error-outline" : "check-circle"}
            size={20}
            color={aviso.tipo === "erro" ? colors.dangerText : colors.successText}
          />
          <Text style={{ flex: 1, color: aviso.tipo === "erro" ? colors.dangerText : colors.successText, fontWeight: "600" }}>
            {aviso.texto}
          </Text>
          <Pressable onPress={() => setAviso(null)} accessibilityLabel="Fechar mensagem">
            <MaterialIcons name="close" size={20} color={aviso.tipo === "erro" ? colors.dangerText : colors.successText} />
          </Pressable>
        </View>
      ) : null}
      <CampoBusca
        valor={busca}
        onChange={setBusca}
        placeholder="Buscar por nome ou email"
      />
      <Animated.View
        entering={FadeInUp.duration(260)}
        layout={LinearTransition.duration(180)}
        style={estilos.tabela}
      >
        <View style={estilos.cabecalhoTabela}>
          <Text style={[estilos.celulaCabecalho, { flex: 1.4 }]}>PROMOTOR</Text>
          <Text style={[estilos.celulaCabecalho, { flex: 1.5 }]}>LOJAS</Text>
          <Text style={[estilos.celulaCabecalho, { flex: 0.55 }]}>STATUS</Text>
          <Text style={[estilos.celulaCabecalho, { flex: 0.8 }]}>ACOES</Text>
        </View>
        {filtrados.map((item, indice) => {
          const ativo = item.ativo !== false;
          const convitePendente = item.statusAcesso === "convite_pendente";
          return (
            <Animated.View
              key={item.id}
              entering={FadeInUp.duration(220).delay(indice * 35)}
              layout={LinearTransition.duration(160)}
              style={[
                estilos.linhaTabela,
                { borderBottomWidth: indice < filtrados.length - 1 ? 1 : 0 },
              ]}
            >
              <View
                style={{
                  flex: 1.4,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View style={estilos.iconeLinha}>
                  <MaterialIcons name="person" size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "bold" }}>
                    {item.nome}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSubtle,
                      fontSize: 12,
                      paddingTop: 3,
                    }}
                  >
                    {item.email}
                  </Text>
                </View>
              </View>
              <Text
                numberOfLines={2}
                style={[estilos.celula, { flex: 1.5 }]}
              >
                {nomesLojas(item)}
              </Text>
              <View style={{ flex: 0.55 }}>
                <Text style={ativo ? estilos.badgeAtivo : estilos.badgeInativo}>
                  {convitePendente ? "Convidado" : ativo ? "Ativo" : "Inativo"}
                </Text>
              </View>
              <View style={{ flex: 0.8, flexDirection: "row", gap: 6 }}>
                <IconeAcao
                  colors={colors}
                  icone="store"
                  titulo="Editar dados"
                  onPress={() => abrirEdicao(item)}
                />
                <IconeAcao
                  colors={colors}
                  icone={convitePendente ? "forward-to-inbox" : "lock-reset"}
                  titulo={convitePendente ? "Reenviar convite" : "Enviar redefinicao de senha"}
                  onPress={() => enviarEmailAcesso(item)}
                />
                {!convitePendente ? <IconeAcao
                  colors={colors}
                  icone={ativo ? "block" : "check-circle"}
                  titulo={ativo ? "Desativar" : "Reativar"}
                  onPress={() => alternarAcesso(item)}
                /> : null}
              </View>
            </Animated.View>
          );
        })}
        {filtrados.length === 0 ? (
          <Vazio texto="Nenhum promotor encontrado." />
        ) : null}
      </Animated.View>

      <FormularioModal
        visivel={novoAberto}
        titulo="Convidar promotor"
        onClose={() => setNovoAberto(false)}
        onSave={cadastrar}
        salvando={salvando}
      >
        <Campo rotulo="Nome completo" valor={nome} onChange={setNome} />
        <Campo rotulo="Email" valor={email} onChange={setEmail} />
        {emailParecePessoal(email) ? <Text style={{ color: colors.warning, fontSize: 12 }}>Email pessoal permitido. Prefira o corporativo quando possivel.</Text> : null}
        {seletorLojas}
      </FormularioModal>
      <FormularioModal
        visivel={!!editado}
        titulo={`Editar ${editado?.nome || "promotor"}`}
        onClose={() => setEditado(null)}
        onSave={salvarEdicao}
        salvando={salvando}
      >
        <Campo rotulo="Nome completo" valor={nomeEdicao} onChange={setNomeEdicao} />
        <Campo rotulo="Email" valor={emailEdicao} onChange={setEmailEdicao} />
        {emailParecePessoal(emailEdicao) ? <Text style={{ color: colors.warning, fontSize: 12 }}>Email pessoal permitido. Prefira o corporativo quando possivel.</Text> : null}
        {seletorLojas}
      </FormularioModal>
    </ScrollView>
  );
}

function IconeAcao({
  colors,
  icone,
  titulo,
  onPress,
  perigo,
}: {
  colors: ThemeColors;
  icone: keyof typeof MaterialIcons.glyphMap;
  titulo: string;
  onPress: () => void;
  perigo?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={titulo}
      style={{
        width: 34,
        height: 34,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: perigo ? colors.danger : colors.border,
        backgroundColor: perigo
          ? colors.dangerSurface
          : colors.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialIcons
        name={icone}
        size={18}
        color={perigo ? colors.danger : colors.textMuted}
      />
    </Pressable>
  );
}
