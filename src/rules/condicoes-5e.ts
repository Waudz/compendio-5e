/** Condições do SRD 5.1 (2014), compartilhadas pelo combate e pela ficha. */
export const CONDICOES_5E = ["Cego", "Enfeitiçado", "Surdo", "Amedrontado", "Agarrado", "Incapacitado", "Invisível", "Paralisado", "Petrificado", "Envenenado", "Caído", "Contido", "Atordoado", "Inconsciente", "Exaustão"];

/** Efeitos resumidos (SRD 5.1), os mesmos textos usados no Compêndio 1.0. */
export const CONDICOES_TEXTO: Readonly<Record<string, string>> = {
  Agarrado: "Deslocamento 0.",
  Amedrontado: "Desvantagem em testes e ataques enquanto a fonte do medo estiver à vista; não se aproxima dela.",
  Atordoado: "Incapacitado, não se move, fala só com dificuldade; falha automática em salvaguardas de For e Des; ataques contra a criatura têm vantagem.",
  "Caído": "Só rasteja; desvantagem nos próprios ataques; ataques corpo a corpo contra ela têm vantagem, à distância têm desvantagem.",
  Cego: "Falha em testes que dependem da visão; ataques contra a criatura têm vantagem e os dela têm desvantagem.",
  Contido: "Deslocamento 0; ataques contra a criatura têm vantagem, os dela têm desvantagem; desvantagem em salvaguardas de Des.",
  Surdo: "Não ouve; falha em testes que dependem da audição.",
  "Enfeitiçado": "Não pode atacar quem a enfeitiçou; essa criatura tem vantagem em testes sociais contra ela.",
  Envenenado: "Desvantagem em jogadas de ataque e testes de habilidade.",
  Incapacitado: "Não pode realizar ações nem reações.",
  Inconsciente: "Incapacitado, não se move nem fala, não percebe o ambiente; larga o que segura e cai; falha automática em salvaguardas de For e Des; ataques têm vantagem e, a 1,5 m, são acertos críticos.",
  "Invisível": "Impossível de ver sem magia ou sentido especial; ataques contra a criatura têm desvantagem e os dela têm vantagem.",
  Paralisado: "Incapacitado, não se move nem fala; falha automática em salvaguardas de For e Des; ataques têm vantagem e, a 1,5 m, são acertos críticos.",
  Petrificado: "Transformado em pedra, incapacitado, não se move nem fala; resistência a todo dano; imune a veneno e doença.",
  "Exaustão": "Efeitos acumulam por nível: 1 desvantagem em testes de habilidade; 2 deslocamento pela metade; 3 desvantagem em ataques e salvaguardas; 4 PV máximo pela metade; 5 deslocamento 0; 6 morte.",
};
