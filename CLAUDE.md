# Zé dos Frangos — guia para trabalhar neste repositório

Site do restaurante Zé dos Frangos: páginas públicas em Astro, um backoffice
autenticado para o cliente gerir o conteúdo, e Netlify Functions/Edge
Functions como backend. **É um site em produção para um cliente real.**

Antes de mexer em código, ler:
- [AGENTS.md](AGENTS.md) — comandos do Astro (dev em background, etc.).
- [DEPLOY.md](DEPLOY.md) — como funciona a autenticação do backoffice,
  variáveis de ambiente do Netlify, credenciais de desenvolvimento local, e
  o que verificar depois de publicar. Não duplicar esse conteúdo aqui.

## Arquitetura, em resumo

- `src/pages/` — páginas públicas (`index`, `reservas`, `ajuda`), Astro.
- `public/admin.html` / `public/admin-login.html` — backoffice, protegido por
  `netlify/edge-functions/admin-guard.ts` (verifica o cookie de sessão antes
  de servir `/admin.html`).
- `netlify/functions/auth.mjs` — login, sessão, perfil.
- `netlify/functions/data.mjs` — leitura/escrita do conteúdo do site via
  Netlify Blobs. A lista de chaves públicas é **explícita**
  (`LEITURA_PUBLICA`): uma chave nova é privada por omissão. `reservas` e
  `candidaturas` guardam dados pessoais de clientes e nunca são servidas sem
  sessão — ver "Dados de clientes" abaixo.
- `public/site-data.js` — as páginas públicas lêem estes dados com
  `localStorage` como reserva quando a função não responde.

## Os dois colaboradores: um em Mac, um em Windows

Isto já causou atrito real (há um commit no histórico só para corrigir um
script de reposição do admin local no Windows). Ter sempre em conta:

- `npm run dev` corre `tests/start-dev.sh`, um script `sh` — no Windows
  precisa de Git Bash ou WSL para funcionar (não corre em cmd/PowerShell
  puro).
- O projeto exige Node `>=22.12` (`.nvmrc` e `engines` no `package.json`).
  Correr `nvm use` nos dois sistemas antes de trabalhar — um Node antigo
  falha em silêncio e o `netlify dev` fica um minuto à espera de uma porta
  que nunca abre.
- Há um `.gitattributes` (`* text=auto eol=lf`) a normalizar fins de linha —
  não o remover; sem ele, diffs entre os dois SO enchem-se de ruído de
  CRLF/LF.
- Não assumir que um caminho, ferramenta ou comportamento de shell existe
  igual nos dois SO só porque funciona num. Quando não tiver a certeza,
  verificar antes de propor (ex.: `sh`/bash existe por omissão no Windows do
  outro colaborador só porque há Git instalado).

## Testes: só no momento do commit

Não correr a suite (`npx playwright test` / `npm test`) a cada edição — é
lenta e não é isso que dá sinal útil durante o desenvolvimento. Corrê-la uma
vez, como último passo, mesmo antes de propor um commit.

## Antes de propor um commit

1. Correr a suite de testes (ver acima) e confirmar que passa.
2. Confirmar com `git status` / `git diff` que não há nada a mais no working
   tree: ficheiros novos não intencionais, `.env` ou outro segredo staged,
   artefactos de teste (`test-results/`, `playwright-report/`), código de
   debug esquecido.
3. Seguir o estilo já usado no histórico: mensagens de commit e nomes de
   branch descritivos, em português.

## Merge para `main`: é produção a sério

O `netlify.toml` builda com `npm run build` e publica `dist/` — mergear para
`main` tipicamente publica logo em produção, sem um gate manual a seguir.
Por isso, antes de sugerir ou fazer um merge para `main`:

- Avaliar explicitamente se a alteração pode comprometer produção — em
  particular o fluxo de autenticação (`admin-guard`, sessões, rate
  limiting) e a integridade dos dados guardados em Blobs.
- Considerar impacto de escalabilidade, não só "funciona localmente" ou
  "passa os testes": o que acontece com mais conteúdo, mais tráfego, mais
  utilizadores do backoffice.
- "Funciona no meu ambiente" não chega quando os dois colaboradores usam
  sistemas operativos diferentes — ver secção acima.

## Dados de clientes

`reservas` e `candidaturas` (ver `netlify/functions/data.mjs`) são dados
pessoais reais. Nunca os expor em logs, screenshots, mensagens de commit ou
de PR — nem sequer parcialmente para efeitos de debug.

## Não partir de contexto desatualizado

Este repositório muda entre sessões e entre colaboradores. Não assumir
factos sobre o estado do repositório (histórico, ficheiros existentes,
localização do projeto, branch atual) a partir de memória de conversas
anteriores — verificar sempre com `git status`, `git log` ou lendo os
ficheiros antes de agir como se fossem verdade.
