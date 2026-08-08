import { BarChart3, CheckCircle2, Coffee, Satellite, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AgrynBrand } from "./brand/AgrynBrand";
import type { AuthController, ProfileTipo } from "../lib/useAuth";

type AuthScreenProps = {
  auth: AuthController;
};

type Mode = "entrar" | "cadastrar" | "recuperar" | "nova-senha";

export function AuthScreen({ auth }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("entrar");
  const activeMode: Mode = auth.recovering ? "nova-senha" : mode;
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
      if (activeMode === "entrar") {
        await auth.signIn({ email, password });
      } else if (activeMode === "cadastrar") {
        await auth.signUp({ email, password, nome, tipo });
        setNotice("Conta criada. Se a confirmação por e-mail estiver ativa, verifique sua caixa de entrada antes de entrar.");
      } else if (activeMode === "recuperar") {
        await auth.requestPasswordReset(email);
        setNotice("Enviamos o link de recuperação. Verifique sua caixa de entrada e o spam.");
      } else {
        await auth.updatePassword(password);
        setNotice("Senha atualizada. Você já pode continuar no AGRYN.");
        setMode("entrar");
      }
    } catch {
      // auth.error já guarda a mensagem para exibição abaixo.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen auth-public-screen">
      <section className="auth-pitch" aria-labelledby="auth-pitch-title">
        <AgrynBrand />
        <span className="eyebrow">Especialista em cafeicultura</span>
        <h1 id="auth-pitch-title">Do talhão à decisão, com dados rastreáveis.</h1>
        <p>Solo, satélite, clima, manejo, custos e inteligência artificial em um fluxo criado para o café brasileiro.</p>
        <div className="auth-proof-grid">
          <article><Coffee size={22} /><strong>100% café</strong><small>Fluxos e linguagem da cafeicultura</small></article>
          <article><Satellite size={22} /><strong>NDVI real</strong><small>Sentinel-2 e qualidade por pixel</small></article>
          <article><BarChart3 size={22} /><strong>Gestão por talhão</strong><small>Atividades, custos e relatório</small></article>
          <article><ShieldCheck size={22} /><strong>Governança</strong><small>Sem recomendação sem dados mínimos</small></article>
        </div>
        <ul className="auth-benefits">
          <li><CheckCircle2 size={17} /> Comece grátis com 1 propriedade e 2 talhões</li>
          <li><CheckCircle2 size={17} /> Dados sincronizados na sua conta e disponíveis em qualquer aparelho</li>
          <li><CheckCircle2 size={17} /> Apoio técnico; validação final do responsável agronômico</li>
        </ul>
        <a className="auth-learn-link" href="./landing.html#recursos">Ver demonstração guiada, recursos e planos</a>
      </section>
      <div className="auth-card">
        <AgrynBrand />
        <h1>{activeMode === "entrar" ? "Entrar na sua conta" : activeMode === "cadastrar" ? "Criar conta" : activeMode === "recuperar" ? "Recuperar senha" : "Criar nova senha"}</h1>
        <p className="auth-subtitle">
          {activeMode === "entrar"
            ? "Suas propriedades e talhões ficam sincronizados na nuvem, em qualquer aparelho."
            : activeMode === "cadastrar"
              ? "Leva menos de um minuto — depois disso, seus dados acompanham sua conta."
              : activeMode === "recuperar"
                ? "Informe o e-mail da sua conta para receber um link seguro."
                : "Escolha uma senha com pelo menos 8 caracteres."}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {activeMode === "cadastrar" && (
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

          {activeMode !== "nova-senha" && <label>
            E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="voce@exemplo.com" />
          </label>}

          {activeMode !== "recuperar" && <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={activeMode === "entrar" ? 6 : 8}
              autoComplete={activeMode === "entrar" ? "current-password" : "new-password"}
              placeholder={activeMode === "entrar" ? "Sua senha" : "Mínimo de 8 caracteres"}
            />
          </label>}

          {activeMode === "entrar" && <button type="button" className="auth-forgot" onClick={() => { setNotice(""); setMode("recuperar"); }}>Esqueci minha senha</button>}

          {activeMode === "cadastrar" && (
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
            disabled={submitting || (activeMode === "cadastrar" && !consent)}
          >
            {submitting ? "Aguarde..." : activeMode === "entrar" ? "Entrar" : activeMode === "cadastrar" ? "Criar conta" : activeMode === "recuperar" ? "Enviar link" : "Salvar nova senha"}
          </button>
        </form>

        {(activeMode === "entrar" || activeMode === "cadastrar") ? <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(activeMode === "entrar" ? "cadastrar" : "entrar")}
        >
          {activeMode === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button> : activeMode !== "nova-senha" ? <button type="button" className="auth-switch" onClick={() => setMode("entrar")}>Voltar para entrar</button> : null}

        <p className="auth-legal-links">
          <a href="./termos.html" target="_blank" rel="noreferrer">Termos de Uso</a>
          {" · "}
          <a href="./privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
