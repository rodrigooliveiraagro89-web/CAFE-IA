import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb({ explode }: { explode: boolean }): React.ReactElement {
  if (explode) throw new Error("estourou no render");
  return <p>conteúdo ok</p>;
}

describe("ErrorBoundary", () => {
  // O React loga o erro capturado no console; silenciamos para o output do teste.
  beforeAll(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterAll(() => vi.restoreAllMocks());

  it("mostra o conteúdo quando não há erro", () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("conteúdo ok")).toBeInTheDocument();
  });

  it("captura o erro e mostra o fallback com o rótulo", () => {
    render(
      <ErrorBoundary label="o clima">
        <Bomb explode={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Algo deu errado em o clima/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar de novo/i })).toBeInTheDocument();
  });

  it("rearma sozinho quando a resetKey muda", () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="clima">
        <Bomb explode={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // Navegou para outra tela (nova resetKey) que não estoura.
    rerender(
      <ErrorBoundary resetKey="inicio">
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("conteúdo ok")).toBeInTheDocument();
  });

  it("volta ao conteúdo ao clicar em Tentar de novo", async () => {
    const user = userEvent.setup();
    function Wrapper() {
      return (
        <ErrorBoundary>
          <Bomb explode={false} />
        </ErrorBoundary>
      );
    }
    // Primeiro renderiza com erro, depois o reset limpa o estado.
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb explode={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tentar de novo/i }));
    rerender(<Wrapper />);
    expect(screen.getByText("conteúdo ok")).toBeInTheDocument();
  });
});
