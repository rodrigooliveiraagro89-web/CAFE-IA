import { useState, type FormEvent } from "react";
import { AgrynBrand } from "./brand/AgrynBrand";
import type { AuthController, ProfileTipo } from "../lib/useAuth";

type AuthScreenProps = {
  auth: AuthController;
};

type Mode = "entrar" | "cadastrar";

export function AuthScreen({ auth }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<ProfileTipo>("consultor");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    try {
      if (mode === "entrar") {
        await auth.signIn({ email, password });
      } else {
        await auth.signUp({ email, password, nome, tipo });
        setNotice("Conta criada. Se a confirmação por e-mail estiver ativa, verifique sua caixa de entrada antes de entrar.");
      }
    } catch {
      // auth.error já guarda a mensagem para exibição abaixo.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <AgrynBrand />
        <h1>{mode === "entrar" ? "Entrar na sua conta" : "Criar conta"}</h1>
        <p className="auth-subtitle">
          {mode === "entrar"
            ? "Suas propriedades e talhões ficam sincronizados na nuvem, em qualquer aparelho."
            : "Leva menos de um minuto — depois disso, seus dados acompanham sua conta."}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "cadastrar" && (
            <>
              <label>
                Nome
                <input
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  required
                  placeholder="Seu nome"
                />
              </label>
              <fieldset className="auth-tipo">
                <legend>Você é</legend>
                <label>
                  <input
                    type="radio"
                    name="tipo"
                    value="consultor"
                    checked={tipo === "consultor"}
                    onChange={() => setTipo("consultor")}
                  />
                  Consultor(a) agronômico(a)
                </label>
                <label>
                  <input
                    type="radio"
                    name="tipo"
                    value="produtor"
                    checked={tipo === "produtor"}
                    onChange={() => setTipo("produtor")}
                  />
                  Produtor(a)
                </label>
              </fieldset>
            </>
          )}

          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="voce@exemplo.com"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              placeholder="Mínimo de 6 caracteres"
            />
          </label>

          {mode === "cadastrar" && (
            <label className="auth-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                required
              />
              <span>
                Li e concordo com os{" "}
                <a href="./termos.html" target="_blank" rel="noreferrer">Termos de Uso</a> e com a{" "}
                <a href="./privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade</a>.
              </span>
            </label>
          )}

          {auth.error && <p className="auth-error">{auth.error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting || (mode === "cadastrar" && !consent)}
          >
            {submitting ? "Aguarde..." : mode === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(mode === "entrar" ? "cadastrar" : "entrar")}
        >
          {mode === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>

        <p className="auth-legal-links">
          <a href="./termos.html" target="_blank" rel="noreferrer">Termos de Uso</a>
          {" · "}
          <a href="./privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
