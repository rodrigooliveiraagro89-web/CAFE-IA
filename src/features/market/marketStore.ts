import { useCallback, useState } from "react";
import type { MarketQuote } from "../../domain/marketQuotes";

const STORAGE_KEY = "agryn.market-quotes.v1";
const LIMIT = 400;

/**
 * Histórico de cotações do usuário.
 *
 * Fica em localStorage de propósito: cotação é dado público e compartilhado
 * (não é dado da propriedade), e assim o módulo funciona sem depender de uma
 * migração nova no Supabase. Sincronizar entre dispositivos é um passo futuro.
 */
function carregar(): MarketQuote[] {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as MarketQuote[]) : [];
  } catch {
    return [];
  }
}

function salvar(quotes: MarketQuote[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes.slice(-LIMIT)));
  } catch {
    // Sem espaço ou modo privativo: o histórico segue só em memória nesta sessão.
  }
}

export function useMarketQuotes() {
  // Inicialização preguiçosa: o histórico já nasce com o que está salvo, sem
  // um render extra nem efeito em cascata.
  const [quotes, setQuotes] = useState<MarketQuote[]>(carregar);

  const addQuote = useCallback((quote: Omit<MarketQuote, "id" | "createdAt">) => {
    setQuotes((atual) => {
      // Uma cotação por data: relançar a mesma data substitui a anterior.
      const semDuplicata = atual.filter((item) => item.data !== quote.data);
      const nova: MarketQuote = {
        ...quote,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      const proximo = [...semDuplicata, nova].sort((a, b) => (a.data < b.data ? -1 : 1));
      salvar(proximo);
      return proximo;
    });
  }, []);

  const removeQuote = useCallback((id: string) => {
    setQuotes((atual) => {
      const proximo = atual.filter((item) => item.id !== id);
      salvar(proximo);
      return proximo;
    });
  }, []);

  return { quotes, addQuote, removeQuote };
}
