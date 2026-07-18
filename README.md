# AGRYN Enterprise

Plataforma de inteligência agrícola que integra tecnologia, dados e conhecimento agronômico. A modernização preserva os módulos operacionais existentes enquanto estabelece uma experiência premium, responsiva e segura para a evolução do produto.

## Etapa 1 — identidade e experiência

- Identidade AGRYN aplicada ao produto e às páginas operacionais.
- Dashboard SaaS/AgTech responsivo com temas claro e escuro.
- Navegação lateral recolhível no desktop e barra inferior no celular.
- Hub pesquisável com 16 módulos organizados por finalidade.
- AGRYN IA como ponto central de entrada, sem gerar recomendações fictícias.
- Indicadores em estado vazio honesto até a seleção de propriedade e dados reais.
- Barreira agronômica que bloqueia recomendações sem dados mínimos.
- Preferências locais limitadas a tema e última tela.
- Testes, lint, verificação de tipos e build no fluxo de publicação.

Os arquivos `agryn.html`, `clima.html` e `landing.html` permanecem disponíveis e são copiados para o pacote final. A antiga rota é mantida apenas como redirecionamento de compatibilidade. Os cartões da nova interface encaminham o usuário diretamente às funções correspondentes durante a migração gradual.

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

As decisões arquiteturais estão registradas em `docs/architecture`. O relatório da nova experiência está em `docs/agryn-redesign-summary.md`.
