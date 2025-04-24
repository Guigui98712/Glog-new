# Instruções para Correção do Problema

## Problema Identificado

O problema principal está relacionado à estrutura do banco de dados. A tabela `obras` no Supabase não possui o campo `user_id`, mas o código está tentando usar esse campo para filtrar as obras por usuário. Isso causa o erro 500 quando você tenta acessar a tabela `obras`.

## Solução

1. **Execute o script SQL atualizado**

   O arquivo `reset_database.sql` foi atualizado para incluir o campo `user_id` na tabela `obras` e configurar as políticas de segurança adequadas. Você precisa executar este script no seu banco de dados Supabase.

   Para fazer isso:
   
   - Acesse o painel do Supabase (https://app.supabase.com)
   - Selecione seu projeto
   - Vá para "SQL Editor"
   - Crie uma nova consulta
   - Cole o conteúdo do arquivo `reset_database.sql`
   - Execute a consulta

2. **Atualize o ID do usuário nos dados de exemplo**

   No script SQL, há uma linha que insere dados de exemplo com um UUID genérico:
   
   ```sql
   INSERT INTO public.obras (nome, endereco, status, cliente, responsavel, user_id)
   VALUES 
     ('Residencial Parque das Flores', 'Rua das Flores, 123', 'em_andamento', 'João Silva', 'Maria Oliveira', '00000000-0000-0000-0000-000000000000'),
     ('Edifício Comercial Centro', 'Av. Paulista, 1000', 'pendente', 'Empresa XYZ', 'Carlos Santos', '00000000-0000-0000-0000-000000000000');
   ```
   
   Substitua `'00000000-0000-0000-0000-000000000000'` pelo seu ID de usuário real. Você pode obter seu ID de usuário executando a seguinte consulta no SQL Editor do Supabase:
   
   ```sql
   SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com';
   ```

3. **Reinicie o servidor de desenvolvimento**

   Após executar o script SQL, reinicie o servidor de desenvolvimento:
   
   ```
   npm run dev
   ```

4. **Teste a aplicação**

   Agora você deve conseguir:
   
   - Fazer login
   - Ver a lista de obras (vazia ou com os dados de exemplo)
   - Criar novas obras
   - Editar e excluir obras

## Explicação Técnica

O problema ocorreu porque:

1. O código em `src/lib/api.ts` estava tentando filtrar obras por `user_id`, mas esse campo não existia na tabela.
2. As políticas de segurança do Supabase estavam configuradas para permitir acesso a todos os usuários autenticados, em vez de restringir o acesso apenas às obras do próprio usuário.

As alterações feitas:

1. Adicionamos o campo `user_id` à tabela `obras` com uma referência à tabela `auth.users`.
2. Atualizamos as políticas de segurança para garantir que os usuários só possam ver, criar, atualizar e excluir suas próprias obras.
3. Atualizamos o arquivo de tipos `src/types/supabase.ts` para incluir o campo `user_id` na definição da tabela `obras`.

Estas alterações garantem que cada usuário só possa ver e gerenciar suas próprias obras, implementando corretamente o isolamento de dados entre usuários. 