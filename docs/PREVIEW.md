# Previews no navegador

O site oficial continua no GitHub Pages (`main`). Os previews são um **build separado, sem banco** (`vite build --mode preview-demo`): entram direto como mestre (`?demo=jogador` para jogador), usam dados fictícios e mostram a faixa "PREVIEW EXPERIMENTAL".

## Isolamento (verificado no CI, workflow "Preview experimental")

- O cliente Supabase nunca é criado nesse modo (`src/supabase.ts`).
- URL, chave e combate remoto são apagados na compilação (`vite.config.ts`), mesmo que existam no ambiente.
- `scripts/check-preview-demo.mjs` recusa credencial ou projeto real no artefato, qualquer requisição para fora e erros de página, em celular e desktop, como mestre e jogador.
- O build oficial é conferido por `scripts/check-build-oficial.mjs` (sem faixa nem dados da demonstração).
- O 2.0 ainda não tem manifesto nem service worker: o preview não é instalável nem guarda cache offline.

## URL por pull request com Cloudflare Pages (plano gratuito)

Requer uma conta Cloudflare e a autorização do app no GitHub, que só o dono do repositório pode fazer. Nada precisa mudar no código.

1. Em dash.cloudflare.com, abra **Workers & Pages → Create → Pages → Connect to Git**.
2. Autorize o app da Cloudflare **somente** no repositório `Waudz/compendio-5e`.
3. Configure:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `npx vite build --mode preview-demo`
   - Build output directory: `dist`
   - Environment variables: `NODE_VERSION` = `22`. **Não cadastre nenhuma variável do Supabase.**
4. Salve e faça o primeiro deploy.

Resultado: cada branch ou PR ganha uma URL própria (`https://<hash>.<projeto>.pages.dev` e um endereço estável por branch), atualizada a cada commit, e a Cloudflare comenta a URL no PR. O endereço de "produção" da Cloudflare também é o modo demonstração: não substitui o site oficial. O plano gratuito tem limite mensal de builds; confira o valor atual no painel.

## Sem configurar conta externa

O workflow "Preview experimental" gera o artefato `preview-demo` (3 dias) em cada PR. Para abrir é preciso baixá-lo e servi-lo localmente; não há URL no celular. Publicar previews em subpastas do GitHub Pages exigiria mudar o fluxo da publicação oficial e foi descartado por risco.

Localmente:

```powershell
npx vite build --mode preview-demo
```

```powershell
npx vite preview --mode preview-demo --host
```

Com `--host`, o celular na mesma rede abre o endereço "Network" mostrado no terminal.

## Ficha de exemplo

`?demo=jogador&fichas=1&nuvem=1&exemplo=1` cria, só no navegador, o mago de exemplo usado para aprovar o visual da ficha (Personagens → Caleb Hawke). Só é criado quando ainda não há fichas de demonstração.
