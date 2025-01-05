import {
  Blockfrost,
  generatePrivateKey,
  Lucid,
  PROTOCOL_PARAMETERS_DEFAULT,
  SLOT_CONFIG_NETWORK,
} from "https://deno.land/x/lucid@0.10.11/mod.ts";
import { BLOCKFROST_API_KEY, BLOCKFROST_URL, PRIVATE_KEY } from "./config.ts";
import { OurEmulator } from "./emulator_provider.ts";

const uidInputData = new TextEncoder().encode(
  PRIVATE_KEY + BLOCKFROST_API_KEY,
);
const uidHashArray = Array.from(
  new Uint8Array(await crypto.subtle.digest("sha-256", uidInputData)),
);
export const UNIQUE_ID = uidHashArray.map((b) =>
  b.toString(16).padStart(2, "0")
).join("").substring(0, 10);

export const EMULATOR_PRIVATE_KEY = generatePrivateKey();
const l = await Lucid.new(undefined, "Preprod");
export const emulator = new OurEmulator([{
  address: await l.selectWalletFromPrivateKey(EMULATOR_PRIVATE_KEY).wallet
    .address(),
  assets: {
    lovelace: BigInt(1e14),
  },
}], { ...PROTOCOL_PARAMETERS_DEFAULT });

// The Lucid emulator uses the current time as the origin for the emulator blockchain.
// To better approximate the testnet, some parameters (such as origin time and slot length) are set manually.
// For example, it is now possible to point to the previous blocks, which was not true before.
const ZERO_TIME = 1666656000000;
const SLOT_LENGTH = 1000;
emulator.slot = Math.floor((emulator.time - ZERO_TIME) / SLOT_LENGTH);
emulator.blockHeight = 1525029;
SLOT_CONFIG_NETWORK["Custom"] = {
  zeroTime: ZERO_TIME,
  zeroSlot: 0,
  slotLength: SLOT_LENGTH,
};

export const lucidEmulator = await Lucid.new(emulator, "Custom");
lucidEmulator.selectWalletFromPrivateKey(EMULATOR_PRIVATE_KEY);

const testnetConfigured = BLOCKFROST_API_KEY.length != 0 &&
  PRIVATE_KEY.length != 0;
export const lucidTestnet = testnetConfigured
  ? await Lucid.new(
    new Blockfrost(
      BLOCKFROST_URL,
      BLOCKFROST_API_KEY,
    ),
    "Preview",
  )
  : undefined;
lucidTestnet?.selectWalletFromPrivateKey(PRIVATE_KEY);
