const algosdk = require('algosdk');
const account = algosdk.generateAccount();
try {
  console.log("sk length:", account.sk.length);
  const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
  console.log("Mnemonic generation succeeded with 64 bytes!");
} catch (e) {
  console.log("Error with 64 bytes:", e.message);
}
try {
  const seed = account.sk.slice(0, 32);
  const mnemonic2 = algosdk.secretKeyToMnemonic(seed);
  console.log("Mnemonic generation succeeded with 32 bytes!");
} catch (e) {
  console.log("Error with 32 bytes:", e.message);
}
