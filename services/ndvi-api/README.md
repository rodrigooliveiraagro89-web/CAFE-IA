# AGRYN NDVI API

Serviço geoespacial que implementa o contrato assíncrono usado pelo frontend da AGRYN.
O serviço mantém as credenciais do Copernicus no servidor e nunca as envia ao navegador.

## Entrega técnica

- Sentinel‑2 L2A em reflectância de superfície.
- Bandas B04, B08, SCL e `dataMask` solicitadas juntas pelo Process API.
- NDVI: `(B08 - B04) / (B08 + B04)`.
- Exclusão SCL: 0, 1, 3, 6, 7, 8, 9, 10 e 11.
- Recorte pelo GeoJSON do talhão.
- Estatísticas: média, mínimo, máximo, mediana, desvio-padrão, CV e P10/P25/P75/P90.
- Classificação geral e relativa ao próprio talhão.
- Cobertura válida, nuvens/cirrus, sombra, água, NoData e contagem de pixels.
- Índice de uniformidade espacial.
- Agrupamento de pixels do quartil inferior em zonas de atenção.
- PNG NDVI transparente, PNG em cor natural e GeoTIFF auditável.
- Cache por entrada canônica, progresso, consulta e cancelamento.

## Configuração

Crie uma aplicação OAuth no painel Sentinel Hub do Copernicus Data Space e copie
`services/ndvi-api/.env.example` para `services/ndvi-api/.env`.

Variáveis obrigatórias:

- `CDSE_CLIENT_ID`
- `CDSE_CLIENT_SECRET`
- `PUBLIC_BASE_URL`: endereço HTTPS público deste serviço.
- `ALLOWED_ORIGINS`: site AGRYN e origens locais autorizadas.

No build do frontend, configure `VITE_NDVI_API_URL` com o mesmo endereço público. Nunca
coloque o segredo em uma variável `VITE_*`.

## Execução local

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app.main:app --reload
```

Ou:

```bash
docker build -t agryn-ndvi .
docker run --env-file .env -p 8000:8000 agryn-ndvi
```

## API

- `GET /health`
- `POST /v1/ndvi/jobs`
- `GET /v1/ndvi/jobs/{id}`
- `DELETE /v1/ndvi/jobs/{id}`
- `GET /v1/ndvi/assets/{id}/ndvi.png`
- `GET /v1/ndvi/assets/{id}/true-color.png`
- `GET /v1/ndvi/assets/{id}/ndvi.tif`

O armazenamento e a fila são locais nesta primeira implementação. Para múltiplas instâncias,
substitua os dicionários em memória por Redis/PostgreSQL e o diretório por armazenamento de
objetos compatível com S3.

## Uniformidade

`uniformidade = 100 × (1 − min(1, σ / max(|μ|, 0,15)))`

O indicador mede somente a homogeneidade espacial dos valores NDVI. Não representa
produtividade, sanidade absoluta ou recomendação de insumo.

