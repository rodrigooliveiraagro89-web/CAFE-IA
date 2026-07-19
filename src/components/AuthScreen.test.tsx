import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";
import type { AuthController } from "../lib/useAuth";

function makeAuth(): AuthController {
  return {
    session: null,
    userId: null,
    profile: null,
    loading: false,
    error: null,
    signUp: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    startTrial: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AuthScreen", () => {
  it("exige aceite dos Termos e da Política antes de permitir o cadastro", async () => {
    const user = userEvent.setup();
    render(<AuthScreen auth={makeAuth()} />);

    await user.click(screen.getByRole("button", { name: "Não tem conta? Cadastre-se" }));

    const submit = screen.getByRole("button", { name: "Criar conta" });
    expect(submit).toBeDisabled();

    expect(screen.getAllByRole("link", { name: "Termos de Uso" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Política de Privacidade" }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });

  it("no modo entrar não há checkbox de consentimento", () => {
    render(<AuthScreen auth={makeAuth()} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
});
