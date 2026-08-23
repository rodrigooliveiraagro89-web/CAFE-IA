import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Convite para instalar o AGRYN como aplicativo no celular (PWA). No Android/
 * Chrome usamos o evento nativo `beforeinstallprompt`; no iPhone (Safari não
 * dispara esse evento) mostramos o passo a passo de "Adicionar à Tela de Início".
 * Some quando o app já está instalado (rodando em modo standalone).
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

const DISMISS_KEY = "agryn:install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1",
  );
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setDeferred(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || isStandalone()) return null;
  const iosCandidate = isIOS();
  if (!deferred && !iosCandidate) return null;

  function close() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sem persistência: fecha só nesta visualização
    }
  }

  async function install() {
    if (!deferred) {
      setShowIosSteps((v) => !v);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    close();
  }

  return (
    <div className="install-prompt" role="region" aria-label="Instalar aplicativo">
      <div className="install-prompt-body">
        <Download size={18} aria-hidden="true" />
        <div>
          <strong>Instale o AGRYN no seu celular</strong>
          {showIosSteps ? (
            <p>
              No iPhone: toque em <Share size={13} aria-hidden="true" /> <strong>Compartilhar</strong> e
              depois em <strong>“Adicionar à Tela de Início”</strong>.
            </p>
          ) : (
            <p>Abre em tela cheia, como um app — e recebe os alertas por notificação.</p>
          )}
        </div>
      </div>
      <div className="install-prompt-actions">
        <button type="button" className="primary-button" onClick={() => void install()}>
          {deferred ? "Instalar" : "Como instalar"}
        </button>
        <button type="button" className="install-prompt-close" onClick={close} aria-label="Fechar">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
