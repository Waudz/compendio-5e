import {readFile} from 'node:fs/promises';
export function redact(text) {
  return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT redacted]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[key redacted]')
    .replace(/(postgres(?:ql)?:\/\/)[^\s]+/gi, '$1[connection redacted]')
    .split('\n').filter(line => !/api.?key|secret|password|token|anon.?key|service.?role/i.test(line)).slice(-45).join('\n');
}
if (process.argv[1]?.endsWith('/start-diagnostics.mjs')) console.log(redact(await readFile(process.argv[2], 'utf8')));
