# Amnia v2 — Criador de Fichas

App web **local-first** para criar e gerenciar fichas de personagem do RPG autoral **Amnia v2**.

- Funciona no navegador, sem login e sem servidor.
- Fichas salvas no próprio dispositivo (IndexedDB).
- Regras do sistema tratadas como **dados**, não como código espalhado pela interface.

## Stack

| Peça | Escolha |
| --- | --- |
| Base | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS v4 (tokens em `src/index.css`) |
| Validação | Zod |
| Estado | Zustand |
| Persistência | Dexie (IndexedDB) |

## Como rodar

```bash
npm install
npm run dev
```

Requer Node.js 22+.

## Arena de Amnia (Mestre com IA)

A página `/arena` é uma mesa de RPG com o Mestre narrando por IA (Groq via
Vercel AI SDK). A ficha ativa vem de `localStorage['amnia_ficha_atual']` e o
estado da mesa (PV, PM, Limiar, PA, relógios) fica em `amnia_arena_estado`.

### Configuração

1. Copie `.env.example` para `.env`.
2. Preencha `GROQ_API_KEY` com sua chave do Groq.
3. `GROQ_MODEL` é opcional; o padrão é `openai/gpt-oss-120b`. Para ver os
   modelos disponíveis na sua conta: `GET https://api.groq.com/openai/v1/models`
   com o header `Authorization: Bearer $GROQ_API_KEY`.

> O plano gratuito do Groq limita poucos milhares de tokens por minuto. Cada
> resposta do Mestre envia a ficha, o estado e as etapas das ferramentas, então
> duas mensagens seguidas podem esbarrar no limite. O servidor já tenta de novo
> algumas vezes; se ainda falhar, aguarde ~20 segundos e reenvie.

```bash
# desenvolvimento (Vite + API no mesmo processo)
npm run dev

# produção (build + servidor Node com a API)
npm run build
npm run start

# atalho: build já feito, sobe o mesmo servidor de produção
npm run preview
```

> A API `/api/chat-mestre` só existe nos servidores acima. Servir o `dist/`
> com `vite preview`, `serve`, GitHub Pages ou qualquer hospedagem estática
> responde **HTTP 404** nessa rota, porque a chave do Groq precisa ficar no
> servidor.

### Deploy na Vercel

O site é estático, mas a API é publicada como função serverless no mesmo
projeto. A entrada fica em `server/vercelEntry.ts` e o build gera
`api/chat-mestre.js` já empacotado (a Vercel não compila TypeScript fora de
`api/`):

1. Importe o repositório na Vercel. O `vercel.json` fixa o build (`npm run build`)
   e a saída (`dist`).
2. Em **Settings → Environment Variables**, adicione:
   - `GROQ_API_KEY` (obrigatória, em Production/Preview/Development);
   - `GROQ_MODEL` (opcional; padrão `openai/gpt-oss-120b`).
3. Faça um novo deploy (ou *Redeploy*) para a função pegar as variáveis.

`npm run build` roda `npm run build:api` no final e regenera
`api/chat-mestre.js` a partir de `server/vercelEntry.ts`. Não edite esse arquivo
à mão. Para conferir o deploy, abra `/api/chat-mestre` no navegador: a resposta
mostra `hasGroqKey` e o modelo em uso (sem expor a chave).

O arquivo `.env` local **não** é enviado; a chave no deploy vem só das
variáveis de ambiente da Vercel. A função tem `maxDuration: 60s` — o suficiente
para uma resposta do Groq, mas o limite gratuito de tokens/minuto continua
valendo.

A chave **nunca** vai para o navegador: o cliente chama `POST /api/chat-mestre`
e o servidor lê `process.env.GROQ_API_KEY`. Sem a chave, a API responde com
`Groq API key ausente. Configure GROQ_API_KEY.`

### Como funciona

- A IA **narra**; quem calcula é o código.
- Ferramentas do servidor: `spend_action_points`, `roll_test`,
  `reroll_with_impeto`, `calculate_enemy_damage`, `spend_mana`,
  `roll_macula_save`, `advance_threat_clock`, `end_turn` e `enter_suppression`.
- Toda ação declarada gasta PA pelo código (`spend_action_points`, custo padrão
  1). Sem PA suficiente a ação é bloqueada e nenhum teste é rolado.
- O Mestre escolhe o teste (ex.: `Armas Brancas + Destreza`) e o servidor soma
  os valores da ficha. Em testes opostos, o defensor rola a própria pilha:
  `MoS = sucessos do jogador − sucessos do Mestre` e a DIF é ignorada.
- A DIF é situacional (padrão **0**, sem DIF fixa). Só sobe quando a ficção
  impõe resistência passiva (escuridão, terreno, pressa, ferimento); a
  dificuldade principal vem da margem (MoS).
- As regras puras ficam em `src/lib/amnia/` (dados, testes e regras) e são
  reutilizadas pelo navegador e pelo servidor.
- O chat mostra os resultados reais das ferramentas em cartões abaixo da
  narração. Os dados do jogador têm contorno **verde**; os dados do
  Mestre/inimigo têm contorno **vermelho**.
