# Compêndio 5e 2.0

Ferramenta gratuita de apoio à mesa de D&D 5e (regras de 2014), para mestre e jogadores. React + TypeScript + Vite, Supabase (Auth, Postgres, RLS) e GitHub Pages. Projeto de fãs, sem afiliação oficial. O aplicativo anterior (`rastreador-dnd`) permanece independente e não é tocado.

Site publicado: https://waudz.github.io/compendio-5e/ (exige login).

## Desenvolvimento

```bash
npm ci            # instala as dependências do package-lock.json
npm run dev       # servidor local
npm run build     # tsc -b && vite build
npm test          # vitest run (inclui os testes de RLS em Postgres em memória)
```

Configuração (sem ela o aplicativo não abre, pois exige login): copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave **pública**). Nunca use a `service_role` nem a `sb_secret_` no frontend.

## Retomada do projeto em uma nova conversa

**Comece por [`docs/CONTINUIDADE-DESENVOLVIMENTO.md`](docs/CONTINUIDADE-DESENVOLVIMENTO.md).** É o índice central de decisões vigentes, referências externas, limites de implementação, estado de PR/CI e roteiro para continuar sem o histórico do ChatGPT. Antes de qualquer tarefa, confira o HEAD do PR, leia a fonte normativa indicada e não confunda demo, código em branch e produção. **Cada decisão de arquitetura, regras, UX, segurança, persistência ou prioridade deve ser registrada no mesmo conjunto de commits, com contexto, alternativas, consequências, verificação e pendências.** Não realizar merge, deploy ou migrações sem autorização explícita.

## Documentação

| Arquivo | Para quê |
|---|---|
| `docs/CONTINUIDADE-DESENVOLVIMENTO.md` | **Comece aqui**: protocolo de retomada, índice de decisões e referências, hierarquia documental e próximos passos. |
| `DECISOES-E-ARQUITETURA.md` | Regras do projeto, arquitetura vigente e estado real de cada parte. **Ler primeiro.** |
| `docs/PLANEJAMENTO-V2.md` | **Documento principal**: estado, arquitetura, roteiro, pendências e decisões consolidadas de múltiplos chats (atualização de 20/11/2026). **Consultar antes de desenvolver.** |
| `docs/NAVEGACAO-ABAS.md` | Navegação por abas, fixação, divisão de painéis e proteção de alterações (implementado). |
| `docs/NOTAS-PERMISSOES.md` | Notas: regras de visibilidade e RLS (`0004`, aplicada), revisão de segurança e evolução planejada. |
| `docs/CRIADOR-FICHA-INVENTARIO.md` | **Memória do desenvolvimento** do criador, ficha e inventário: ferramentas, arquitetura, código piloto, testes e pendências. |
| `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md` | Auditoria de regras 2014, lacunas e critérios de certificação. |
| `docs/STATUS-FUNCIONALIDADES-V2.md` | Estimativas e lacunas por módulo; **não** são percentuais medidos. |
| `docs/PLANO-REAPROVEITAMENTO-LEGADO.md` | Inventário do 1.0, fontes SRD, estratégia de migração e limites de licença. |
| `docs/FUNDACAO-REGISTROS.md` | Contratos de registros/links/versões e critérios de segurança. |

Migrações SQL versionadas ficam em `supabase/migrations` (reversões em `supabase/rollback`). Mudar o banco exige autorização explícita; nada é aplicado automaticamente.


## Ver e testar localmente (modo de demonstração)

```powershell
npm ci
npm run dev
```

Abra `http://localhost:5173/compendio-5e/?demo=mestre` (ou `?demo=jogador`). Os dados ficam no localStorage do navegador e são compartilhados entre os dois papéis: publique um registro como mestre e confira como jogador. O modo existe só no `npm run dev` e não entra no build de produção. Ele não usa Supabase; a persistência real do Diário, do Planejamento e da capa depende da migração proposta em `docs/propostas/0006_registros_meta.sql` (e da 0005), ainda não aplicada.


## Estado do catálogo e do criador (PR #74 — em desenvolvimento)

