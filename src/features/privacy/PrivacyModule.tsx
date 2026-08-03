import { useState } from "react";
import { Download, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import type { AppView } from "../../app/navigation";
import { deleteAccount, downloadJson, exportUserData } from "./privacyClient";
import "./privacy.css";

type PrivacyModuleProps = {
  userId: string;
  accessToken: string;
  onSignOut: () => Promise<void>;
  onNavigate: (view: AppView) => void;
};

const CONFIRMACAO = "EXCLUIR";

export function PrivacyModule({ userId, accessToken, onSignOut, onNavigate }: PrivacyModuleProps) {
  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState<string | null>(null);

  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  async function baixar() {
    setErroExport(null);
    setExportando(true);
    try {
      downloadJson(await exportUserData(userId));
    } catch (e) {
      setErroExport(e instanceof Error ? e.message : "Falha ao exportar seus dados.");
    } finally {
      setExportando(false);
    }
  }

  async function excluir() {
    if (confirmacao.trim().toUpperCase() !== CONFIRMACAO) return;
    setErroExcluir(null);
    setExcluindo(true);
    try {
      await deleteAccount(accessToken);
      // Conta apagada no servidor: encerra a sessão e recarrega para a tela de login.
      await onSignOut();
      window.location.reload();
    } catch (e) {
      setErroExcluir(e instanceof Error ? e.message : "Não foi possível excluir a conta.");
      setExcluindo(false);
    }
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Privacidade e dados · LGPD</span>
          <h1>Meus dados</h1>
          <p>Baixe uma cópia de tudo o que o AGRYN guarda sobre você ou exclua sua conta.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("inicio")}>
          Voltar ao início
        </button>
      </header>

      <section className="panel-card">
        <div className="panel-title">
          <Download size={21} />
          <div>
            <span className="eyebrow">Portabilidade</span>
            <h2>Exportar meus dados</h2>
          </div>
        </div>
        <p className="privacy-text">
          Gera um arquivo JSON com seu perfil, propriedades, talhões, caderno de campo, análises
          de solo, histórico de NDVI e o que estiver salvo neste navegador. É o seu direito de
          acesso e portabilidade (art. 18 da LGPD).
        </p>
        <button className="primary-button" type="button" onClick={baixar} disabled={exportando}>
          <Download size={17} /> {exportando ? "Preparando…" : "Baixar meus dados (JSON)"}
        </button>
        {erroExport && <p className="privacy-error">{erroExport}</p>}
      </section>

      <section className="panel-card privacy-danger">
        <div className="panel-title">
          <TriangleAlert size={21} />
          <div>
            <span className="eyebrow">Zona sensível</span>
            <h2>Excluir minha conta</h2>
          </div>
        </div>
        <p className="privacy-text">
          Isso apaga <strong>permanentemente</strong> sua conta e todos os dados associados —
          perfil, propriedades, talhões, registros, análises e histórico. <strong>A ação não
          pode ser desfeita.</strong> Recomendamos exportar seus dados antes.
        </p>
        <p className="privacy-hint">
          <Info size={15} aria-hidden="true" /> Se você tem uma assinatura Pro ativa, cancele a
          cobrança no seu provedor de pagamento separadamente — apagar a conta não cancela a
          assinatura automaticamente.
        </p>

        <label className="privacy-confirm">
          Para confirmar, digite <strong>{CONFIRMACAO}</strong> abaixo:
          <input
            type="text"
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder={CONFIRMACAO}
            aria-label={`Digite ${CONFIRMACAO} para confirmar`}
            autoComplete="off"
          />
        </label>

        <button
          className="privacy-delete-button"
          type="button"
          onClick={excluir}
          disabled={excluindo || confirmacao.trim().toUpperCase() !== CONFIRMACAO}
        >
          {excluindo ? "Excluindo…" : "Excluir minha conta permanentemente"}
        </button>
        {erroExcluir && <p className="privacy-error">{erroExcluir}</p>}
      </section>

      <p className="privacy-footer">
        <ShieldCheck size={15} aria-hidden="true" /> Dúvidas sobre como tratamos seus dados? Veja
        a <a href="./privacidade.html" target="_blank" rel="noopener noreferrer">Política de
        Privacidade</a>.
      </p>
    </div>
  );
}
