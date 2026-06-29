# AdmEasy — Sistema de Gestão Imobiliária

Plataforma white label de administração imobiliária para imobiliárias de todos os portes.

## Stack
- **Frontend:** Next.js 14 (App Router)
- **Banco de dados:** Supabase (PostgreSQL)
- **Deploy:** Vercel
- **Storage:** Supabase Storage (documentos e fotos)
- **Auth:** Supabase Auth

## Módulos
- Dashboard com alertas e linha do tempo
- Cadastro de imóveis
- Ficha completa de clientes (locatário, locador, lead)
- Contratos com controle de início/fim e vencimentos
- Reajuste automático (IGP-M, IPCA, INPC, IVAR)
- Calculadora de rescisão (Lei 8.245/91)
- Portal do locatário (login próprio, demandas, documentos)
- Portal do locador (autorizações, repasses)
- Demandas de reparo com fluxo de aprovação
- Laudos de vistoria (entrada e saída)
- Fornecedores
- Financeiro e comissões
- Consulta de crédito (SmartBuscas)
- Histórico de documentos por locação

## Configuração

### 1. Clonar o repositório
```bash
git clone https://github.com/SEU_USUARIO/admeasy.git
cd admeasy
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Variáveis de ambiente
Crie o arquivo `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
```

### 4. Banco de dados
Execute o arquivo `schema.sql` no SQL Editor do Supabase.

### 5. Rodar localmente
```bash
npm run dev
```

## Deploy (Vercel)
1. Conecte o repositório GitHub na Vercel
2. Configure as variáveis de ambiente
3. Deploy automático a cada push na branch `main`
