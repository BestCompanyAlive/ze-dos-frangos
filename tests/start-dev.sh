#!/bin/sh
# Arranca o Astro sozinho na porta 4321 e o "netlify dev" por cima na 4323
# (proxy + functions + edge functions + Blobs). Ver netlify.toml [dev] e
# .netlify-dev-noop.sh para o porquê do comando placeholder — o "netlify dev"
# não reconhece o formato de log mais recente do Astro como sinal de
# "servidor pronto".

# As variáveis de ambiente TÊM de vir de um ficheiro .env: o "netlify dev"
# ignora as do processo e é o .env que injeta tanto nas functions como nas edge
# functions. Sem isto, o guarda de /admin.html não vê a SESSION_SECRET e
# reencaminha toda a gente para a página de entrada.
#
# Estes valores são só de desenvolvimento. Em produção vêm das definições do
# projeto no Netlify e este ficheiro não existe (está no .gitignore).
ENV_FILE=".env"
garantir_var() {
  if [ ! -f "$ENV_FILE" ] || ! grep -q "^$1=" "$ENV_FILE"; then
    [ -f "$ENV_FILE" ] || printf '# Desenvolvimento local — criado por tests/start-dev.sh. Não usar em produção.\n' > "$ENV_FILE"
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
    echo "tests/start-dev.sh: acrescentei $1 ao $ENV_FILE"
  fi
}
garantir_var SESSION_SECRET dev-apenas-nao-usar-em-producao-0123456789abcdef
garantir_var ADMIN_USERNAME admin
garantir_var ADMIN_BOOTSTRAP_PASSWORD desenvolvimento-local-123

npm run dev -- --port 4321 &
exec npx netlify dev --offline
