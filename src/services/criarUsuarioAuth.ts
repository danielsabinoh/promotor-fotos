import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";

import { firebaseConfig } from "./firebaseConfig";

export async function criarUsuarioAuth(email: string, senha: string) {
  const appTemporario = initializeApp(
    firebaseConfig,
    `cadastro-usuario-${Date.now()}`,
  );
  const authTemporario = getAuth(appTemporario);

  try {
    const credencial = await createUserWithEmailAndPassword(
      authTemporario,
      email.trim(),
      senha,
    );

    return credencial.user.uid;
  } finally {
    await signOut(authTemporario).catch(() => undefined);
    await deleteApp(appTemporario);
  }
}
