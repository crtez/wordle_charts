// Collapses src/data/summaries/summary_*.json (one file per puzzle) into a single
// public/wordle-summaries.json holding only the fields the chart reads.
//
// The per-file JSON used to be pulled in with import.meta.glob({ eager: true }),
// which inlined every puzzle into the entry bundle. Run by `npm run build`.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const summariesDir = join(root, 'src/data/summaries');
const outFile = join(root, 'public/wordle-summaries.json');

// Chart axes never resolve past 4 decimals; trimming keeps the payload small.
const round = (n) => Math.round(n * 10000) / 10000;

const files = (await readdir(summariesDir)).filter(
  (f) => f.startsWith('summary_') && f.endsWith('.json')
);

const chartData = [];
for (const filename of files) {
  const data = JSON.parse(await readFile(join(summariesDir, filename), 'utf8'));

  // Filename format: summary_word,id,YYYY-MM-DD.json
  const [prefix, id, dateStr] = filename.split(',');
  chartData.push({
    date: dateStr.split('.')[0],
    word: prefix.split('_')[1].toUpperCase(),
    id,
    average: round(data.average.normal),
    hardAverage: round(data.average.hard),
    percentSolved: round((1 - data.unsolvedPenalty.normal / 100) * 100),
    percentSolvedHard: round((1 - data.unsolvedPenalty.hard / 100) * 100),
    percentThreeOrFewer: round(data.percentSolvingInThreeOrFewer.normal * 100),
    percentThreeOrFewerHard: round(data.percentSolvingInThreeOrFewer.hard * 100),
    efficiency: round(data.efficiency.normal * 100),
    efficiencyHard: round(data.efficiency.hard * 100),
  });
}

// Sorted here so the client never has to.
chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(chartData));

console.log(`build-summaries: ${chartData.length} puzzles -> public/wordle-summaries.json`);
