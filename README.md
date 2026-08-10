# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

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
