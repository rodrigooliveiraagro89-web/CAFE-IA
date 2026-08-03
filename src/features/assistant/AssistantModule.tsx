import { useRef, useState } from "react";
import { ArrowRight, Bot, Info, SendHorizonal, Sprout } from "lucide-react";
import type { AppView } from "../../app/navigation";
import { sendChat, type ChatMessage } from "./chatClient";
import "./assistant.css";

type AssistantModuleProps = {
  accessToken: string;
  onNavigate: (view: AppView) => void;
};

const SUGESTOES = [
  "Quando devo fazer a calagem do café?",
  "O que o NDVI me diz sobre o talhão?",
  "Como interpretar V% e saturação por alumínio?",
  "Qual cultivar de morango rende mais no Sul de Minas?",
];

const BOAS_VINDAS =
  "Sou o assistente do AGRYN. Posso explicar conceitos, orientar manejo e ajudar você a usar o app. " +
  "Para dose de adubo ou calagem, eu te levo até os módulos que calculam por norma técnica — não invento número.";

export function AssistantModule({ accessToken, onNavigate }: AssistantModuleProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function enviar(texto: string) {
    const conteudo = texto.trim();
    if (!conteudo || loading) return;
    if (!accessToken) {
      setErro("Faça login para conversar com o assistente.");
      return;
    }

    setErro(null);
    const novoHistorico: ChatMessage[] = [...messages, { role: "user", content: conteudo }];
    setMessages(novoHistorico);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendChat(novoHistorico, accessToken);
      setMessages([...novoHistorico, { role: "assistant", content: reply }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível responder agora.");
      // Devolve o texto ao campo para o usuário não reescrever.
      setInput(conteudo);
      setMessages(messages);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Inteligência artificial</span>
          <h1>AGRYN IA</h1>
          <p>Assistente agronômico contextual para café e morango do Sul de Minas.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("modulos")}>
          Ver módulos <ArrowRight size={17} />
        </button>
      </header>

      <p className="assistant-governance">
        <Info size={16} aria-hidden="true" />
        <span>
          O assistente orienta e explica. Para <strong>dose de adubo/calagem</strong> ele te
          encaminha aos módulos que calculam por norma técnica (Boletim 100/IAC), sem inventar
          número.
        </span>
      </p>

      <section className="assistant-chat">
        <div className="assistant-messages" ref={listRef}>
          {messages.length === 0 ? (
            <div className="assistant-welcome">
              <span className="assistant-orb"><Bot size={22} /></span>
              <p>{BOAS_VINDAS}</p>
              <div className="assistant-suggestions">
                {SUGESTOES.map((sugestao) => (
                  <button key={sugestao} type="button" onClick={() => enviar(sugestao)}>
                    {sugestao}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((mensagem, indice) => (
              <div
                key={indice}
                className="assistant-bubble"
                data-role={mensagem.role}
              >
                {mensagem.role === "assistant" && (
                  <span className="assistant-bubble-icon"><Bot size={16} /></span>
                )}
                <p>{mensagem.content}</p>
              </div>
            ))
          )}
          {loading && (
            <div className="assistant-bubble" data-role="assistant">
              <span className="assistant-bubble-icon"><Bot size={16} /></span>
              <p className="assistant-typing">Pensando…</p>
            </div>
          )}
        </div>

        {erro && <p className="assistant-error">{erro}</p>}

        <form
          className="assistant-input"
          onSubmit={(evento) => {
            evento.preventDefault();
            void enviar(input);
          }}
        >
          <textarea
            value={input}
            onChange={(evento) => setInput(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter" && !evento.shiftKey) {
                evento.preventDefault();
                void enviar(input);
              }
            }}
            placeholder="Pergunte sobre manejo, NDVI, solo, mercado…"
            rows={2}
            aria-label="Sua mensagem"
          />
          <button type="submit" disabled={loading || !input.trim()} aria-label="Enviar">
            <SendHorizonal size={20} />
          </button>
        </form>
      </section>

      <div className="assistant-shortcuts">
        <button type="button" onClick={() => onNavigate("analise-solo")}>
          <Sprout size={16} /> Análise de solo
        </button>
        <button type="button" onClick={() => onNavigate("adubacao")}>
          <Sprout size={16} /> Calagem e adubação
        </button>
      </div>

      <p className="fert-disclaimer">
        As respostas do assistente são de apoio e podem conter imprecisões. Decisões técnicas
        devem ser validadas pelo engenheiro agrônomo responsável, com base em análises do talhão.
      </p>
    </div>
  );
}
