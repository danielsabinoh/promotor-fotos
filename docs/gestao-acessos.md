# Gestao de acesso da equipe

## Fluxo implementado

1. Um administrador informa nome, email e lojas do promotor no app ou painel.
2. Uma Cloud Function cria uma conta nova com senha aleatoria desconhecida e perfil `convite_pendente`.
3. O Firebase Authentication envia ao promotor um link para definir a propria senha.
4. No primeiro login dentro da validade de uma hora, a conta passa para `ativo`.
5. O administrador pode editar nome, email e lojas, reenviar o convite, enviar redefinicao de senha e desativar ou reativar o acesso.
6. A desativacao bloqueia o login, revoga os tokens existentes e preserva o perfil e todo o historico.

As operacoes administrativas passam pelas Functions. As regras do Firestore nao permitem que o cliente crie, exclua ou altere o acesso de promotores diretamente.

## Auditoria

Os eventos sao gravados em `auditoria_acessos`, incluindo equipe, administrador, usuario afetado, acao e horario do servidor. Convites, edicoes, redefinicoes, desativacoes, reativacoes, aceite do convite e migracao dos registros antigos geram eventos. Senhas e links de acesso nunca sao armazenados.

## Configuracao do Firebase

As Functions usam Node.js 22 e a regiao `southamerica-east1`. Antes da primeira publicacao:

```powershell
cd functions
npm install
firebase deploy --only functions --project SEU_PROJECT_ID
```

Durante a primeira publicacao, informe `WEB_API_KEY` quando o Firebase CLI solicitar. Use o mesmo valor de `EXPO_PUBLIC_FIREBASE_API_KEY` do projeto. O parametro fica no ambiente das Functions e nao deve ser versionado.

O envio usa o modelo de redefinicao de senha do Firebase Authentication. No console Firebase, personalize esse modelo para explicar que o mesmo link tambem e usado no convite inicial.

Depois de publicar as Functions, abra uma vez o painel atualizado com um administrador. Ele migra os promotores antigos para a equipe compartilhada. Em seguida publique as regras:

```powershell
firebase deploy --only firestore:rules --project SEU_PROJECT_ID
```

Cloud Functions exige que o projeto esteja no plano Blaze. O envio de emails do Firebase Authentication possui cotas proprias; ultrapassar a cota nao cria cobranca automatica, mas bloqueia novos envios ate a renovacao da cota.
