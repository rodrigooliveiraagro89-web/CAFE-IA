import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: vi.fn(),
});

// Mock global do Supabase: os testes exercitam uma sessão autenticada fixa,
// com tabelas vazias por padrão, sem bater numa rede real.
const fakeSession = {
  user: { id: "test-user-id", email: "teste@agryn.dev" },
};

type QueryResult = { data: unknown; error: null };

function makeBuilder(result: QueryResult) {
  const builder = {
    select: () => builder,
    order: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
    insert: () => Promise.resolve(result),
    update: () => builder,
    delete: () => builder,
    then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

const tableResults: Record<string, QueryResult> = {
  profiles: { data: { nome: "Rodrigo Teste", tipo: "consultor", plano: "gratis" }, error: null },
  properties: { data: [], error: null },
  plots: { data: [], error: null },
  field_records: { data: [], error: null },
};

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: fakeSession } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: () => Promise.resolve({ error: null }),
      signInWithPassword: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: (table: string) => makeBuilder(tableResults[table] ?? { data: null, error: null }),
  },
}));