- Quando um teste falha, o jogador pode gastar 1 Ímpeto para rerrolar até 2
  dados falhos **escolhidos por ele** na própria mesa de dados. A defesa do
  inimigo não muda.
- O painel lateral destaca o Limiar em azul (seguro), amarelo (perto do limite)
  e vermelho pulsante (Sobrecarga).
- **Encerrar turno** e **Supressão** (no painel ou no menu **Ações**, acima do
  campo de mensagem) são enviados ao chat. O servidor aplica a regra antes de
  responder e o Mestre narra a transição; os botões ficam bloqueados enquanto o
  chat espera, então não dá para clicar infinitamente.
- O menu **Ações** também oferece atalhos narrativos (atacar, defender, observar
  etc.) que só preenchem o campo. **Inimigos** abre uma faixa compacta com os
  relógios de ameaça atuais e uma barra de vida simplificada; clicar em um
  inimigo prepara a mensagem de ataque.
- **Ocultar ficha** esconde a barra lateral e devolve a tela inteira ao chat; o
  mesmo botão a traz de volta.
- Clicar em uma magia preparada abre um pop-up com custo, efeito, runas,
  condições, alcance e alvo. Fecha no **X**, clicando fora ou com **Escape**.
- Traços raciais que concedem especializações ou runas mostram um aviso
  **Concede:** na carta do traço, na ficha final e na exportação. As concessões
  entram nos limites automaticamente: especializações gratuitas somam ao total
  da criação; runas específicas (Terra, Camaleão, Alma e os elementos do Caminho
  da Vida) entram em `knownRunes` e ficam travadas enquanto o traço existir;
  runas de escolha (ex.: 1 Runa de Reforço) apenas abrem uma vaga para o jogador
  marcar. Runas condicionais (fase lunar Minguante) aparecem como aviso, mas não
  entram no limite. Ao remover o traço, só saem as runas que ele concedeu.

### Teste manual

1. Crie uma ficha no criador e salve (ou abra uma ficha existente).
2. Volte à lista e clique em **Arena** (ou abra `/arena`).
3. Confirme que o painel mostra nome, classe, PV, PM, Limiar, Ímpeto, PA e runas.
4. Envie: `Eu ataco o bandido mais próximo com minha espada.`
5. Verifique se o cartão de `spend_action_points` mostra o PA caindo (4 → 3) e se
   o cartão de `roll_test` aparece com os dados do jogador em **verde** e, quando
   houver defesa, os dados do inimigo em **vermelho**.
6. Confira que o teste usa a perícia + atributo pedidos pelo Mestre (ex.:
   `Armas Brancas + Destreza`) e que a DIF só aparece quando a ficção justifica.
7. Force uma falha e clique em até 2 dados falhos na mesa; confirme que o botão
   **Rerrolar · 1 Ímpeto** gasta 1 Ímpeto, muda só os dados escolhidos e mantém
   a defesa do inimigo.
8. Peça um gasto de magia (ex.: `Lanço minha magia no bandido`) e confira
   `spend_mana` e o Limiar subindo no painel.
9. Clique em **Encerrar turno** (painel ou menu **Ações**). Confirme que o chat
   mostra a mensagem e o Mestre narra a transição, que o turno sobe, PA/PM são
   restaurados e que os botões ficam desabilitados durante a resposta. Clicar de
   novo depois não deve aplicar o turno duas vezes na mesma mensagem.
10. Clique em **Supressão**. O Mestre deve narrar o resfriamento do Limiar e a
    mana cortada; o botão fica desabilitado até o próximo turno.
11. Clique em uma magia preparada: o pop-up deve mostrar custo, efeito, runas,
    condições, alcance e alvo. Feche no **X**, clicando fora e com **Escape**.
12. Abra **Inimigos** e clique em um relógio: a mensagem de ataque é preenchida
    no campo. Abra **Ações** e use um atalho narrativo. Use **Ocultar ficha** e
    **Mostrar ficha** para alternar a barra lateral.
13. Rode `npm run test:arena` para validar dados, teste oposto, DIF, PA,
    rerrolagem de Ímpeto, dano, PM, Mácula, Supressão e relógios.

Concessões de traços raciais:

1. No criador, escolha **Humanos** e marque **Conhecimento Vasto**. A carta deve
   mostrar `Concede: +2 especializações` e a etapa **Perícias** deve exibir
   `+2 de traços` no limite de especializações gratuitas.
2. Escolha **Golshoy** e o **Caminho da Vida**, depois uma opção como
   **Tempestade**. A carta deve mostrar `Concede: +1 especialização em Arcanismo
   (Raio) · +1 runa: Raio`. Na etapa **Círculo & Runas**, o limite deve subir e a
   runa **Raio** deve aparecer como **Concedida**.
3. Abra uma ficha pronta com traços raciais e confirme que o cartão **Traços
   Raciais** mostra `Concede:` para os traços que dão especialização ou runa, e
   que os limites de runas/especializações da ficha incluem essas concessões.
4. Exporte a ficha em PDF/PNG e confirme que as mesmas notas aparecem na seção
   **Traços Raciais** e em **Runas Conhecidas**.

