import { fetchEagleViewPropertyData } from './src/lib/eagleview';
import * as fs from 'fs';

const envStr = fs.readFileSync('.env.local', 'utf8');
envStr.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
});

async function run() {
    try {
        const result = await fetchEagleViewPropertyData('4220 BARKER AVE, OMAHA, NE 68105');
        fs.writeFileSync('ev_dump.json', JSON.stringify(result.data, null, 2));
        console.log('Dumped to ev_dump.json');
    } catch (e: any) {
        console.error("FAILED:", e.message);
    }
}
run();
