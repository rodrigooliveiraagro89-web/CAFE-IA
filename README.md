# AGRYN Café

Plataforma especializada em cafeicultura para organizar propriedades e talhões, acompanhar clima e NDVI, interpretar análises de solo, registrar atividades e custos e apoiar decisões agronômicas com rastreabilidade.

## Produto atual

- Entrada pública, cadastro, login e recuperação de senha.
- Perfis Free e Pro, teste de 14 dias e checkout Asaas.
- Propriedades e talhões de café arábica ou conilon/robusta.
- Importação de limites GeoJSON/KML e cálculo de área.
- NDVI Sentinel-2 por talhão, com histórico, qualidade de cena e zonas de atenção.
- Análise de solo, calagem e planejamento nutricional com bloqueios de segurança.
- Diagnóstico por foto e assistente de IA orientados à triagem, sem prescrição automática.
- Caderno de campo com fotos, áudio, custos e sincronização em nuvem.
- Centro de ações, mercado do café, clima, calculadoras e relatórios.
- PWA instalável com preservação dos registros locais durante períodos offline.
- Supabase Auth, Row Level Security, Storage privado e trilha de eventos de cobrança.

As páginas antigas `agryn.html`, `cafe-real-ia.html` e `clima.html` permanecem somente como redirecionamentos de compatibilidade. A apresentação pública está em `landing.html`.

## Arquitetura

- Frontend: React 19, TypeScript, Vite e CSS baseado em tokens.
- Dados e autenticação: Supabase.
- Processamento NDVI e recursos de IA: FastAPI em `services/ndvi-api`.
- Pagamentos: Asaas, com webhook idempotente e atualização de plano no servidor.

## Desenvolvimento

Requisitos: Node.js 22 ou superior, pnpm 11 e Python 3.12 para a API.

```bash
pnpm install
pnpm dev
```

## Validação

```bash
pnpm lint
pnpm test
pnpm build
```

Para a API:

```bash
cd services/ndvi-api
python -m pytest
```

As decisões arquiteturais ficam em `docs/architecture` e o resumo da entrega em `docs/agryn-redesign-summary.md`.
