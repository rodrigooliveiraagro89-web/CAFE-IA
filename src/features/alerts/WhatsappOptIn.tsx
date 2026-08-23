import { Check, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { normalizeBrPhone, validBrPhone } from "./phone";
import "./alerts.css";

/**
 * Opt-in dos alertas por WhatsApp (LGPD): o produtor informa o número e autoriza
 * receber. Guardado em profiles.whatsapp / whatsapp_opt_in; o Edge Function de
 * alertas envia via WhatsApp Cloud API (Meta) para quem autorizou. Nada é enviado
 * sem consentimento explícito, e dá para desativar quando quiser.
 */

export function WhatsappOptIn() {
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id;
      if (!id) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp,whatsapp_opt_in")
        .eq("id", id)
        .maybeSingle();
      if (active && profile) {
        setPhone((profile as { whatsapp?: string }).whatsapp ?? "");
        setOptIn(Boolean((profile as { whatsapp_opt_in?: boolean }).whatsapp_opt_in));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    const normalized = normalizeBrPhone(phone);
    if (optIn && !validBrPhone(normalized)) {
      setMessage("Informe um número válido com DDD (ex.: (35) 99999-8888).");
      setBusy(false);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id;
    if (!id) {
      setBusy(false);
      setMessage("Faça login para salvar.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ whatsapp: normalized || null, whatsapp_opt_in: optIn })
      .eq("id", id);
    setBusy(false);
    setMessage(
      error
        ? "Não foi possível salvar. Tente de novo."
        : optIn
          ? "Pronto! Você receberá os alertas no WhatsApp."
          : "Preferência salva.",
    );
  }

  return (
    <section className="notify-toggle whatsapp-optin">
      <span className="notify-icon" aria-hidden="true">
        <MessageCircle size={18} />
      </span>
      <div className="notify-copy">
        <strong>Receber alertas no WhatsApp</strong>
        <p>Os mesmos alertas (geada, chuva, atividade, calendário) também no seu WhatsApp.</p>
        <div className="whatsapp-fields">
          <input
            type="tel"
            inputMode="tel"
            placeholder="(35) 99999-8888"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-label="Número de WhatsApp com DDD"
          />
          <label className="whatsapp-consent">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(event) => setOptIn(event.target.checked)}
            />
            <span>Autorizo o AGRYN a me enviar alertas por WhatsApp (posso desativar quando quiser).</span>
          </label>
        </div>
        {message && <small className="notify-message">{message}</small>}
      </div>
      <button
        type="button"
        className="primary-button"
        onClick={() => void save()}
        disabled={busy}
      >
        <Check size={15} aria-hidden="true" /> {busy ? "Salvando…" : "Salvar"}
      </button>
    </section>
  );
}
