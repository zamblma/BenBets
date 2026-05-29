import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, 'serviceAccountKey.json');
let key;
try {
  key = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('❌ Arquivo serviceAccountKey.json não encontrado em scripts/');
  console.error('');
  console.error('Para gerar:');
  console.error('  1. Acesse https://console.firebase.google.com/project/benbets-bbd49/settings/serviceaccounts');
  console.error('  2. Clique em "Gerar nova chave privada"');
  console.error('  3. Salve o arquivo como scripts/serviceAccountKey.json');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(key) });
}
const db = getFirestore();

async function main() {
  console.log('🔍 Buscando todos os usuários...');
  const snapshot = await db.collection('users').get();
  let resetCount = 0;
  let skipCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.isAdmin === true) {
      console.log(`⏭️  Pulando admin: ${data.email || doc.id}`);
      skipCount++;
      continue;
    }

    await doc.ref.update({
      balance: 20.00,
      placedBets: [],
      transactions: [],
      pokemonCollection: [],
      worldCupCollection: [],
      kpopCollection: [],
      cs2Collection: [],
    });
    console.log(`✅ Resetado: ${data.email || doc.id} (saldo: R$20, coleções limpas)`);
    resetCount++;
  }

  console.log('');
  console.log(`📊 Total: ${resetCount} contas resetadas, ${skipCount} admins pulados`);
}

main().catch(console.error);
