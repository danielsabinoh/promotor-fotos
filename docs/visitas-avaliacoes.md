# Visitas e rastreio das avaliacoes

## Visualizacao

O app do administrador e o painel web exibem um cartao por visita, com carrossel,
contador de fotos e resumo dos status. Cada foto mantem sua categoria, observacao,
status e acoes individuais. Fotos antigas sem visitaId permanecem separadas:
nao se presume que fotos da mesma loja e data pertencem a uma visita.

Os filtros selecionam visitas que contenham pelo menos uma foto correspondente.
O carrossel conserva todas as fotos da visita e indica quantas correspondem ao filtro.
A aprovacao da visita inclui todas essas fotos, inclusive as fora do filtro.

## Avaliacao

- Avaliar foto conserva as opcoes individuais existentes.
- Aprovar visita pede confirmacao e aprova as fotos sequencialmente.
- Cada alteracao grava status, nome/ID do administrador autenticado, horario do
  servidor e um evento em fotos/{fotoId}/avaliacoes/{avaliacaoId}.
- Foto, evento e notificacao sao gravados juntos em uma transacao por foto.
- A visita inteira nao e uma transacao unica. Se houver falha, a tela informa
  quantas fotos foram confirmadas e permite tentar novamente.
- Repetir o mesmo status e comentario nao duplica eventos ou notificacoes.
- O historico completo e consultado apenas ao abrir os detalhes da foto.

Dados antigos nao recebem autor ou horario inventados. O rastreio completo comeca
nas novas alteracoes; repetir uma aprovacao antiga sem mudanca nao cria um evento.

## Ativacao no Firebase

Publicar as regras locais de firestore.rules antes de usar esta versao em producao.
Esta implementacao nao publica regras automaticamente. As regras permitem a leitura
do historico por administradores ativos e exigem um evento correspondente para
alteracoes de avaliacao. Eventos nao podem ser editados ou apagados pelo cliente.

Coordenar a publicacao das regras com a distribuicao do app e painel atualizados:
clientes antigos que alteram status sem registrar historico serao bloqueados.

## Verificacao

```sh
node --test scripts/test-categorias.cjs scripts/test-visitas.cjs
npm run lint
npx tsc --noEmit
npx expo export --platform web
```

Os testes de servico usam simulacoes de transacoes e cobrem identidade, historico,
repeticoes, falhas, permissoes e aprovacao em conjunto. Eles nao validam as regras
em um emulador Firebase. Validar tambem com contas de teste e dispositivo fisico
antes da publicacao em producao.
