# Backoffice — configuração e operação

O painel de gestão está em `/admin.html` e só abre com sessão iniciada. Este
documento cobre o que é preciso configurar no Netlify, o primeiro acesso, e o
que fazer quando alguma coisa corre mal.

## Como funciona, em três linhas

- Uma função de borda (`netlify/edge-functions/admin-guard.ts`) verifica o cookie
  de sessão **antes** de o `/admin.html` ser servido. Sem cookie válido, o pedido
  é reencaminhado para `/admin-login.html`.
- A entrada, o perfil e a palavra-passe são tratados por `netlify/functions/auth.mjs`
  em `/api/auth/*`. A palavra-passe nunca é guardada — só a derivação `scrypt`.
- A sessão é um cookie `HttpOnly`, `Secure`, `SameSite=Strict`, válido 12 horas e
  com corte por 30 minutos de inatividade. É revogável: mudar a palavra-passe ou
  terminar as outras sessões invalida-as imediatamente.

## Variáveis de ambiente (Netlify → Project configuration → Environment variables)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `SESSION_SECRET` | **Sim** | Assina os cookies de sessão |
| `ADMIN_BOOTSTRAP_PASSWORD` | Só no primeiro deploy | Cria a conta de administrador |
| `ADMIN_USERNAME` | Não | Nome de utilizador (por omissão `admin`) |
| `ADMIN_PASSWORD_RESET` | Só para repor | Ver "Palavra-passe perdida" |

⚠️ Deixe as variáveis em **All scopes** (o valor por omissão). A `SESSION_SECRET`
é lida tanto pelas Functions como pela Edge Function que guarda o painel — se o
âmbito for restringido só a *Builds*, a Edge Function deixa de a ver e o painel
passa a reencaminhar toda a gente para a entrada com a mensagem
"A autenticação ainda não está configurada no servidor".

Gerar o `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Trocar esta chave termina todas as sessões abertas — é a forma mais rápida de
expulsar toda a gente do painel se for preciso.

⚠️ A variável **`ADMIN_PASSWORD`** era usada pela versão anterior e já não faz
nada. **Apague-a** depois de publicar esta versão.

## Primeiro acesso

1. Defina `SESSION_SECRET` e `ADMIN_BOOTSTRAP_PASSWORD` no Netlify e publique.
2. Abra `https://<site>/admin.html` — vai dar à página de entrada.
3. Entre com o utilizador (`admin`) e a palavra-passe de arranque.
4. O painel abre já em **Definições da Conta → Palavra-passe** e não deixa
   publicar nada enquanto ela não for trocada. Escolha uma nova (mínimo 12
   caracteres).
5. Apague `ADMIN_BOOTSTRAP_PASSWORD` do Netlify. A conta já vive no
   armazenamento e a variável deixou de ser precisa.

## Palavra-passe perdida

Não há recuperação por email — foi uma decisão deliberada, para não haver mais
uma via de entrada na conta. A reposição é manual:

1. No Netlify, defina `ADMIN_PASSWORD_RESET` com uma palavra-passe temporária.
2. Faça um novo deploy (Deploys → Trigger deploy).
3. Entre com essa palavra-passe. Todas as sessões anteriores foram terminadas e
   o painel obriga logo a definir uma nova.
4. **Apague `ADMIN_PASSWORD_RESET`** do Netlify.

A reposição só é aplicada uma vez por valor: deixar a variável lá não repõe a
palavra-passe a cada deploy, mas deixa-a escrita nas definições do projeto — por
isso deve mesmo ser removida.

## Definições da Conta

Na barra lateral, **Definições da Conta**:

- **Perfil** — nome a apresentar e email de contacto.
- **Palavra-passe** — mudar a palavra-passe. Termina todas as sessões abertas.
- **Segurança** — sessões ativas (com "Terminar as outras sessões") e o registo
  dos últimos 50 acessos. Se aparecer uma entrada de um IP ou dispositivo
  desconhecido, mude já a palavra-passe: isso corta o acesso a quem lá esteja.

## O que está protegido

| | |
|---|---|
| Acesso ao painel | Cookie de sessão verificado na borda |
| Palavras-passe | `scrypt` (N=32768), comparação de tempo constante |
| Força bruta | 5 tentativas por conta e 10 por IP em 15 min, com bloqueio escalonado até 24 h |
| CSRF | `SameSite=Strict` + verificação de `Origin` em tudo o que altera estado |
| Dados de clientes | `reservas` e `candidaturas` exigem sessão; o conteúdo do site é público por lista explícita |
| Cabeçalhos | CSP, `frame-ancestors 'none'`, `noindex`, `no-store` (ver `public/_headers`) |
| Sessão esquecida aberta | Aviso aos 13 min, fim aos 15; o servidor corta aos 30 |

## Desenvolvimento e testes

```bash
npm ci
npx playwright test          # arranca netlify dev na porta 4323 e corre tudo
```

As credenciais locais estão em `tests/start-dev.sh` e são só de desenvolvimento —
em produção os valores vêm das definições do Netlify. Ver também `.env.example`.

Para abrir o painel localmente: `sh tests/start-dev.sh`, depois
http://localhost:4323/admin.html com `admin` / `desenvolvimento-local-123`.

## Verificação depois de publicar

```bash
curl -I https://<site>/admin.html                                  # 302 para /admin-login.html
curl -i 'https://<site>/.netlify/functions/data?key=reservas'      # 401
curl -i 'https://<site>/.netlify/functions/data?key=siteGeral'     # 200
curl -I https://<site>/admin-login.html | grep -i "content-security-policy\|x-robots"
```

E numa janela anónima: `https://<site>/admin.html` tem de parar na entrada.
