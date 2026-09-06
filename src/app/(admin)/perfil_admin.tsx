import PerfilUsuario from "@/components/perfil-usuario";
import ConfiguracoesAdmin from "@/components/configuracoes-admin";

export default function PerfilAdmin() {
  return <ConfiguracoesAdmin><PerfilUsuario tipoEsperado="admin" embutido /></ConfiguracoesAdmin>;
}
