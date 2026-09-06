# Configuracoes e categorias

O catalogo e compartilhado por todos os usuarios desta instalacao. Nao existe
separacao por empresa no banco atual.

## Publicacao

Antes de distribuir esta versao, publique o arquivo `firestore.rules` no mesmo
projeto Firebase usado pelo aplicativo. As regras adicionam leitura das categorias
para usuarios ativos e permitem criacao/ativacao somente por admins ativos.
Sem essa publicacao, a leitura da nova colecao sera recusada e o envio de fotos
aguardara o carregamento correto das categorias.

Com a Firebase CLI autenticada e o ID do projeto conferido:

```sh
firebase deploy --only firestore:rules --project SEU_PROJECT_ID
```

## Comportamento

- Configuracoes reune perfil, senha, aparencia e gestao de categorias no app e no painel web.
- As categorias atuais sao o catalogo inicial; nao e necessario executar uma carga no banco.
- A colecao `categorias_foto` armazena as categorias novas e as preferencias das categorias padrao.
- Cada documento tem `nome`, `ativa`, `atualizadoPor` e `atualizadoEm`.
- Nomes sao estaveis, sem renomeacao ou exclusao, pois fotos antigas armazenam a categoria pelo nome.
- Criacao usa transacao e uma chave normalizada para impedir duplicatas por acentos, caixa e espacos.
- Desativar remove a categoria de novos envios, sem alterar fotos, filtros ou relatorios antigos.
- Estoque e avaria mantem seus formularios especializados. Categorias novas sao categorias comuns de foto.
- Todas podem ser desativadas. Nesse caso, o promotor ve que nao ha categorias disponiveis e nao pode enviar.
- A tela acompanha alteracoes em tempo real e consulta o servidor novamente antes de iniciar um envio.
- As regras de fotos existentes continuam independentes do catalogo: clientes antigos precisam ser atualizados
  para respeitar as categorias ativas. A consulta antes do envio nao e uma transacao com a criacao das fotos.

## Validacao

```sh
node --test scripts/test-categorias.cjs
npm run lint
npx tsc --noEmit
npx expo export --platform web
```

Para testar com Firebase: cadastrar uma categoria como admin, verificar sua aparicao
no promotor, desativa-la com um rascunho aberto, conferir o bloqueio do envio e testar
o filtro das fotos antigas. Confirmar tambem que um promotor nao consegue escrever
na colecao de categorias. Os testes de dominio nao substituem testes das regras
no emulador do Firestore ou em um projeto de homologacao.
