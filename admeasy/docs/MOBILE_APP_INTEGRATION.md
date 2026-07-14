# AdmEasy — Guia de Integração para o App Mobile (iOS/Android)

Este documento descreve a arquitetura do sistema web AdmEasy para orientar a
construção dos apps iOS e Android (via Lovable) que vão consumir o mesmo
backend. **Nenhum valor de credencial, segredo ou dado pessoal está incluído
aqui** — apenas nomes de variáveis, nomes de tabelas/rotas e descrição de
fluxos.

---

## 1. Framework e linguagem

- **Next.js 14.2.5** (App Router), **React 18**, **TypeScript 5**.
- Estilização com **Tailwind CSS 3**.
- Gráficos com **Chart.js 4** (+ `react-chartjs-2`).
- Geração de PDF no cliente com **jsPDF 4**.
- Todo o código de UI é `'use client'` (Client Components) — a lógica de
  dados roda direto no navegador via SDK do Supabase, não por Server
  Components/Server Actions.

## 2. Backend

Não há um backend próprio separado — o backend é **Supabase**
(Postgres + Auth + Storage), acessado:
- **Diretamente do client** (`@supabase/supabase-js`) na maior parte das
  telas, usando a chave pública (anon) + Row Level Security.
- Por um punhado de **rotas de API do Next.js** (`app/api/*`, ver seção 6),
  que rodam no servidor e usam a chave de serviço (service role) do
  Supabase quando precisam ignorar RLS (ex.: criar acesso ao portal,
  processar webhooks de pagamento).

## 3. Banco de dados

**Supabase Postgres**, multi-tenant por `organization_id` em praticamente
todas as tabelas, com isolamento via **Row Level Security (RLS)** — uma
função `get_org_id()` resolve a organização do usuário autenticado e as
políticas (`org_isolation`) restringem cada tabela a `organization_id =
get_org_id()`.

## 4. Autenticação e login

Usa **Supabase Auth** (e-mail/senha) para dois públicos distintos, ambos
sobre o mesmo mecanismo de Auth, mas com vínculos de aplicação diferentes:

1. **Equipe interna da imobiliária** (quem usa o sistema completo, dashboard
   etc.): login normal do Supabase Auth, vinculado a uma linha na tabela
   `users` (perfil/papel da pessoa dentro da organização).
2. **Portal do cliente (locatário e locador)**, externo, em `/portal` +
   `/portal/login`: também Supabase Auth (e-mail/senha), mas o vínculo é
   feito pela coluna `clientes.usuario_portal_id` (aponta pro
   `auth.users.id`). Depois do login, o app busca em `clientes` o registro
   com esse `usuario_portal_id` pra saber **quem** é (nome, organização) e
   **que tipo** de cliente é (`tipo = 'locatario'` ou `'locador'`), e mostra
   um painel diferente pra cada um.
   - Criar/redefinir esse acesso é feito pela equipe interna, por uma rota
     de API dedicada (ver seção 6) — nunca diretamente pelo cliente final.

Não existe middleware de borda (`middleware.ts`) protegendo rotas — a
verificação de sessão e o redirecionamento pra tela de login acontecem no
próprio componente de cada página (client-side), checando a sessão do
Supabase Auth ao montar.

## 5. Arquivos de configuração de banco e autenticação

| Arquivo | Papel |
|---|---|
| `lib/supabase.ts` | Client público do Supabase (chave anon), usado em quase todo o app. |
| `lib/supabaseAdmin.ts` | Client administrativo (chave de serviço) — **só pode ser importado em rotas de API** (`app/api/**/route.ts`), nunca em código que roda no navegador. |
| `lib/portal-auth.ts` | Login/logout/sessão do portal externo (locatário/locador) e resolução do vínculo `clientes.usuario_portal_id`. |
| `lib/OrganizationContext.tsx` | Contexto React que carrega e disponibiliza a organização (imobiliária) do usuário logado pro resto do app interno. |
| `.env.local` (não versionado) | Valores reais das variáveis de ambiente — ver seção 12 pros *nomes*. |
| `.env.example` (versionado, sem segredos) | Modelo com os nomes das variáveis públicas mínimas. |

## 6. Endpoints de API existentes

