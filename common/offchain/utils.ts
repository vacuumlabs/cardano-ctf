import {
  BLOCKFROST_API_KEY,
  BLOCKFROST_URL,
  CONFIRMS_WAIT,
  emulator,
  lucid_emulator,
  lucid_testnet,
  USE_EMULATOR,
  USE_TESTNET,
} from "./config.ts";
import { Emulator, Lucid, UTxO } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { OurEmulator } from "./emulator_provider.ts";
import {
  decode,
  encode,
} from "https://deno.land/std@0.202.0/encoding/base64.ts";

async function writeStringWithoutNewline(s: string) {
  const text = new TextEncoder().encode(s);
  await Deno.stdout.write(text);
}

export function isEmulator(l: Lucid) {
  return l.provider instanceof OurEmulator;
}

export function awaitTxConfirms(
  lucid: Lucid,
  txHash: string,
  confirms = CONFIRMS_WAIT,
  checkInterval = 3000,
): Promise<boolean> {
  return new Promise((res) => {
    if (isEmulator(lucid)) {
      emulator.awaitBlock(confirms);
      return res(true);
    }

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

export async function getWalletBalanceLovelace(lucid: Lucid) {
  const utxos = await lucid?.wallet.getUtxos()!;
  return utxos.reduce((sum, utxo) => sum + utxo.assets.lovelace, 0n);
}

export function cardanoscanLink(txHash: string, lucid: Lucid) {
  if (isEmulator(lucid)) return "";
  return " (check details at https://preview.cardanoscan.io/transaction/" +
    txHash + ")";
}

export function encodeBase64(str: string): string {
  return encode(str);
}

export function decodeBase64(str: string): string {
  const textDecoder = new TextDecoder();
  return textDecoder.decode(decode(str));
}

export function runTask<GameData, TestData>(
  setup: (lucid: Lucid) => Promise<GameData>,
  play: (lucid: Lucid, gameData: GameData) => Promise<TestData>,
  test: (
    lucid: Lucid,
    gameData: GameData,
    testData: TestData,
  ) => Promise<boolean>,
) {
  /**
   * Given a specific environment provided by lucid (emulator, testnet), we:
   *   1. Set up the level by creating necessary UTxOs.
   *   2. Run your interaction.
   *   3. Run tests on the resulting state to find out whether you successfully completed the level.
   */
  const runInSingleEnvironment = async (lucid: Lucid): Promise<boolean> => {
    const gameData = await setup(lucid);
    const testData = await play(lucid, gameData);
    return test(lucid, gameData, testData);
  };

  const runInAllEnvironments = async (
    run: (lucid: Lucid) => Promise<boolean>,
  ) => {
    let testsPassedEmulator = true;
    if (USE_EMULATOR) {
      try {
        console.log("Running on emulator...");
        testsPassedEmulator = await run(lucid_emulator);
      } catch (e) {
        console.log(e);
        console.log(
          "An error happened while running your code in the emulator.",
        );
        testsPassedEmulator = false;
      }
    } else {
      console.log("Emulator is disabled, skipping...");
    }
    if (testsPassedEmulator) {
      if (!USE_TESTNET) {
        console.log("Testnet is disabled, skipping...");
      } else if (lucid_testnet == undefined) {
        console.log(
          "Testnet is not configured, finish your configuration according to the README",
        );
      } else {
        console.log(
          "Running the task on testnet now, this will take some time...",
        );
        await run(lucid_testnet);
      }
    } else {
      console.log(
        "Tests did not pass on emulator, skipping the testnet. To force testnet, set USE_EMULATOR in config to false.",
      );
    }
  };

  runInAllEnvironments(runInSingleEnvironment);
}

export function filter_undefined(input_list: (string | undefined)[]): string[] {
  return input_list.filter((item): item is string => !!item);
}

export async function sleep(milliseconds: bigint): Promise<void> {
  const oneDayInMilliseconds = BigInt(24 * 60 * 60 * 1000);

  if (milliseconds >= oneDayInMilliseconds) {
    await new Promise((resolve) =>
      setTimeout(resolve, Number(oneDayInMilliseconds))
    );
    await sleep(milliseconds - oneDayInMilliseconds);
  } else {
    await new Promise((resolve) => setTimeout(resolve, Number(milliseconds)));
  }
}

export function getCurrentTime(lucid: Lucid) {
  if (lucid.provider instanceof Emulator) {
    return lucid.provider.now();
  }
  const current = new Date();
  return current.getTime();
}

export function second() {
  return 1000;
}

export function minute() {
  return 60 * second();
}

export function hour() {
  return 60 * minute();
}
