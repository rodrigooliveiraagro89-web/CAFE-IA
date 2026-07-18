# AGRYN — integração NDVI

## O que está ativo

- Interface integrada à central de módulos, responsiva e sem indicadores simulados.
- Camada NDVI regional pública da NASA GIBS, produto MODIS/Terra rolling 8-day, 250 m,
  exibida imediatamente sem login ou chave privada.
- Camada de cor natural NASA/MODIS para comparação visual.
- Botão de localização atual com autorização explícita do navegador e marcador no mapa.
- Desenho e edição de polígono sobre mapa, com cálculo de área em hectares.
- Consulta real ao catálogo STAC oficial do Copernicus Data Space:
  `https://stac.dataspace.copernicus.eu/v1/search`.
- Coleção primária: `sentinel-2-l2a`.
- Pré-filtro por interseção, intervalo de datas e `eo:cloud_cover`.
- Contrato assíncrono para processamento, progresso, cancelamento, retry e histórico.
- Motor testado para a fórmula, NoData, divisão por zero, máscara e estatísticas.

O mapa regional NASA é uma visualização real, mas não substitui o recorte de precisão do
Sentinel‑2. O catálogo retorna metadados reais sem que a AGRYN invente raster, métricas ou
zonas. Estatísticas e recorte Sentinel‑2 continuam bloqueados quando `VITE_NDVI_API_URL`
não está configurado.

## Fórmula e qualidade

Sentinel‑2 L2A:

`NDVI = (B08 - B04) / (B08 + B04)`

O backend deve:

1. Ler reflectância de superfície B04 e B08.
2. Recortar os COGs pelo polígono do talhão.
3. Reprojetar e alinhar grades quando necessário.
4. Aplicar SCL por pixel, descartando NoData (0), saturado/defeituoso (1), sombra (3),
   não classificado/nuvem baixa (7), nuvem média (8), nuvem alta (9), cirrus (10) e
   neve/gelo (11).
5. Tratar denominador zero e valores fora de `[-1, 1]` como inválidos.
6. Calcular cobertura válida dentro do talhão, não apenas nuvens da cena.
7. Bloquear interpretação conclusiva abaixo de 70% de cobertura válida.
8. Registrar fonte, item STAC, bandas, máscara, versão do processador e datas.

## Autenticação e segredos

A busca de catálogo usa o endpoint público do CDSE. O download/processamento de ativos pode
exigir uma conta gratuita no Copernicus Data Space e token OIDC.

1. Registre uma conta em `https://dataspace.copernicus.eu/`.
2. Cadastre a aplicação do backend conforme a documentação de APIs do CDSE.
3. Guarde `CDSE_CLIENT_ID` e `CDSE_CLIENT_SECRET` somente no ambiente do servidor.
4. Nunca use essas credenciais em variáveis `VITE_*`, porque elas são públicas no navegador.
5. Use o token do servidor apenas para ler os ativos necessários ao polígono.

O arquivo `.env.example` lista as chaves sem conter segredos.

## Contrato do processador

`POST /v1/ndvi/jobs`

Entrada: `scene_id`, `collection`, GeoJSON `geometry`, `plot_id`,
`minimum_valid_coverage_percentage` e configuração do algoritmo.

Saída inicial: `id`, `status`, `progress` e `message`.

`GET /v1/ndvi/jobs/{id}` retorna o andamento e, ao concluir, métricas, classes, áreas,
zonas de atenção, proveniência e URLs temporárias das camadas NDVI/cor natural.

`DELETE /v1/ndvi/jobs/{id}` cancela um trabalho pendente.

Arquitetura recomendada:

- FastAPI para validação e API.
- Rasterio/GDAL para COG, reprojeção, máscara e estatísticas.
- fila assíncrona para cenas grandes;
- PostGIS para talhões, zonas e histórico;
- armazenamento compatível com S3 para rasters derivados e relatórios;
- cache por hash de `scene_id + geometry + algoritmo`;
- tiles temporários ou COG renderizado por titiler.

## Limites e custos

- Sentinel‑2 e Landsat têm política de dados abertos; cadastro e limites operacionais da API
  ainda se aplicam.
- O catálogo deve ser consultado com limite de resultados, cache e backoff para HTTP 429.
- Processamentos repetidos devem reutilizar cache.
- Ler somente as janelas do COG que intersectam o talhão.
- Nenhuma API paga pode ser acionada silenciosamente.
- Computação, banco e armazenamento próprios podem gerar custo de infraestrutura, mesmo
  quando a imagem é gratuita.

## Landsat 8/9 como contingência

Adicionar um adaptador que implemente a mesma interface de fonte:

- coleção Landsat 8/9 Collection 2 Level‑2 Surface Reflectance;
- vermelho `SR_B4`, NIR `SR_B5`, resolução 30 m;
- aplicar fator de escala `DN × 0.0000275 - 0.2`;
- mascarar `QA_PIXEL`, saturação e aerossol de baixa qualidade;
- manter sensor e resolução visíveis nas comparações.

O fallback está documentado, mas ainda não está habilitado no frontend.

## Como adicionar uma nova fonte

1. Criar um adaptador de catálogo que normalize id, data, sensor, resolução, cobertura de
   nuvens, ativos e proveniência.
2. Criar um adaptador raster que declare banda vermelha, NIR, máscara de qualidade,
   escala/offset e resolução nativa.
3. Adicionar testes de fórmula, escala, NoData, nuvem, ausência de nuvem e alinhamento.
4. Comparar uma área conhecida com ferramenta geoespacial confiável.
5. Exibir diferenças de sensor e qualidade na interface.
6. Documentar autenticação, cotas, licença e custos antes de habilitar a fonte.

## Verificações

- `pnpm test` valida cálculo, máscara, estatísticas e área contra Turf.
- `pnpm test:ndvi:stac` consulta uma área real de validação em Patrocínio (MG) e exige ao
  menos uma cena Sentinel‑2 L2A do catálogo oficial.
- `pnpm lint` e `pnpm build` validam a aplicação.

Referências primárias:

- Copernicus STAC: https://documentation.dataspace.copernicus.eu/APIs/STAC.html
- Sentinel‑2 L2A/SCL: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html
- USGS Landsat Surface Reflectance: https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-reflectance
- STAC Item Search: https://api.stacspec.org/v1.0.0/item-search/
