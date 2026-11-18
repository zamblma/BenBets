import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
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
  console.error('Para gerar a chave do Firebase Admin:');
  console.error('  1. Acesse https://console.firebase.google.com/project/benbets-bbd49/settings/serviceaccounts');
  console.error('  2. Clique em "Gerar nova chave privada"');
  console.error('  3. Salve o arquivo como scripts/serviceAccountKey.json');
  console.error('');
  console.error('Após isso, rode novamente: npm run sync-users');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(key) });
}

const db = getFirestore();
const auth = getAuth();

async function main() {
  console.log('🔍 Buscando usuários no Firebase Authentication...');
  const listUsersResult = await auth.listUsers(1000);
  console.log(`📋 Total de usuários no Firebase Auth: ${listUsersResult.users.length}`);

  let createdCount = 0;
  let existingCount = 0;

  for (const user of listUsersResult.users) {
    const userRef = db.collection('users').doc(user.uid);
    const docSnap = await userRef.get();

    if (!docSnap.exists) {
      const email = user.email || '';
      const fallbackName = email ? email.split('@')[0] : 'Agente';
      const displayName = user.displayName || fallbackName;

      await userRef.set({
        email,
        displayName,
        balance: 20.00,
        placedBets: [],
        transactions: [],
        pokemonCollection: [],
        worldCupCollection: [],
        kpopCollection: [],
        cs2Collection: [],
        animeCollection: [],
        lastSeen: 0,
        createdAt: user.metadata.creationTime || new Date().toISOString(),
      });
      console.log(`✨ Criado no Firestore: ${displayName} (${email || user.uid})`);
      createdCount++;
    } else {
      existingCount++;
    }
  }

  console.log('');
  console.log(`📊 Sincronização concluída!`);
  console.log(`   - Novos usuários criados no Firestore: ${createdCount}`);
  console.log(`   - Usuários já existentes no Firestore: ${existingCount}`);
  console.log(`   - Total no ranking: ${createdCount + existingCount}`);
}

main().catch(console.error);
