CREATE POLICY \
Permitir
acesso
a
definicoes_quadros\ ON definicoes_quadros FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
