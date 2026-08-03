import { Info } from "lucide-react";

type WakeHintProps = {
  /** true enquanto uma chamada de IA/backend está em andamento. */
  active: boolean;
};

/**
 * Aviso de "servidor acordando". O backend de IA roda em instância gratuita do
 * Render, que hiberna quando fica ociosa: a primeira chamada depois de um tempo
 * pode levar ~50s só para o contêiner subir. Sem um aviso, isso parece que o
 * app travou.
 *
 * O elemento monta assim que a chamada começa, mas fica invisível (opacity 0) e
 * só aparece via `animation-delay` do CSS depois de alguns segundos — assim a
 * espera normal e rápida não mostra nada, e só o cold-start real revela o aviso.
 * Sem timer em JS, sem setState em efeito.
 */
export function WakeHint({ active }: WakeHintProps) {
  if (!active) return null;

  return (
    <p className="wake-hint" role="status">
      <Info size={15} aria-hidden="true" />
      <span>
        O servidor de IA hiberna quando fica ocioso para economizar. Esta primeira chamada pode
        levar até um minuto para ele acordar — as próximas são rápidas. Pode aguardar.
      </span>
    </p>
  );
}
