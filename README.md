# Zé dos Frangos

Site do restaurante Zé dos Frangos: páginas públicas em Astro, backoffice
autenticado para o cliente gerir o conteúdo, e Netlify Functions/Edge
Functions como backend (auth, dados via Netlify Blobs).

Site em produção para um cliente real — ver [CLAUDE.md](CLAUDE.md) para as
regras de trabalho neste repositório (dois colaboradores, Mac e Windows;
testes só no commit; cuidado ao mergear para `main`) e
[DEPLOY.md](DEPLOY.md) para autenticação do backoffice e operação em
produção.

## 🚀 Estrutura do projeto

```text
/
├── public/               # estáticos + backoffice (admin.html, admin-login.html)
├── src/
│   ├── layouts/
│   └── pages/            # index, reservas, ajuda
├── netlify/
│   ├── functions/        # auth, dados (Netlify Blobs)
│   └── edge-functions/   # admin-guard (protege /admin.html)
├── tests/                # Playwright (site, auth, backoffice, reservas)
├── CLAUDE.md / AGENTS.md # como trabalhar no repo
└── DEPLOY.md             # autenticação do backoffice e operação
```

Astro procura ficheiros `.astro` ou `.md` em `src/pages/`. Cada página fica
exposta como rota a partir do nome do ficheiro.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | **Site completo em `localhost:4323`**            |
| `npm run dev:site`        | Só as páginas, sem backoffice (ver nota)         |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

> `npm run dev` é o que quer em 99% dos casos: arranca o Astro e o `netlify dev`
> por cima, em **http://localhost:4323**. É a única forma de ter as funções, o
> login e a guarda do backoffice — que é como o site corre em produção.
>
> O `npm run dev:site` é o Astro cru. Serve as páginas depressa, mas não tem
> funções nenhumas: o login dá 404 e o `/admin.html` abre sem guarda.
>
> Precisa de Node >= 22.12 (`nvm use` — há um `.nvmrc`). Credenciais locais e
> configuração de produção em [DEPLOY.md](DEPLOY.md).

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
