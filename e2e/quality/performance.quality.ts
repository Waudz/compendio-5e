import { test, expect, openDemo, navigate } from './helpers';

test('diagnóstico de carregamento, tarefas longas e mutações sem orçamento temporal artificial', async ({ page }, info) => {
  await page.addInitScript(() => {
    const data = { longTasks: [] as number[], mutations: 0, loading: [] as string[] };
    Object.assign(window, { __qualityMetrics: data });
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) new PerformanceObserver(list => {
      data.longTasks.push(...list.getEntries().map(e=>e.duration));
    }).observe({type:'longtask',buffered:true});
    new MutationObserver(records => {
      data.mutations += records.length;
      for (const el of document.querySelectorAll('[role="status"]')) {
        const text=el.textContent?.trim();if(text&&!data.loading.includes(text))data.loading.push(text);
      }
    }).observe(document,{subtree:true,childList:true,characterData:true});
  });
  await openDemo(page); await navigate(page,'Diário');
  await expect(page.getByText('3ª Sessão — O Festival',{exact:true})).toBeVisible();
  for (const name of ['Conta','Diário','Início','Diário']) await navigate(page,name);
  await expect(page.getByText('3ª Sessão — O Festival',{exact:true})).toBeVisible();
  const metrics = await page.evaluate(() => {
    const entries=performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const counts:Record<string,number>={};
    for(const e of entries){const key=new URL(e.name).pathname;counts[key]=(counts[key]??0)+1;}
    return {
      observed:(window as Window & {__qualityMetrics?:unknown}).__qualityMetrics,
      resourceCount:entries.length, transferBytes:entries.reduce((n,e)=>n+e.transferSize,0),
      repeatedResources:Object.entries(counts).filter(([,count])=>count>1),
      navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),
      note:'Vite dev + Chromium. Mutações DOM não medem renderizações React; cache HTTP é desativado pelo roteamento de segurança.'
    };
  });
  await info.attach('performance',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
  expect((metrics.observed as {loading:string[]}).loading.some(s=>s.includes('Carregando'))).toBe(true);
  // Não falhar por milissegundos, bytes, heap, nº de mutações ou variação de hardware do runner.
});
