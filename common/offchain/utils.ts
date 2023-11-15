import {
  BLOCKFROST_API_KEY,
  BLOCKFROST_URL,
  CONFIRMS_WAIT,
  lucid,
} from "./config.ts";
import { UTxO } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  decode,
  encode,
} from "https://deno.land/std@0.202.0/encoding/base64.ts";

async function writeStringWithoutNewline(s: string) {
  const text = new TextEncoder().encode(s);
  await Deno.stdout.write(text);
}

export function awaitTxConfirms(
  txHash: string,
  confirms = CONFIRMS_WAIT,
  checkInterval = 3000,
): Promise<boolean> {
  return new Promise((res) => {
    writeStringWithoutNewline(`Waiting for ${confirms} tx confirmations...`);
    const confirmation = setInterval(async () => {
      const isConfirmed = await fetch(`${BLOCKFROST_URL}/txs/${txHash}`, {
        headers: { project_id: BLOCKFROST_API_KEY },
      }).then((res) => res.json());
      writeStringWithoutNewline(".");
      if (isConfirmed && !isConfirmed.error) {
        const block_hash = isConfirmed.block;
        const block = await fetch(`${BLOCKFROST_URL}/blocks/${block_hash}`, {
          headers: { project_id: BLOCKFROST_API_KEY },
        }).then((res) => res.json());
        if (block.confirmations >= confirms) {
          writeStringWithoutNewline("\n");
          clearInterval(confirmation);
          await new Promise((res) => setTimeout(() => res(1), 1000));
          return res(true);
        }
      }
    }, checkInterval);
  });
}

export function filterUTXOsByTxHash(utxos: UTxO[], txhash: string) {
  return utxos.filter((x) => txhash == x.txHash);
}

export async function getWalletBalanceLovelace() {
  const utxos = await lucid?.wallet.getUtxos()!;
  return utxos.reduce((sum, utxo) => sum + utxo.assets.lovelace, 0n);
}

export function cardanoscanLink(txHash: string) {
  return "https://preview.cardanoscan.io/transaction/" + txHash;
}

export function encodeBase64(str: string): string {
  return encode(str);
}

export function decodeBase64(str: string): string {
  const textDecoder = new TextDecoder();
  return textDecoder.decode(decode(str));
}
