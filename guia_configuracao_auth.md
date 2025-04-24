# Guia de Configuração da Autenticação no Supabase

Este guia explica como configurar a autenticação no Supabase para o G-Log.

## 1. Habilitar a Autenticação no Supabase

1. Acesse o [Dashboard do Supabase](https://app.supabase.com)
2. Faça login na sua conta
3. Selecione o projeto com a URL `https://ionichwiclbqlfcsmhhy.supabase.co`
4. No menu lateral, clique em "Authentication"
5. Vá para a aba "Providers"
6. Certifique-se de que o provedor "Email" está habilitado
7. Desative a opção "Confirm email" para simplificar o processo de cadastro

## 2. Executar o Script SQL de Autenticação

1. No menu lateral, clique em "SQL Editor"
2. Clique em "New Query" (Nova Consulta)
3. Copie o conteúdo do arquivo `setup_auth.sql` que foi criado no seu projeto
4. Cole o conteúdo no editor SQL do Supabase
5. Clique em "Run" (Executar)

O script fará o seguinte:
- Configurar as políticas de segurança para as tabelas existentes
- Criar uma tabela de perfis de usuário
- Configurar um trigger para criar automaticamente um perfil quando um usuário se cadastra

## 3. Executar o Script SQL para Adicionar user_id às Obras

1. No menu lateral, clique em "SQL Editor"
2. Clique em "New Query" (Nova Consulta)
3. Copie o conteúdo do arquivo `add_user_id_to_obras.sql` que foi criado no seu projeto
4. Cole o conteúdo no editor SQL do Supabase
5. Clique em "Run" (Executar)

O script fará o seguinte:
- Adicionar o campo `user_id` à tabela `obras`
- Atualizar as políticas de segurança para filtrar por usuário
- Configurar permissões para que usuários só possam ver, editar e excluir suas próprias obras

## 4. Configurar o CORS

1. No menu lateral, clique em "Settings"
2. Vá para a aba "API"
3. Na seção "CORS", adicione os seguintes URLs:
   - `http://localhost:8083`
   - `http://26.244.238.245:8083`
   - `http://192.168.68.110:8083`
4. Clique em "Save"

## 5. Testar a Autenticação

1. Acesse a aplicação em `http://localhost:8083/login`
2. Crie uma nova conta com seu email, senha e nome
3. Faça login com as credenciais criadas
4. Verifique se você consegue acessar todas as funcionalidades da aplicação
5. Crie uma obra e verifique se ela aparece apenas para o seu usuário

## Modo de Desenvolvimento

Se você estiver desenvolvendo localmente e não quiser usar o Supabase, pode usar o "Modo de desenvolvimento":

1. Na tela de login, clique no botão "Modo de desenvolvimento (sem Supabase)"
2. Isso criará um usuário local armazenado no localStorage do navegador
3. Você poderá usar todas as funcionalidades da aplicação sem precisar do Supabase

## Solução de Problemas

Se encontrar problemas com a autenticação, verifique:

1. Se as variáveis de ambiente estão configuradas corretamente no arquivo `.env.local`
2. Se o Supabase está online e acessível
3. Se o CORS está configurado corretamente
4. Se as tabelas foram criadas no banco de dados
5. Se as políticas de segurança estão configuradas corretamente

Para mais informações, consulte a [documentação do Supabase sobre autenticação](https://supabase.com/docs/guides/auth). 