Todas em `app/api/`, formato de rota do Next.js (`route.ts`):

| Rota | Método | Finalidade |
|---|---|---|
| `/api/boleto` | `POST` | Gera boleto + Pix (Mercado Pago) pra uma cobrança específica, sob demanda (ex.: locatário clica em "baixar boleto" no portal). |
| `/api/cadastro` | `POST` | Fluxo de cadastro/assinatura de uma nova imobiliária no AdmEasy (onboarding SaaS, integra com Stripe). |
| `/api/cron/lembretes-boleto` | `GET` | Job agendado (ver `vercel.json`, roda 1x/dia) que gera boleto+Pix e envia e-mail automático 10 dias antes do vencimento, e um lembrete 2 dias antes. Protegida por um header `Authorization: Bearer <CRON_SECRET>`. |
| `/api/portal/gerenciar-acesso` | `POST` | Chamada pela equipe interna pra criar ou redefinir a senha de acesso ao portal de um cliente (locatário ou locador). Exige que quem chama seja `admin` da organização. |
| `/api/poupanca/corrigir` | `POST` | Cálculo de correção monetária (índice de poupança) usado em reajustes/rescisões. |
| `/api/stripe/webhook` | `POST` | Webhook do Stripe — trata eventos de assinatura SaaS da própria AdmEasy (a mensalidade que a imobiliária paga pra usar o sistema), atualiza `organizations.status_assinatura`. |
| `/api/webhook/mercadopago` | `POST`, `GET` | Webhook do Mercado Pago — recebe a confirmação de pagamento do **aluguel** (boleto/Pix pago pelo locatário) e marca a cobrança como paga. Valida assinatura HMAC antes de confiar no payload. |

Não há um "REST API" genérico documentado (tipo OpenAPI/Swagger) — o app
mobile deve seguir o mesmo caminho que o web já usa hoje: falar direto com o
Supabase (mesma URL/chave anon, mesmas tabelas, mesmas RLS) para leitura e
escrita de dados, e só chamar essas rotas Next.js pontuais quando precisar de
lógica de servidor (gerar boleto, criar acesso ao portal etc.).

## 7. Onde ficam contratos, laudos, apólices e documentos

Tudo fica no **Supabase Storage**, bucket único chamado **`documentos`**,
organizado por pastas (prefixos de caminho, não pastas reais):

| Prefixo | Conteúdo |
|---|---|
| `contratos/{id_do_contrato}/kit/{categoria}/{arquivo}` | "Kit de documentos" de cada contrato: CPF/RG do titular e cônjuge (locatário, locador e 2º locatário), comprovante de endereço, comprovante de estado civil, contrato assinado, laudo de vistoria assinado, apólice de seguro incêndio, apólice de seguro fiança, comprovante de caução. Cada categoria aceita múltiplos arquivos. |
| `vistorias/{organization_id}/{arquivo}` | Fotos das vistorias. |
| `analises/{id_da_analise}/{arquivo}` | Documentos anexados numa análise cadastral de locatário. |
| `chamados/{organization_id}/{arquivo}` | Anexos/fotos enviados em chamados/demandas (portal do locatário). |
| `logos/{organization_id}.{ext}` | Logo da imobiliária. |

O app mobile pode ler/baixar esses arquivos pela URL pública do Storage
(`getPublicUrl`), do mesmo jeito que o portal web já faz.

## 8. Tabelas / entidades principais

