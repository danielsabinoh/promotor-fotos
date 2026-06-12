import { useEffect, useState } from "react";

import { collection, doc, onSnapshot, query, where } from "firebase/firestore";

import PerfilUsuario from "../components/perfil-usuario";
import { auth, db } from "../services/firebaseConfig";

export default function PerfilPromotor() {
  const [totalLojas, setTotalLojas] = useState(0);
  const [totalFotos, setTotalFotos] = useState(0);

  useEffect(() => {
    const usuarioAtual = auth.currentUser;

    if (!usuarioAtual) return;

    const unsubscribeUsuario = onSnapshot(
      doc(db, "usuarios", usuarioAtual.uid),
      (snapshot) => setTotalLojas(snapshot.data()?.lojasIds?.length || 0),
    );

    const consultaFotos = query(
      collection(db, "fotos"),
      where("promotorId", "==", usuarioAtual.uid),
    );
    const unsubscribeFotos = onSnapshot(consultaFotos, (snapshot) => {
      const idsSubstituidos = new Set(
        snapshot.docs
          .filter((item) => item.data().naLixeira !== true)
          .map((item) => item.data().refacaoDeId)
          .filter(Boolean),
      );

      setTotalFotos(
        snapshot.docs.filter(
          (item) =>
            item.data().naLixeira !== true && !idsSubstituidos.has(item.id),
        ).length,
      );
    });

    return () => {
      unsubscribeUsuario();
      unsubscribeFotos();
    };
  }, []);

  return (
    <PerfilUsuario
      tipoEsperado="promotor"
      totalLojas={totalLojas}
      totalFotos={totalFotos}
    />
  );
}
