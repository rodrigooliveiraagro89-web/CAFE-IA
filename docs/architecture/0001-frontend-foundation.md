# ADR 0001 — Fundação da nova interface

## Status

Aceito na Etapa 1 da modernização.

## Decisão

A nova plataforma será construída com React, TypeScript, Vite e Tailwind compilado. O HTML legado continuará disponível durante a migração, mas não será reutilizado como base arquitetural.

O navegador poderá persistir apenas preferências não sensíveis. Chaves privadas de provedores de IA deverão ser utilizadas exclusivamente por um backend autenticado, nunca solicitadas ou armazenadas pelo frontend novo.

Recomendações agronômicas e relatórios técnicos terão uma barreira obrigatória de dados mínimos, validação de plausibilidade, rastreabilidade e revisão profissional.

## Consequências

- O carregamento deixa de depender de compilação Tailwind e módulos React via CDN.
- A aplicação passa a ter verificação estática, testes e build reproduzível.
- A migração pode ocorrer módulo a módulo sem interromper a operação atual.
- Recursos de IA só serão religados após a criação do backend seguro.