| Entidade | Tabela | Observações |
|---|---|---|
| Imobiliárias (tenants) | `organizations` | Cada imobiliária cliente da AdmEasy é uma linha aqui; tudo mais se isola por `organization_id`. |
| Usuários internos (equipe) | `users` | Vinculada a `auth.users`; tem `perfil`/papel dentro da organização. |
| Clientes (locatário, locador, comprador, vendedor, lead) | `clientes` | Um único cadastro pra todos os tipos, diferenciado pela coluna `tipo`. Tem `usuario_portal_id` (vínculo de login do portal) e `tem_portal`. |
| Imóveis | `imoveis` | Cadastro de imóveis administrados. |
| Contratos | `contratos` | Locação/administração — valores, datas, garantia (caução/fiador/seguro fiança), seguro incêndio, comissões, honorários de locação. |
| Cobranças | `cobrancas` | Uma linha por mês de aluguel a cobrar; guarda também os campos de repasse (`valor_repasse`, `status_repasse`, datas) e de boleto/Pix (`boleto_url`, `pix_qr_code`, `mp_payment_id`). |
| Repasses | *(dentro de `cobrancas`)* | Não é tabela separada — repasse é um estado/campo da própria cobrança. |
| Demandas (chamados/manutenção) | `demandas` | Fluxo de solicitação → decisão → execução → conclusão, com histórico em `demandas_historico`. |
| Vistorias (laudos) | `vistorias` | Vistoria de entrada/saída, ambientes, fotos, estado de conservação. |
| Fornecedores | `fornecedores` | Prestadores de serviço usados nas demandas. |
| Custos da imobiliária | `despesas` | Custos fixos/avulsos da própria imobiliária (aluguel do escritório, salários etc.). |
| Meta anual | `metas` | Meta de receita mensal recorrente de administração, por ano. |
| Planos de assinatura SaaS | `planos` | Planos que a própria AdmEasy vende às imobiliárias. |
| Log de atividades | `logs` | Auditoria de ações da equipe interna. |

## 9. Perfis e permissões

- **Multi-tenant por RLS**: toda tabela relevante tem `organization_id`, e
  o Postgres só devolve linhas da organização do usuário autenticado
  (função `get_org_id()` + políticas `org_isolation`).
- **Equipe interna**: papel gravado em `usuarios_organizacao.papel` (ex.:
  `admin`) — algumas ações sensíveis (como criar acesso ao portal de um
  cliente) exigem `papel = 'admin'`.
- **Portal externo (locatário/locador)**: não tem "papel" — o que ele pode
  ver é decidido pelo `tipo` do cliente vinculado (`locatario` ou
  `locador`) e pelas queries filtrarem só os dados daquele `cliente_id`
  (contratos, cobranças e demandas onde ele é a parte envolvida).

## 10. Repositório GitHub

`https://github.com/Smartlancebrasil/admeasy` (branch principal: `main`).

## 11. Ambiente de homologação

Não há um ambiente de staging dedicado e separado. O deploy é no **Vercel**
(plano Pro): a branch `main` vai para produção, e cada outra branch/PR gera
automaticamente uma **preview deployment** própria — é isso que tem sido
usado como homologação antes de mesclar mudanças em produção.

## 12. Variáveis de ambiente necessárias (nomes, sem valores)

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (pública). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase — é a que o app mobile também vai usar. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço do Supabase — **nunca deve ir para o app mobile nem para qualquer código client-side**, só é usada em rotas de servidor. |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site (usada em redirecionamentos/links). |
| `MERCADOPAGO_ACCESS_TOKEN` | Credencial de servidor do Mercado Pago (geração de boleto/Pix). |
| `MERCADOPAGO_WEBHOOK_SECRET` | Segredo pra validar a assinatura do webhook do Mercado Pago. |
| `STRIPE_SECRET_KEY` | Credencial de servidor do Stripe (assinatura SaaS da AdmEasy). |
| `STRIPE_WEBHOOK_SECRET` | Segredo pra validar a assinatura do webhook do Stripe. |
| `RESEND_API_KEY` | Credencial do serviço de e-mail transacional (Resend). |
| `EMAIL_REMETENTE` | Endereço de e-mail remetente usado nos envios automáticos. |
| `CRON_SECRET` | Segredo que autoriza a execução do cron de lembretes de boleto. |

---

### Recomendação para o app mobile

Pro app iOS/Android reaproveitar a mesma base: usar o SDK oficial do
Supabase (há SDKs nativos/Flutter/React Native) apontando para a mesma
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, autenticando
locatário/locador do mesmo jeito que o portal web faz hoje (login por
e-mail/senha, resolvendo o vínculo em `clientes.usuario_portal_id`), e
reaproveitando as mesmas tabelas e o mesmo bucket de Storage descritos
acima. As rotas `/api/boleto` e `/api/cron/lembretes-boleto` podem ser
chamadas normalmente via HTTPS a partir do app quando precisar gerar boleto
sob demanda; o restante da leitura/escrita de dados não precisa passar por
elas.
