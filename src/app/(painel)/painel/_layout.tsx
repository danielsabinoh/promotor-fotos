import { useEffect } from "react";
import { Slot } from "expo-router";

import PainelWebLayout from "@/components/painel-web-layout";
import { TelaCarregandoAuth, useAuthGuard } from "@/hooks/use-auth-guard";
import { migrarEquipeLegada } from "@/services/gestao-acessos";

type TipoUsuario = "admin" | "super_admin";
const PAPEIS_PAINEL = ["admin", "super_admin"] as const;

export default function PainelLayout() {
  const { carregando, usuario, perfil } = useAuthGuard({
    papeisPermitidos: PAPEIS_PAINEL,
  });

  useEffect(() => {
    if (!perfil) return;
    migrarEquipeLegada().catch((error) => console.log("Nao foi possivel preparar a equipe legada.", error));
  }, [perfil]);

  if (carregando || !perfil) {
    return <TelaCarregandoAuth />;
  }

  const tipoUsuario =
    perfil.tipo === "super_admin" ? "super_admin" : ("admin" as TipoUsuario);
  const nomeUsuario = perfil.nome || usuario?.displayName || "";

  return (
    <PainelWebLayout nomeUsuario={nomeUsuario} tipoUsuario={tipoUsuario}>
      <Slot />
    </PainelWebLayout>
  );
}
