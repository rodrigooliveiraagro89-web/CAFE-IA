# ADR 0003 — pipeline NDVI desacoplado

Status: aceito.

## Decisão

A aplicação web consulta diretamente apenas metadados públicos do catálogo STAC. Todo acesso
autenticado, leitura de COG, máscara de qualidade, cálculo de NDVI, geração de tiles e
persistência acontece em um serviço geoespacial assíncrono.

## Motivos

- Credenciais CDSE não podem existir no bundle do GitHub Pages.
- O navegador não é o local adequado para ler cenas grandes nem operar GDAL.
- Fila, cache e cancelamento reduzem custo e duplicação.
- A separação permite adicionar Landsat sem acoplar a interface ao formato do provedor.
- Resultados carregam proveniência e nunca são substituídos por dados de demonstração.

## Estados obrigatórios

Sem polígono, sem cenas, excesso de nuvens, processando, concluído, autenticação falhou,
limite de API, erro de processamento, dados insuficientes e fora da cobertura.

## Consequências

O módulo entrega busca real imediatamente, mas mantém processamento e indicadores bloqueados
até que um operador configure `VITE_NDVI_API_URL` e o backend correspondente.
