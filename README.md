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
  App.tsx              shell da aplicação
  index.css            tokens de design (cores, fontes)
  storage/
    db.ts              schema do IndexedDB
    characters.ts      operações de salvar/listar/excluir
  rules/               ⚠️ ainda não existe — entra aqui o sistema como dado
```

A pasta `src/rules/` é o coração do projeto e só será criada com o material
das regras em mãos. Ela vai conter:

1. `types.ts` — o modelo declarativo (atributos, perícias, origens, poderes…).
2. `amnia.ts` — os dados reais do Amnia v2.
3. `character.ts` — schema Zod da ficha + fábrica de personagem.
4. `formula.ts` — avaliador de expressões para os stats derivados.
5. `compute.ts` — cálculo dos valores derivados a partir da ficha.

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
