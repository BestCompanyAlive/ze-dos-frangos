#!/bin/sh
# Arranca o Astro numa porta interna (4399) e o "netlify dev" por cima na 4323
# (proxy + functions + edge functions + Blobs).
#
# ►► O site a sério é o http://localhost:4323 ◄◄
#
# A porta interna é deliberadamente esquisita. Enquanto foi a 4321 — a porta por
# omissão do Astro, a que toda a gente escreve — ficava lá um site a responder
# que parecia bom mas não tinha funções nenhumas: o login dava 404 e o
# /admin.html abria sem guarda. Agora quem escrever 4321 não encontra nada.
#
# Ver netlify.toml [dev] e .netlify-dev-noop.sh para o porquê do comando
# placeholder — o "netlify dev" não reconhece o formato de log mais recente do
# Astro como sinal de "servidor pronto".

# O Astro exige Node >= 22.12 (ver "engines" no package.json). Com o Node errado
# ele morre em silêncio e o "netlify dev" fica um minuto à espera de uma porta
# que nunca abre, o que não diz nada a ninguém. Mais vale parar já.
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo ""
  echo "  Node $(node -v 2>/dev/null || echo 'não encontrado') — este projeto precisa de >= 22.12."
  echo "  Experimente:  nvm use        (há um .nvmrc na raiz)"
  echo ""
  exit 1
fi

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

npm run dev:site -- --port 4399 &
exec npx netlify dev --offline
