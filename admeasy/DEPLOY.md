# Como fazer o deploy do AdmEasy

## 1. Rodar o schema no Supabase

1. Acesse https://supabase.com/dashboard/project/ckhcbiuwcfnbmlloduwj
2. No menu esquerdo clique em **SQL Editor**
3. Clique em **New query**
4. Cole todo o conteúdo do arquivo `schema.sql`
5. Clique em **Run** (botão verde)
6. Aguarde a mensagem "Success"

## 2. Fazer upload do projeto no GitHub

No seu computador, abra o terminal (ou Git Bash) na pasta do projeto e rode:

```bash
cd admeasy
git init
git add .
git commit -m "primeiro commit — estrutura base AdmEasy"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/admeasy.git
git push -u origin main
```

## 3. Deploy na Vercel

1. Acesse https://vercel.com
2. Clique em **Add New Project**
3. Importe o repositório **admeasy** do GitHub
4. Em **Environment Variables** adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ckhcbiuwcfnbmlloduwj.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_ZgVTTv1Mhi29gnx6ZQOiTQ_2OpdTUNA`
5. Clique em **Deploy**
6. Aguarde ~2 minutos

Pronto! O sistema estará no ar em `admeasy.vercel.app`

## 4. Criar o primeiro usuário admin

1. No Supabase, vá em **Authentication → Users**
2. Clique em **Add user**
3. Informe o e-mail e senha do administrador
4. Confirme o e-mail se solicitado