Sem ficha, `/arena` mostra um estado vazio com botão para o criador e a opção
de carregar uma ficha de exemplo (criada só no navegador).

## Codex Amnia (compêndio)

A página `/codex` publica o material original como um site de consulta: home com
cards das cinco seções, busca em todo o texto, índice lateral, navegação entre
páginas e links internos do próprio material. Tudo na mesma paleta papel/dourado
e com as fontes do projeto.

O conteúdo não é editado à mão. O export local do Notion fica em
`docs/amnia-export/` (fora do git, via `.gitignore`) e é transformado em markdown
com:

```bash
node scripts/build-codex-content.mjs
```

O script gera `src/features/codex/content/*.md`, copia as imagens para
`public/codex/` e escreve `src/features/codex/manifest.generated.ts` (índice com
id, título, seção, grupo, contagem de palavras e flag de página vazia). Links
internos viram `#/<id-do-artigo>`; o seletor fica no hash para que o link possa
ser compartilhado. A wiki é carregada com `React.lazy`, então o markdown não
entra no bundle inicial.

Em **Raças e culturas**, os links do índice e os títulos de linhagens, castas e
grupos recebem outline na mesma paleta da criação de personagens (`ancestryColor`
e `lineageColor` em `src/rules/lineageColors.ts`): verde para Troll/Goblin/Orc,
laranja para Lirizatl/Skaraeb/Shrumakara/Khefaret/Dongwu, azul para as demais,
com as sete cores de linhagem nos títulos específicos. A tradução dos ids e
títulos do markdown para essa paleta fica em `src/features/codex/codexColors.ts`.

## Experiência (XP)

Na ficha final, o cartão **Experiência** substitui o antigo recibo de gastos:
comprar com XP altera o personagem de verdade.

- **Saldo:** 15 XP iniciais + XP recebida em jogo (campo editável, o mesmo padrão
  do saldo de Zigs) − XP gasta. O cartão mostra disponível, recebida e gasta, e
  a exportação em PDF/PNG traz os mesmos totais e a lista de compras.
- **Compras aplicadas:** runas entram em **Runas Conhecidas** (o preço é 6/7/8/9
  conforme a relação com o Círculo Inato: inata/adjacente/paralela/oposta);
  atributos e perícias sobem de nível; especializações, talentos e
  vantagens/desvantagens entram nas respectivas listas; canalização e pontos
  extras de PV/PM/Ímpeto também são aplicados.
- **Desfazer:** remover uma linha da tabela devolve o efeito registrado — a runa,
  o nível anterior e os registros criados voltam ao estado original. Runas
  concedidas por traço não são removidas.
- **Recibos antigos:** compras importadas sem `effect` continuam valendo como
  registro de gasto, mas não alteram a ficha.

A tabela de custos e o cálculo ficam em `src/rules/xp.ts`; a ponte que aplica e
desfaz cada compra fica em `src/rules/xpPurchase.ts`. O schema da ficha subiu
para `SHEET_VERSION = 10`; fichas antigas continuam válidas pelos defaults do
Zod. Os testes do motor cobrem custo por nível, relação de runas, aplicação e
reversão (`npm run test:arena`).


## Tipografia

| Uso | Fonte | Arquivo |
| --- | --- | --- |
| Títulos | **Vinque** (Regular) | `public/fonts/vinque-regular.woff2` (18 KB) |
| Corpo | **Bricolage Grotesque** (variável 200–800, peso 500) | `public/fonts/bricolage-grotesque.woff2` (153 KB) |

Ambas são servidas localmente (sem CDN) e passaram por subset latino. Os tokens
`--font-display` e `--font-body` ficam em `src/index.css`.

> Vinque só tem o peso Regular: não use `font-bold` com ela. A hierarquia vem de
> tamanho, caixa alta e `letter-spacing`.

## Estrutura

```
src/
  App.tsx              shell da aplicação e rotas
  index.css            tokens de design (cores, fontes)
  storage/
    db.ts              schema do IndexedDB
    characters.ts      operações de salvar/listar/excluir
  rules/               sistema de Amnia como dados + motores de ficha
  lib/amnia/           regras puras da Arena (dados, dano, PM, Mácula)
  features/arena/      página /arena, chat e painel da ficha
server/
  chatMestre.ts        tools + chamada ao Groq
  index.ts             servidor de produção (dist + API)
tests/                 testes das regras puras
```

`src/rules/` é o coração do projeto: `types.ts` (modelo declarativo),
`amnia.ts` (dados do Amnia v2), `character.ts` (schema Zod da ficha),
`formula.ts` (avaliador de expressões) e `derive.ts` (stats derivados).

## Roadmap

- [x] Base do projeto e tema
- [x] Camada de persistência local
- [ ] Estruturar as regras do Amnia v2 a partir do material
- [ ] Schema da ficha + motor de cálculo
- [ ] Criação guiada (passo a passo com validação de pontos)
- [ ] Visualização/edição da ficha
- [ ] Exportar/importar JSON
- [ ] Exportação em PDF / impressão
- [ ] Fontes oficiais + acabamento visual
