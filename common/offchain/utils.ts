import {
  BLOCKFROST_API_KEY,
  BLOCKFROST_URL,
  CONFIRMS_WAIT,
  PRIVATE_KEY,
  USE_EMULATOR,
  USE_TESTNET,
} from "./config.ts";
import {
  emulator,
  EMULATOR_PRIVATE_KEY,
  lucidEmulator,
  lucidTestnet,
} from "./setup_lucid.ts";
import {
  applyParamsToScript,
  C,
  Data,
  Lucid,
  MintingPolicy,
  Script,
  SpendingValidator,
  UTxO,
} from "https://deno.land/x/lucid@0.10.11/mod.ts";
import { OurEmulator } from "./emulator_provider.ts";
import {
  decode,
  encode,
} from "https://deno.land/std@0.202.0/encoding/base64.ts";

export const FIXED_MIN_ADA = 2000000n;

async function writeStringWithoutNewline(s: string) {
  const text = new TextEncoder().encode(s);
  await Deno.stdout.write(text);
}

export function isEmulator(lucid: Lucid) {
  return lucid.provider instanceof OurEmulator;
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
        const blockHash = isConfirmed.block;
        const block = await fetch(`${BLOCKFROST_URL}/blocks/${blockHash}`, {
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
  const utxos = await lucid.wallet.getUtxos()!;
  return utxos.reduce((sum, utxo) => sum + utxo.assets.lovelace, 0n);
}

export function cardanoscanLink(txHash: string, lucid: Lucid) {
  return isEmulator(lucid)
    ? ""
    : `Check details at https://preview.cardanoscan.io/transaction/${txHash} `;
}

export function getFormattedTxDetails(txHash: string, lucid: Lucid) {
  return `\n\tTx ID: ${txHash}\n\t${cardanoscanLink(txHash, lucid)}`;
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
        testsPassedEmulator = await run(lucidEmulator);
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
      } else if (lucidTestnet == undefined) {
        console.log(
          "Testnet is not configured, finish your configuration according to the README",
        );
      } else {
        console.log(
          "Running the task on testnet now, this will take some time...",
        );
        await run(lucidTestnet);
      }
    } else {
      console.log(
        "Tests did not pass on emulator, skipping the testnet. To force testnet, set USE_EMULATOR in config to false.",
      );
    }
  };

  runInAllEnvironments(runInSingleEnvironment);
}

export function filterUndefined(inputList: (string | undefined)[]): string[] {
  return inputList.filter((item): item is string => !!item);
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
  if (isEmulator(lucid)) {
    return (lucid.provider as OurEmulator).now();
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

export function privateKeyToPubKeyHash(bech32PrivateKey: string) {
  return C.PrivateKey.from_bech32(bech32PrivateKey).to_public().hash();
}

export function pubKeyHashToAddress(pubKeyHash: C.Ed25519KeyHash) {
  return C.EnterpriseAddress.new(0, C.StakeCredential.from_keyhash(pubKeyHash))
    .to_address()
    .to_bech32(undefined);
}

export function resetWallet(lucid: Lucid) {
  if (isEmulator(lucid)) {
    lucid.selectWalletFromPrivateKey(EMULATOR_PRIVATE_KEY);
  } else {
    lucid.selectWalletFromPrivateKey(PRIVATE_KEY);
  }
}

export async function fundWallet(
  lucid: Lucid,
  address: string,
  lovelace: bigint,
) {
  const tx = await lucid
    .newTx()
    .payToAddress(address, { lovelace })
    .complete();

  const signedTx = await tx.sign().complete();
  const submittedTx = await signedTx.submit();

  console.log(
    `Funded wallet ${address}${getFormattedTxDetails(submittedTx, lucid)}`,
  );

  await awaitTxConfirms(lucid, submittedTx);
}

interface BlueprintJSON {
  validators: {
    title: string;
    compiledCode: string;
    hash: string;
  }[];
}

type ValidatorData = {
  validator: SpendingValidator;
  address: string;
  hash: string;
};

export function setupValidator(
  lucid: Lucid,
  blueprint: BlueprintJSON,
  name: string,
  parameters?: Data[],
): ValidatorData {
  const jsonData = blueprint.validators.find((v) => v.title == name);
  if (!jsonData) {
    throw new Error(`Validator with a name ${name} was not found.`);
  }
  const compiledCode = jsonData.compiledCode;
  const validator: Script = {
    type: "PlutusV2",
    script: parameters === undefined
      ? compiledCode
      : applyParamsToScript(compiledCode, parameters),
  };
  const address = lucid.utils.validatorToAddress(validator);
  const hash = lucid.utils.validatorToScriptHash(validator);

  return { validator, address, hash };
}

type MintingPolicyData = {
  policy: MintingPolicy;
  policyId: string;
};

export function setupMintingPolicy(
  lucid: Lucid,
  blueprint: BlueprintJSON,
  name: string,
  parameters?: Data[],
): MintingPolicyData {
  const jsonData = blueprint.validators.find((v) => v.title == name);
  if (!jsonData) {
    throw new Error("Validation token policy not found.");
  }
  const compiledCode = jsonData.compiledCode;
  const policy: MintingPolicy = {
    type: "PlutusV2",
    script: parameters === undefined
      ? compiledCode
      : applyParamsToScript(compiledCode, parameters),
  };
  const policyId = lucid.utils.validatorToScriptHash(policy);
  return { policy, policyId };
}
