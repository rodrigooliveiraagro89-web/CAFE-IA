import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { disablePush, enablePush, isSubscribed, pushPermission, pushSupported } from "./pushClient";
import "./alerts.css";

/**
 * Liga/desliga os alertas por notificação (Web Push). Fica junto do painel de
 * alertas: o mesmo lugar onde o produtor vê o que precisa de atenção é onde ele
 * decide receber isso no celular quando o app estiver fechado.
 */
export function NotificationsToggle() {
  const [supported] = useState(() => pushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [denied, setDenied] = useState(() => pushPermission() === "denied");

  useEffect(() => {
    let active = true;
    void isSubscribed().then((value) => {
      if (active) setSubscribed(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!supported) return null;

  const handleToggle = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        setMessage("Notificações desativadas neste aparelho.");
      } else {
        const result = await enablePush();
        setSubscribed(result.ok);
        setDenied(pushPermission() === "denied");
        setMessage(result.ok ? "Pronto! Você receberá os alertas por notificação." : (result.reason ?? ""));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="notify-toggle">
      <span className="notify-icon" aria-hidden="true">
        {subscribed ? <BellRing size={18} /> : <Bell size={18} />}
      </span>
      <div className="notify-copy">
        <strong>{subscribed ? "Alertas por notificação ativos" : "Receber alertas no celular"}</strong>
        <p>
          {denied
            ? "As notificações estão bloqueadas nas permissões do navegador. Libere para este site e tente de novo."
            : "Avisamos sobre atividade atrasada, queda de NDVI e laudo vencido — mesmo com o app fechado."}
        </p>
        {message && <small className="notify-message">{message}</small>}
      </div>
      <button
        type="button"
        className={subscribed ? "secondary-button" : "primary-button"}
        onClick={() => void handleToggle()}
        disabled={busy || denied}
      >
        {subscribed ? (
          <>
            <BellOff size={15} aria-hidden="true" /> Desativar
          </>
        ) : (
          <>
            <Bell size={15} aria-hidden="true" /> {busy ? "Ativando…" : "Ativar"}
          </>
        )}
      </button>
    </section>
  );
}
