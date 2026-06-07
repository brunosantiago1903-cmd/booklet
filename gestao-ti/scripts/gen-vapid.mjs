// Gera o par de chaves VAPID para Web Push.
// Uso: npm run push:keys   → cole os valores no .env.local
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\nAdicione ao seu .env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}\n`);
