import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App AGRYN", () => {
  beforeEach(() => window.localStorage.clear());

  it("conta nova vê as boas-vindas e carrega o exemplo (dados fictícios)", async () => {
    const user = userEvent.setup();
    render(<App />);
    // Conta sem propriedades: tela de boas-vindas, não o painel.
    expect(
      await screen.findByRole("button", { name: /Explorar com dados de exemplo/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Explorar com dados de exemplo/i }));
    // Ao carregar o exemplo, a propriedade fictícia aparece e há o aviso de demo.
    expect((await screen.findAllByText(/Fazenda Modelo/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Modo demonstração/i)).toBeInTheDocument();
  });

  it("abre a central de módulos e filtra recursos reais", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /Mais ferramentasTodas as ferramentas AGRYN/i }),
    );
    // ModuleHub agora carrega sob demanda (React.lazy) — espera aparecer.
    expect(
      await screen.findByRole("heading", { name: "Todos os módulos AGRYN" }),
    ).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Buscar módulo" }), "clima");
    expect(screen.getByRole("link", { name: /Clima:/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Solo:/i })).not.toBeInTheDocument();
  });

  it("abre a linha do tempo pela URL (agora fora da sidebar, no hub)", async () => {
    window.history.replaceState({}, "", "/?view=linha-do-tempo");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Linha do tempo" }),
    ).toBeInTheDocument();
    window.history.replaceState({}, "", "/");
  });
});
