import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pasta = dirname(fileURLToPath(import.meta.url));
const caminhoPrincipal = join(pasta, 'notabook-storage-worker-stripe.js');
const caminhoLembretes = join(pasta, 'reminders-worker.js');
const caminhoSaida = join(pasta, 'worker.js');

const [principalOriginal, lembretesOriginal] = await Promise.all([
  readFile(caminhoPrincipal, 'utf8'),
  readFile(caminhoLembretes, 'utf8')
]);

const importLembretes = /^import \{\s*handleReminderRequest,\s*processDueReminders\s*\} from ['"]\.\/reminders-worker\.js['"];\s*/;
if (!importLembretes.test(principalOriginal)) {
  throw new Error('O import esperado do módulo de lembretes não foi encontrado.');
}

const principal = principalOriginal.replace(importLembretes, '');
const lembretes = lembretesOriginal
  .replace(/^export const REMINDER_FEATURE_KEY/m, 'const REMINDER_FEATURE_KEY')
  .replace(/^export async function handleReminderRequest/m, 'async function handleReminderRequest')
  .replace(/^export async function processDueReminders/m, 'async function processDueReminders');

if (/^export /m.test(lembretes)) {
  throw new Error('O módulo de lembretes contém exports que o gerador ainda não trata.');
}

const resultado = `// Ficheiro gerado. Edita os módulos fonte e volta a executar build-dashboard-worker.mjs.\n` +
`const { handleReminderRequest, processDueReminders } = (() => {\n` +
`${lembretes}\n` +
`return { handleReminderRequest, processDueReminders };\n` +
`})();\n\n` +
principal;

await writeFile(caminhoSaida, resultado, 'utf8');
console.log(`Worker único criado em ${caminhoSaida}`);
