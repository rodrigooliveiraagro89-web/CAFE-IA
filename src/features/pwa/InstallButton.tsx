import { Download, Share, X } from "lucide-react";
import { useState } from "react";
import { useInstallPrompt } from "./useInstallPrompt";

/**
 * Botão "Instalar" no topo, ao lado do logo. No Android abre o instalador
 * nativo; no iPhone abre um passo a passo (Compartilhar → Adicionar à Tela de
 * Início). Some quando o app já está instalado ou o navegador não suporta.
 */
export function InstallButton() {
  const { available, canPrompt, promptInstall } = useInstallPrompt();
  const [showIos, setShowIos] = useState(false);

  if (!available) return null;

  async function handleClick() {
    if (canPrompt) {
      await promptInstall();
    } else {
      setShowIos((v) => !v);
    }
  }

  return (
    <div className="install-chip-wrap">
      <button
        type="button"
        className="install-chip"
        onClick={() => void handleClick()}
        aria-label="Instalar o aplicativo"
      >
        <Download size={16} aria-hidden="true" />
        <span>Instalar app</span>
      </button>
      {showIos && (
        <div className="install-ios-pop" role="dialog" aria-label="Como instalar no iPhone">
          <button
            type="button"
            className="install-ios-close"
            onClick={() => setShowIos(false)}
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
          <strong>Instalar no iPhone</strong>
          <p>
            Toque em <Share size={13} aria-hidden="true" /> <b>Compartilhar</b> e depois em{" "}
            <b>“Adicionar à Tela de Início”</b>.
          </p>
        </div>
      )}
    </div>
  );
}
