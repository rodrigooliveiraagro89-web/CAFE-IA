// Roda uma única vez, na primeira carga da página depois desta atualização,
// antes de qualquer hook de dados (que passa a buscar da nuvem assim que há
// login) ter chance de sobrescrever o localStorage. Preserva o que já estava
// salvo no navegador para a tela de importação oferecer depois do login.
const SNAPSHOT_DONE_KEY = "agryn.import-snapshot-taken.v1";
const CONTEXT_KEY = "agryn.agricultural-context.v1";
const RECORDS_KEY = "agryn.field-records.v1";

export const CONTEXT_SNAPSHOT_KEY = "agryn.import-snapshot.context.v1";
export const RECORDS_SNAPSHOT_KEY = "agryn.import-snapshot.records.v1";

if (typeof window !== "undefined" && !window.localStorage.getItem(SNAPSHOT_DONE_KEY)) {
  const context = window.localStorage.getItem(CONTEXT_KEY);
  const records = window.localStorage.getItem(RECORDS_KEY);
  if (context) window.localStorage.setItem(CONTEXT_SNAPSHOT_KEY, context);
  if (records) window.localStorage.setItem(RECORDS_SNAPSHOT_KEY, records);
  window.localStorage.setItem(SNAPSHOT_DONE_KEY, "1");
}
