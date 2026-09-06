import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";

import { auth } from "@/services/firebaseConfig";
import { usuarioDoc } from "@/services/usuarios-service";
import { EQUIPE_PADRAO } from "@/constants/acesso";

export type TipoUsuario = "promotor" | "admin" | "super_admin";

export type PerfilUsuarioAtual = {
  uid: string;
  nome: string;
  email: string;
  tipo: TipoUsuario | null;
  ativo: boolean;
  fotoBase64?: string;
  equipeId: string;
};

type UsuarioContextValue = {
  carregando: boolean;
  user: User | null;
  perfil: PerfilUsuarioAtual | null;
};

const UsuarioContext = createContext<UsuarioContextValue>({
  carregando: true,
  user: null,
  perfil: null,
});

export function UsuarioProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [perfil, setPerfil] = useState<PerfilUsuarioAtual | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Acompanha o usuário do Firebase Auth.
  useEffect(() => {
    return onAuthStateChanged(auth, (atual) => {
      setUser(atual);
      if (!atual) {
        setPerfil(null);
        setCarregando(false);
      } else {
        setCarregando(true);
      }
    });
  }, []);

  // Acompanha o documento do usuário em tempo real (snapshot).
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      usuarioDoc(user.uid),
      (snap) => {
        if (!snap.exists()) {
          setPerfil(null);
          setCarregando(false);
          return;
        }
        const dados = snap.data();
        if (dados.ativo === false && dados.statusAcesso !== "convite_pendente") {
          signOut(auth).catch(() => undefined);
          setPerfil(null);
          setCarregando(false);
          return;
        }
        setPerfil({
          uid: user.uid,
          nome: dados.nome || user.displayName || "",
          email: dados.email || user.email || "",
          tipo: (dados.tipo as TipoUsuario) || null,
          ativo: dados.ativo !== false,
          fotoBase64: dados.fotoBase64,
          equipeId: dados.equipeId || EQUIPE_PADRAO,
        });
        setCarregando(false);
      },
      () => {
        setCarregando(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  return (
    <UsuarioContext.Provider value={{ carregando, user, perfil }}>
      {children}
    </UsuarioContext.Provider>
  );
}

/**
 * Devolve o perfil do usuário atual (lido em tempo real do Firestore).
 * - perfil.tipo: "promotor" | "admin" | "super_admin" | null
 * - perfil.fotoBase64: foto de perfil em base64 (se houver)
 */
export function useUsuarioAtual() {
  return useContext(UsuarioContext);
}

/**
 * Atalho que devolve o tipo do usuário com fallback "admin"
 * (útil pra props que esperam um tipo concreto).
 */
export function useTipoUsuario(): "admin" | "super_admin" {
  const { perfil } = useUsuarioAtual();
  return perfil?.tipo === "super_admin" ? "super_admin" : "admin";
}
