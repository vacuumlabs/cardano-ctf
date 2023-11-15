import {
  Blockfrost,
  generatePrivateKey,
  Lucid,
  PROTOCOL_PARAMETERS_DEFAULT,
  SLOT_CONFIG_NETWORK,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { OurEmulator } from "./emulator_provider.ts";

// By default, both the emulator and the testnet are enabled
// The tests will first run in the Lucid emulator and only if they pass, they will be run on the testnet

// To force the testnet even when emulator tests fail, turn USE_EMULATOR to false
export const USE_EMULATOR = true;
export const USE_TESTNET = true;

// The settings for testnet.
export const PRIVATE_KEY = "";
export const BLOCKFROST_API_KEY = "";
export const BLOCKFROST_URL = "https://cardano-preview.blockfrost.io/api/v0";
export const CONFIRMS_WAIT = 5;

/**
 * You do not need to touch anything that comes after this line.
 */

const uid_input_data = new TextEncoder().encode(
  PRIVATE_KEY + BLOCKFROST_API_KEY,
);
const uid_hash_array = Array.from(
  new Uint8Array(await crypto.subtle.digest("sha-256", uid_input_data)),
);
export const UNIQUE_ID = uid_hash_array.map((b) =>
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
const ZERO_TIME = 1666656000000;
const SLOT_LENGTH = 1000;

emulator.slot = Math.floor((emulator.time - ZERO_TIME) / SLOT_LENGTH);
emulator.blockHeight = 1525029;
SLOT_CONFIG_NETWORK["Custom"] = {
  zeroTime: ZERO_TIME,
  zeroSlot: 0,
  slotLength: SLOT_LENGTH,
};
export const lucid_emulator = await Lucid.new(emulator, "Custom");

lucid_emulator.selectWalletFromPrivateKey(EMULATOR_PRIVATE_KEY);
// TODO: explain the "hack"

const testnet_configured = BLOCKFROST_API_KEY != "" && PRIVATE_KEY != "";
export const lucid_testnet = testnet_configured
  ? await Lucid.new(
    new Blockfrost(
      BLOCKFROST_URL,
      BLOCKFROST_API_KEY,
    ),
    "Preview",
  )
  : undefined;
lucid_testnet?.selectWalletFromPrivateKey(PRIVATE_KEY);
