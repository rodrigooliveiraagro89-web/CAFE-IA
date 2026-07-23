import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App AGRYN", () => {
  beforeEach(() => window.localStorage.clear());

  it("apresenta a jornada AGRYN sem inventar indicadores", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Rodrigo/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Módulos da operação" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Solo:/i })).toHaveAttribute(
      "href",
      "./?view=analise-solo",
    );
    expect(screen.getAllByText("Selecione uma propriedade").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Recomendação protegida" })).toBeInTheDocument();
  });

  it("abre a central de módulos e filtra recursos reais", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /MódulosTodas as ferramentas AGRYN/i }),
    );
    expect(screen.getByRole("heading", { name: "Todos os módulos AGRYN" })).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Buscar módulo" }), "clima");
    expect(screen.getByRole("link", { name: /Clima:/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Solo:/i })).not.toBeInTheDocument();
  });

  it("abre os critérios de governança pela navegação", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /GovernançaSegurança técnica e validações/i }),
    );
    expect(screen.getByRole("heading", { name: "Confiança técnica em cada decisão" })).toBeInTheDocument();
    expect(screen.getByText("Bloqueado com segurança")).toBeInTheDocument();
  });
});
