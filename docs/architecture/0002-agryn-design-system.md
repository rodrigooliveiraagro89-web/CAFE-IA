# ADR 0002 — Identidade AGRYN e integração progressiva

## Status

Aceito em 18 de julho de 2026.

## Contexto

O produto precisava adotar integralmente a marca AGRYN sem interromper as funções agrícolas já disponíveis nas páginas operacionais. A referência visual define verde esmeralda, verde profundo, verde vivo, azul-marinho, branco e amarelo, com Orbitron em títulos e Inter em textos.

## Decisão

- A nova experiência usa tokens semânticos para cores, tipografia, espaçamento, raios e sombras. Componentes consomem esses tokens em vez de valores isolados.
- A marca é representada por um SVG local, leve e escalável, inspirado no símbolo fornecido: folha, letra “A” e circuitos.
- O shell principal, o dashboard, o hub de módulos, os cartões, os indicadores e a navegação móvel são componentes reutilizáveis.
- As funções ainda não migradas continuam acessíveis pelas páginas existentes. Cada módulo aponta para uma rota ou aba real, inclusive diagnóstico foliar, imagem, defensivos, clima, mapas, cálculos e relatórios.
- Propriedade, alertas e indicadores não recebem valores simulados. Sem contexto real, a interface apresenta estado vazio e orienta o próximo passo.
- A AGRYN IA ocupa posição central, mas recomendações técnicas continuam sujeitas à validação mínima e ao futuro backend seguro.

## Consequências

- A identidade visual pode evoluir de forma consistente em toda a plataforma.
- A experiência é publicável sem eliminar fluxos operacionais existentes.
- O próximo ciclo pode migrar módulos individualmente para React sem alterar a navegação do usuário.
- Dados reais, autenticação e IA conectada permanecem dependentes da camada de serviços segura.
