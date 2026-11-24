// Testes de interface que carregam o catálogo (Bestiário, magias) ou fazem várias leituras assíncronas podem passar de 1 s quando a suíte inteira roda em paralelo
// (máquina lenta ou CI). O limite padrão das consultas assíncronas do Testing Library (1 s) gerava falhas intermitentes que passavam ao rodar o arquivo isolado.
import { configure } from "@testing-library/dom";
configure({ asyncUtilTimeout: 5000 });
