import {
  Data,
  Lucid,
  SpendingValidator,
  TxHash,
  UTxO,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  brightGreen,
  brightRed,
} from "https://deno.land/std@0.206.0/fmt/colors.ts";
import { lucid } from "../../common/offchain/config.ts";
import {
  awaitTxConfirms,
  cardanoscanLink,
  filterUTXOsByTxHash,
  getWalletBalanceLovelace,
} from "../../common/offchain/utils.ts";
import blueprint from "../plutus.json" assert { type: "json" };

type GameData = {
  scriptValidator: SpendingValidator;
  scriptUtxo: UTxO;
  originalBalance: bigint;
};

function readValidator(_lucid: Lucid): SpendingValidator {
  const validator = blueprint.validators.find(
    (v) => v.title === "hello_world.hello_world",
  );

  if (validator?.compiledCode === undefined) {
    throw new Error("Compiled code for validator was not found.");
  }

  return {
    type: "PlutusV2",
    script: validator?.compiledCode,
  };
}

export async function lock(
  lovelace: bigint,
  { into }: { into: SpendingValidator },
): Promise<TxHash> {
  const contractAddress = lucid.utils.validatorToAddress(into);

  const tx = await lucid
    .newTx()
    .payToContract(contractAddress, { inline: Data.void() }, { lovelace })
    .complete();

  const signedTx = await tx.sign().complete();

  return signedTx.submit();
}

export async function setup() {
  console.log(`=== SETUP IN PROGRESS ===`);

  const originalBalance = await getWalletBalanceLovelace();
  const validator = readValidator(lucid);

  const _publicKeyHash = lucid.utils.getAddressDetails(
    await lucid.wallet.address(),
  ).paymentCredential?.hash;

  console.log(`Creating an UTxO at the smart contract script address...`);

  const txHash = await lock(10000000n, { into: validator });

  await awaitTxConfirms(txHash);

  console.log(`10 ADA locked into the contract at:
          Tx ID: ${txHash}
            (check details at ${cardanoscanLink(txHash)})
      `);

  const contractAddress = lucid.utils.validatorToAddress(validator);

  console.log(`=== SETUP WAS SUCCESSFUL ===`);

  return {
    scriptValidator: validator,
    scriptUtxo:
      filterUTXOsByTxHash(await lucid.utxosAt(contractAddress), txHash)[0],
    originalBalance: originalBalance,
  };
}

export async function test(gameData: GameData) {
  let passed = true;
  console.log("================TESTS==================");
  const endBalance = await getWalletBalanceLovelace();
  if (gameData.originalBalance - endBalance > 4000000n) {
    console.log(brightRed("TEST 1 FAILED - you spent too much ADA"));
    passed = false;
  } else {
    console.log(brightGreen("TEST 1 PASSED"));
  }
  if (passed) {
    console.log(brightGreen(
      "\nCongratulations on the successful completion of the Level 0: Hello World!",
    ));
    console.log("Good luck with the next level.");
  }
}
