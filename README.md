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

Requer Node.js 20+.

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
- Ferramentas do servidor: `roll_test`, `calculate_enemy_damage`, `spend_mana`,
  `roll_macula_save` e `advance_threat_clock`.
- As regras puras ficam em `src/lib/amnia/` (dados, testes e regras) e são
  reutilizadas pelo navegador e pelo servidor.
- O chat mostra os resultados reais das ferramentas em cartões abaixo da
  narração (dados, sucessos, MoS, segmentos, PM/Limiar, relógios).
- O painel lateral destaca o Limiar em azul (seguro), amarelo (perto do limite)
  e vermelho pulsante (Sobrecarga).

### Teste manual

1. Crie uma ficha no criador e salve (ou abra uma ficha existente).
2. Volte à lista e clique em **Arena** (ou abra `/arena`).
3. Confirme que o painel mostra nome, classe, PV, PM, Limiar, Ímpeto, PA e runas.
4. Envie: `Eu ataco o bandido mais próximo com minha espada.`
5. Verifique se o cartão de `roll_test` aparece com dados e MoS reais e se o
   Mestre narra o resultado.
6. Peça um gasto de magia (ex.: `Lanço minha magia no bandido`) e confira
   `spend_mana` e o Limiar subindo no painel.
7. Rode `npm run test:arena` para validar dados, dano, PM, Mácula e relógios.

Sem ficha, `/arena` mostra um estado vazio com botão para o criador e a opção
de carregar uma ficha de exemplo (criada só no navegador).


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
