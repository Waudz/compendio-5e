import {readFile} from 'node:fs/promises';
export function redact(text) {
  return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT redacted]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[key redacted]')
    .replace(/(postgres(?:ql)?:\/\/)[^\s]+/gi, '$1[connection redacted]')
    .split('\n').filter(line => !/api.?key|secret|password|token|anon.?key|service.?role/i.test(line)).slice(-45).join('\n');
}
if (process.argv[1]?.endsWith('/start-diagnostics.mjs')) {
  const saida = redact(await readFile(process.argv[2], 'utf8'));
  console.log(saida);
  // anotação do GitHub (mesmo texto já sem chaves): permite ver a causa sem abrir o log
  if (process.env.GITHUB_ACTIONS) console.log('::error title=supabase start::' + saida.split('\n').slice(-20).join('\n').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A'));
}
