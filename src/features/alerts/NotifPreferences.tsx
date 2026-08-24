import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { getNotifPref, setNotifPref, type MinSeverity } from "./notifPrefClient";
import "./alerts.css";

/**
 * Preferência de notificação: nível mínimo de severidade que gera push/WhatsApp.
 * Respeitada pelo Edge Function de alertas. "Só urgentes" envia apenas os de
 * severidade alta; "Atenção e urgentes" envia média e alta.
 */
export function NotifPreferences() {
  const [minSeverity, setMinSeverity] = useState<MinSeverity>("media");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let active = true;
    void getNotifPref().then((p) => {
      if (active) setMinSeverity(p.minSeverity);
    });
    return () => {
      active = false;
    };
  }, []);

  async function alterar(value: MinSeverity) {
    setMinSeverity(value);
    setMsg("");
    const ok = await setNotifPref({ minSeverity: value, active: true });
    setMsg(ok ? "Preferência salva." : "Não foi possível salvar.");
  }

  return (
    <section className="notify-toggle">
      <span className="notify-icon" aria-hidden="true">
        <SlidersHorizontal size={18} />
      </span>
      <div className="notify-copy">
        <strong>Nível dos alertas</strong>
        <p>Escolha a partir de qual gravidade você quer receber notificações (push e WhatsApp).</p>
        <label className="notif-pref-select">
          <select value={minSeverity} onChange={(e) => void alterar(e.target.value as MinSeverity)}>
            <option value="media">Atenção e urgentes (recomendado)</option>
            <option value="alta">Só urgentes (severidade alta)</option>
          </select>
        </label>
        {msg && <small className="notify-message">{msg}</small>}
      </div>
    </section>
  );
}