**O site publicado ainda não contém estas mudanças.** O catálogo SRD 2014 e o criador estão sendo preparados na branch `docs/auditoria-catalogos-personagem-2014`, [PR #74](https://github.com/Waudz/compendio-5e/pull/74). Não há merge, deploy nem migração de banco autorizados por este trabalho.

- **Implementado e testado em código:** registro canônico de fontes e IDs, consulta do Compêndio com filtros e visualização lista/grade no piloto, restrições de conteúdo por campanha no domínio, núcleo do criador e inventário, importação e revisão de registros SRD, snapshot offline e leitura validada.
- **Pilotos locais:** `?demo=compendio-piloto` e `?demo=criador-piloto` em `npm run dev`. Usam **dados ilustrativos**, não um catálogo SRD completo. Não são funcionalidades publicadas nem substituem a persistência real.
- **Em preparação:** coleta real e revisão editorial dos dados, tradução, efeitos das habilidades e progressão completa das classes, integração com telas reais e persistência segura.
- **Importante:** o endpoint de classe da API não entrega sozinho todos os efeitos e escolhas necessários à ficha. `src/rules/srd-2014-class-level-staging.ts` valida os 20 níveis e registra os IDs de características, **sem inventar regras ou liberar a classe para criação**.

### Coleta controlada de dados SRD 2014

```bash
node scripts/collect-srd-2014.mjs classes
# Outras coleções: races, subraces, subclasses, spells, equipment, features, traits
```

O comando consulta a API `/api/2014` e grava registros **não aprovados** em `.srd-2014-staging/` (ignorada pelo Git), com procedência, alertas de revisão e SHA-256 impresso. Não faz commit, não publica e não concede direitos de redistribuição. Há também `.github/workflows/collect-srd-2014.yml`, acionado manualmente pelo GitHub Actions, que produz artefato temporário de revisão. Como o workflow está apenas na branch do PR, sua execução manual pela interface pode depender de integração posterior à branch padrão. Não realizar merge só para isso.

**Documentação técnica detalhada:** `docs/PLANO-REAPROVEITAMENTO-LEGADO.md`, `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md` e `docs/CRIADOR-FICHA-INVENTARIO.md`. Revisar direitos e atribuições de cada fonte antes de distribuir dados externos.

### Validação estrita do adaptador do criador (20/11/2026)

O adaptador `src/rules/character-catalogue-adapter.ts` agora valida em runtime cada variante de concessão (`Grant`), seus campos numéricos, IDs e escolhas aninhadas antes de encaminhar dados ao cálculo da ficha. Rejeita valores inválidos, tipos desconhecidos, opções repetidas e escolhas impossíveis; há testes de regressão em `src/rules/character-catalogue-adapter.test.ts`. Isso **não** substitui a revisão editorial de regras 2014, o esquema completo por categoria, a validação no servidor, a persistência autenticada nem os testes E2E. Mudança restrita à branch do PR #74; sem deploy ou migração.

### Validação de progressão e escolhas cruzadas (20/11/2026)

O adaptador do catálogo canônico rejeita concessões malformadas também nas progressões de classe (`Advancement`), incluindo níveis fora de 1–20, escolhas com contagem inválida, alternativas repetidas e efeitos incorretos. IDs de escolhas devem ser únicos entre raça, antecedente e progressão de classe; uma classe de dado de vida único não pode mudar o dado entre níveis. Testes de regressão em `src/rules/character-catalogue-adapter.test.ts`. **Não certifica regras reais de 2014** nem habilita criação de personagens em produção; CI do último commit requer confirmação.

### Integridade de atributos de fichas (20/11/2026)

O domínio experimental rejeita atributos-base não inteiros, não finitos ou fora de 1–30 antes de calcular modificadores e PV, com regressões para `NaN`, infinito, frações e limites. O intervalo é **limite técnico de integridade**, não autorização para distribuir atributos acima dos limites normais de criação 2014; regras de geração e limites de campanha ainda exigem validação própria. Alteração restrita ao PR #74, sem banco ou deploy.

### Proteção do motor de regras chamado diretamente (20/11/2026)

`buildCharacter` também valida atributos-base inteiros finitos de 1 a 30 e dados de vida inteiros positivos e consistentes em todos os 20 níveis, independentemente do adaptador e da ficha. Novos testes cobrem chamadas diretas ao motor. Essa redundância deliberada protege usos futuros e importações que contornem a interface; **não certifica regras SRD nem publica o criador**. CI do HEAD ainda requer confirmação.

### Entrega vertical: Guerreiro SRD 5.1 (2014) — 20/11/2026

O piloto local do criador agora usa a **mesma definição versionada de Guerreiro** apresentada no Compêndio, baseada na tabela e características do SRD 5.1 (CC BY 4.0). Permite escolher estilo de luta (nível 1), Campeão (nível 3), melhoria de atributo (níveis 4 e 6) e avançar entre níveis 1–6, com características, recursos, PV e atributos na ficha calculada. Testes de domínio e interface foram adicionados. **Limites:** outros arquétipos, progressão completa do Campeão, efeitos condicionais, proficiências, equipamento inicial e catálogo completo ainda não implementados; raça/antecedente seguem amostras. Executar `npm run build` e `npm test` e confirmar CI antes de declarar pronto. Sem merge, deploy ou banco.

**Incremento do personagem de teste (20/11/2026):** Guerreiro 2014 agora oferece escolha de **duas perícias** dentre as oito opções de classe, com caixas de seleção limitadas a duas e exibição na ficha calculada. O teste de domínio e o teste da interface foram atualizados. A verificação anterior do CI (commit `93a6342`) foi aprovada; as mudanças posteriores exigem novo CI. Ainda faltam equipamentos iniciais, proficiências de armas/armaduras, método de atributos, outros arquétipos e persistência real.

### Atributos de criação 2014 — piloto (20/11/2026)

O criador local do Guerreiro agora permite **compra de 27 pontos** (atributos-base de 8 a 15 com custos SRD) e **matriz padrão** (15, 14, 13, 12, 10, 8), com troca de posições sem duplicar valores. O bônus racial da amostra continua sendo calculado separadamente na ficha; pontos de vida atuais são limitados ao novo máximo quando Constituição diminui. Testes de regras em `src/rules/ability-generation-2014.test.ts`. Inspirado no fluxo de escolhas/revisão do Foundry dnd5e, sem copiar código ou acrescentar dependências. **Ainda não há seleção livre de raça/antecedente, equipamentos iniciais completos ou integração de produção.**
