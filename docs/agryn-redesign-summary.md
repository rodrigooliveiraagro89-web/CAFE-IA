# Resumo técnico — AGRYN Café

Data: 8 de agosto de 2026

## Resultado

A AGRYN foi consolidada como uma plataforma exclusiva para cafeicultura. O fluxo reúne a propriedade, os talhões de café, o histórico de campo e os sinais de clima, solo, satélite e mercado em uma única base operacional.

## Experiência entregue

- Página pública e tela de entrada com proposta de valor, planos e transparência técnica.
- Cadastro, login, recuperação de senha e teste Pro seguro por função de servidor.
- Centro de ações priorizado por pendências reais: atividade atrasada, análise de solo, limite geográfico e atualização do NDVI.
- Cadastro de café arábica e conilon/robusta com safra e estágio fenológico.
- Mapeamento GeoJSON/KML, contexto ativo por propriedade/talhão e NDVI Sentinel-2.
- Análise de solo, calagem e nutrição com critérios mínimos antes de liberar recomendações.
- Caderno de campo com fotos, notas de voz, custos e sincronização.
- Assistente e diagnóstico visual especializados em café, apresentados como triagem.
- Mercado do café, clima, calculadoras, custos e relatórios consolidados.
- Aplicação instalável (PWA), aviso offline e sincronização posterior dos registros compatíveis.
- Rotas legadas convertidas em redirecionamentos para evitar duplicação de regras e bases antigas.

## Segurança e integridade

- Row Level Security por usuário e por relação propriedade/talhão.
- Campos de plano e teste protegidos contra alteração pelo navegador.
- Anexos em bucket privado, com acesso restrito ao proprietário.
- Webhook Asaas autenticado e idempotente, com trilha de eventos.
- Jobs NDVI isolados por usuário e imagens protegidas por URL assinada.
- Nenhum índice, custo, produtividade ou dado agronômico é inventado.
- Recomendações permanecem bloqueadas sem contexto e dados mínimos plausíveis.
- Diagnóstico por IA não substitui vistoria, bula, receituário ou responsável técnico.

## Arquitetura

- React 19, TypeScript e Vite no frontend.
- Supabase Auth, Postgres, Row Level Security, Storage e Edge Functions.
- FastAPI para processamento Sentinel-2, chat e visão computacional.
- Persistência local como contingência durante períodos sem conexão.

## Operação

- O plano Free limita propriedades e talhões; o Pro remove esses limites conforme as regras do produto.
- O teste de 14 dias e as mudanças de assinatura só podem ser ativados pelo servidor.
- A página `landing.html` é a apresentação pública; rotas antigas redirecionam para o app moderno.
- O segredo próprio para assinatura de imagens NDVI é recomendado; enquanto ele é implantado, o serviço usa um segredo de servidor já existente como contingência segura.

## Limites conhecidos

- Shapefile precisa ser convertido para GeoJSON nesta versão.
- O bloqueio de senhas vazadas deve ser ativado manualmente no painel de autenticação do Supabase.
- Recomendações agronômicas exigem validação do responsável técnico antes da execução no campo.
