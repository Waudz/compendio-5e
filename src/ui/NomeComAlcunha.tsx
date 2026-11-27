// Identidade em listas e cartões: o nome em destaque e, quando houver, a alcunha logo abaixo (secundária e em itálico).
// A alcunha nunca divide a linha com raça, classe, nível ou outra informação; sem alcunha, não sobra espaço.
import "./ui.css";

export function NomeComAlcunha({ nome, alcunha, classeDoNome }: { nome: string; alcunha?: string | null; classeDoNome?: string }) {
  const apelido = alcunha?.trim();
  return <span className="nome-alcunha"><strong className={classeDoNome}>{nome}</strong>{apelido && apelido !== nome ? <>{" "}<em className="nome-alcunha-apelido">{apelido}</em></> : null}</span>;
}
