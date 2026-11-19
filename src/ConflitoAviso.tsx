import type { Conflito } from "./registrosStore";

/** Aviso de conflito de edição: explica o que houve e oferece dois caminhos seguros. Nada é descartado sem o usuário escolher. */
export function ConflitoAviso({ conflito, onUsarRemoto, onManter, onFechar }: { conflito: Conflito; onUsarRemoto: () => void; onManter: () => void; onFechar: () => void }) {
  if (!conflito.registro) return <div className="notice err" role="alert" data-testid="conflito-excluido">Este registro foi excluído em outro lugar. O que você digitou continua aqui, mas salvar não vai funcionar. <button className="btn-link" onClick={onFechar}>Entendi</button></div>;
  return <div className="notice err" role="alert" data-testid="conflito">Este registro foi salvo em outro lugar (versão {conflito.registro.version}) enquanto você tinha alterações não salvas.
    <div className="row"><button type="button" className="btn-secondary" onClick={onUsarRemoto}>Usar a versão mais recente (descarta o que não salvei)</button>
      <button type="button" className="btn-secondary" onClick={onManter}>Manter minhas alterações (sobrescrevem a versão salva ao salvar)</button></div></div>;
}
