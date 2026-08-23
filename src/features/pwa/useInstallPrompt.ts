import { useEffect, useState } from "react";

/**
 * Detecção de instalação do PWA, compartilhada entre o botão do topo e qualquer
 * outro convite. Android/Chrome expõem `beforeinstallprompt`; o iPhone não, então
 * sinalizamos iOS para mostrar o passo a passo manual. Some quando já instalado.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

function isIOSDevice(): boolean {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canPrompt = Boolean(deferred);
  const isIOS = isIOSDevice();
  // Disponível para mostrar o botão: não instalado, fora do modo app, e com
  // caminho de instalação (prompt nativo do Android ou passo a passo do iOS).
  const available = !installed && !isStandalone() && (canPrompt || isIOS);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "ios"> {
    if (!deferred) return "ios";
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome;
  }

  return { available, canPrompt, isIOS, promptInstall };
}
