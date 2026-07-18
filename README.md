# AGRYN Enterprise

Plataforma multicultura de inteligência agrícola que integra propriedades, talhões, monitoramento, análises, atividades, custos e conhecimento agronômico. A evolução preserva os módulos operacionais existentes e adiciona uma base moderna, responsiva e rastreável.

## Plataforma atual

- Identidade AGRYN com paleta oficial, Orbitron nos títulos e Inter nos textos.
- Dashboard SaaS/AgTech responsivo, com temas claro e escuro.
- Contexto persistente de propriedade, talhão, cultura, variedade, safra e estágio fenológico.
- Cadastro de propriedades e talhões sem dados de demonstração.
- Importação de limites em GeoJSON e KML, com cálculo da área em hectares.
- NDVI Sentinel-2 conectado ao talhão e ao polígono cadastrado.
- Processador FastAPI Sentinel‑2 L2A em `services/ndvi-api`, com B04/B08/SCL,
  estatísticas profissionais, qualidade por pixel e zonas de atenção.
- Caderno de campo com atividades planejadas/concluídas, quantidades, unidades e custos.
- Centro de custos consolidado por talhão e categoria.
- Hub pesquisável com 22 acessos agrícolas organizados por finalidade.
- AGRYN IA e módulos operacionais existentes preservados durante a migração.
- Índice AGRYN em estado “Não calculado” até existirem dados suficientes.
- Governança que bloqueia recomendações sem contexto e dados mínimos.
- Testes, lint, tipos e build integrados ao fluxo de publicação.

Os arquivos `agryn.html`, `clima.html` e `landing.html` permanecem disponíveis no pacote final. A rota antiga continua apenas como compatibilidade.

## Persistência e privacidade

Nesta etapa, propriedades, talhões, atividades, custos, tema e última tela ficam no armazenamento local do navegador. Não há sincronização multiusuário nem envio automático desses dados para uma nuvem. O processamento espectral completo do NDVI continua condicionado à configuração da API documentada em `docs/ndvi-integration.md`.

## Identidade oficial

O símbolo centralizado em `public/brand/agryn-mark.svg` é o ativo utilizado pela interface atual. Para a produção definitiva, recomenda-se substituir esse arquivo pela versão vetorial oficial exportada do projeto de marca, mantendo o mesmo nome e proporção.

## Desenvolvimento

Requisitos: Node.js 22 ou superior e pnpm 11.

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

As decisões arquiteturais estão em `docs/architecture`. O relatório consolidado da experiência está em `docs/agryn-redesign-summary.md`.
