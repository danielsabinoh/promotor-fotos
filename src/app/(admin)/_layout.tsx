import { useEffect } from "react";
import { Slot } from "expo-router";

import { TelaCarregandoAuth, useAuthGuard } from "@/hooks/use-auth-guard";
import { migrarEquipeLegada } from "@/services/gestao-acessos";

const PAPEIS_ADMIN = ["admin", "super_admin"] as const;

export default function AdminLayout() {
  const { carregando, perfil } = useAuthGuard({
    papeisPermitidos: PAPEIS_ADMIN,
  });

  useEffect(() => {
    if (!perfil) return;
    migrarEquipeLegada().catch((error) => console.log("Nao foi possivel preparar a equipe legada.", error));
  }, [perfil]);

  if (carregando || !perfil) {
    return <TelaCarregandoAuth />;
  }

  return <Slot />;
}
