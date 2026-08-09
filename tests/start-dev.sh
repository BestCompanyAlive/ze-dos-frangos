#!/bin/sh
# Arranca o Astro sozinho na porta 4321 e o "netlify dev" por cima na 4323
# (proxy + functions + Blobs). Ver netlify.toml [dev] e .netlify-dev-noop.sh
# para o porquê do comando placeholder — o "netlify dev" não reconhece o
# formato de log mais recente do Astro como sinal de "servidor pronto".
npm run dev -- --port 4321 &
exec npx netlify dev --offline
