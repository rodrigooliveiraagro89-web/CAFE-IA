# Resumo técnico — plataforma AGRYN

Data: 18 de julho de 2026

## Resultado

A AGRYN evoluiu de um hub visual para uma plataforma multicultura com contexto operacional persistente. A entrega preserva os módulos existentes, o clima e o NDVI e adiciona os fluxos fundamentais de propriedade, talhão, caderno de campo e custos.

## Identidade aplicada

- Paleta `#10B981`, `#059669`, `#22C55E`, `#0F172A`, `#FFFFFF` e `#FBBF24`.
- Orbitron para títulos e Inter para textos.
- Temas claro e escuro, foco visível e preferência persistida.
- Interface escura premium com cartões contidos, brilho sutil e ícones lineares.
- Símbolo AGRYN centralizado em um único ativo substituível.
- Capa social própria em `public/brand/agryn-social.png`.

## Experiência entregue

- Dashboard com contexto real, indicadores vazios honestos e Índice AGRYN protegido.
- Cadastro de propriedades com produtor, responsável técnico e localização.
- Cadastro de talhões com cultura, variedade, safra, plantio, fenologia, espaçamento, população e área.
- Importação de limites GeoJSON/KML e cálculo geodésico em hectares.
- Seleção ativa de propriedade/talhão refletida no cabeçalho e nas telas.
- NDVI por satélite conectado ao limite geográfico do talhão.
- Caderno de campo com tipos de atividade, data, status, quantidade, unidade, notas e custo.
- Centro de custos derivado somente dos lançamentos do usuário.
- Hub com 22 acessos em Monitoramento, Análises, Manejo, Gestão, Inteligência Artificial e Relatórios.
- Navegação móvel com Início, Áreas, Análises, Mapas e Mais.

## Segurança e integridade

- Nenhum índice, custo, produtividade ou número agrícola é inventado.
- O Índice AGRYN permanece “Não calculado” até os requisitos serem atendidos.
- Recomendações continuam bloqueadas sem dados mínimos e plausíveis.
- O catálogo Sentinel-2 consulta uma fonte pública real.
- Sem uma API de processamento configurada, o NDVI não fabrica raster ou estatística.
- Nesta etapa, os dados operacionais ficam somente no navegador do usuário.

## Arquitetura

- React 19, TypeScript, Vite e CSS baseado em tokens.
- Domínios separados para contexto agrícola, registros de campo, segurança e NDVI.
- Hooks persistentes para propriedades/talhões e caderno de campo.
- Catálogo central de módulos e shell responsivo.
- Páginas legadas preservadas durante a migração gradual.

## Validação executada

- ESLint aprovado sem avisos.
- TypeScript aprovado em modo estrito.
- Vitest: 6 arquivos e 17 testes aprovados.
- Build de produção aprovado.
- Parser GeoJSON/KML e consolidação de custos cobertos por testes.
- Fluxos responsivos sujeitos à verificação final no navegador antes da publicação.

## Limites conhecidos

- Shapefile precisa ser convertido para GeoJSON nesta versão.
- Sincronização multiusuário, autenticação e banco de dados ainda não fazem parte desta etapa local.
- O símbolo atual deve ser substituído pelo arquivo vetorial oficial assim que o ativo original estiver disponível.
- O processamento espectral completo exige o serviço descrito em `docs/ndvi-integration.md`.
