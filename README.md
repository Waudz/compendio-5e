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

## Documentação

| Arquivo | Para quê |
|---|---|
| `DECISOES-E-ARQUITETURA.md` | Regras do projeto, arquitetura vigente e estado real de cada parte. **Ler primeiro.** |
| `docs/PLANEJAMENTO-V2.md` | O que existe, o que é parcial e o que falta; modelo de dados planejado; roteiro por prioridade e dependência; pendências. |
| `docs/NAVEGACAO-ABAS.md` | Navegação por abas, fixação, divisão de painéis e proteção de alterações (implementado). |
| `docs/NOTAS-PERMISSOES.md` | Notas: regras de visibilidade e RLS (`0004`, aplicada), revisão de segurança e evolução planejada. |
| `docs/FUNDACAO-REGISTROS.md` | Contratos de registros/links/versões e critérios de segurança. |

Migrações SQL versionadas ficam em `supabase/migrations` (reversões em `supabase/rollback`). Mudar o banco exige autorização explícita; nada é aplicado automaticamente.


## Ver e testar localmente (modo de demonstração)

```powershell
npm ci
npm run dev
```

Abra `http://localhost:5173/compendio-5e/?demo=mestre` (ou `?demo=jogador`). Os dados ficam no localStorage do navegador e são compartilhados entre os dois papéis: publique um registro como mestre e confira como jogador. O modo existe só no `npm run dev` e não entra no build de produção. Ele não usa Supabase; a persistência real do Diário, do Planejamento e da capa depende da migração proposta em `docs/propostas/0006_registros_meta.sql` (e da 0005), ainda não aplicada.
