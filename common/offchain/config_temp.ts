import { Blockfrost, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";

// Your nickname, will be used in names of tokens and validators so that your addresses do not collide with other people's
export const PRIVATE_KEY = "";
export const BLOCKFROST_API_KEY = "";
export const BLOCKFROST_URL = "https://cardano-preview.blockfrost.io/api/v0";
export const CONFIRMS_WAIT = 5;

const uid_input_data = new TextEncoder().encode(BLOCKFROST_API_KEY);
const uid_hash_array = Array.from(
  new Uint8Array(await crypto.subtle.digest("sha-256", uid_input_data)),
);
export const UNIQUE_ID = uid_hash_array.map((b) =>
  b.toString(16).padStart(2, "0")
).join("").substring(0, 10);

export const lucid = await Lucid.new(
  new Blockfrost(
    BLOCKFROST_URL,
    BLOCKFROST_API_KEY,
  ),
  "Preview",
);

lucid.selectWalletFromPrivateKey(PRIVATE_KEY);
