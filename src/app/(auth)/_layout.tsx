import { useEffect, useState } from "react";

import { Slot, router, usePathname } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { ROTAS } from "@/constants/routes";
import { TelaCarregandoAuth } from "@/hooks/use-auth-guard";
import { auth } from "@/services/firebaseConfig";
import { buscarUsuario } from "@/services/usuarios-service";

function destinoPosLogin(tipo?: string) {
  if (tipo === "admin" || tipo === "super_admin") {
    return process.env.EXPO_OS === "web" ? ROTAS.painel : ROTAS.admin;
  }

  if (tipo === "promotor") {
    return ROTAS.promotor;
  }

  return ROTAS.login;
}

export default function AuthLayout() {
  const [carregando, setCarregando] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let ativo = true;

    const unsubscribe = onAuthStateChanged(auth, async (usuarioAtual) => {
      if (!usuarioAtual) {
        if (ativo) setCarregando(false);
        return;
      }

      try {
        const usuarioSnap = await buscarUsuario(usuarioAtual.uid);
        const dados = usuarioSnap.data();

        if (dados?.statusAcesso === "convite_pendente") {
          if (ativo) setCarregando(false);
          return;
        }

        if (!dados || dados.ativo === false) {
          await signOut(auth);
          if (ativo) setCarregando(false);
          router.replace(ROTAS.login);
          return;
        }

        if (dados.primeiroAcesso === true) {
          if (pathname !== ROTAS.alterarSenha) {
            router.replace(ROTAS.alterarSenha);
          }
          if (ativo) setCarregando(false);
          return;
        }

        router.replace(destinoPosLogin(dados.tipo));
      } catch (error) {
        console.log(error);
        await signOut(auth).catch(() => undefined);
        if (ativo) setCarregando(false);
      }
    });

    return () => {
      ativo = false;
      unsubscribe();
    };
  }, [pathname]);

  if (carregando) {
    return <TelaCarregandoAuth />;
  }

  return <Slot />;
}
