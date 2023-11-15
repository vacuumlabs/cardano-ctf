import {
  Data,
  Lucid,
  SpendingValidator,
  TxHash,
  UTxO,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  cardanoscanLink,
  filterUTXOsByTxHash,
  getWalletBalanceLovelace,
} from "../../common/offchain/utils.ts";
import blueprint from "../plutus.json" assert { type: "json" };
import {
  failTest,
  failTests,
  passAllTests,
  passTest,
} from "../../common/offchain/test_utils.ts";

type GameData = {
  scriptValidator: SpendingValidator;
  scriptUtxo: UTxO;
  originalBalance: bigint;
};

function readValidator(): SpendingValidator {
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
  lucid: Lucid,
): Promise<TxHash> {
  const contractAddress = lucid.utils.validatorToAddress(into);

  const tx = await lucid
    .newTx()
    .payToContract(contractAddress, { inline: Data.void() }, { lovelace })
    .complete();

  const signedTx = await tx.sign().complete();

  return signedTx.submit();
}

export async function setup(lucid: Lucid) {
  console.log(`=== SETUP IN PROGRESS ===`);

  const originalBalance = await getWalletBalanceLovelace(lucid);
  const validator = readValidator();

  const _publicKeyHash = lucid.utils.getAddressDetails(
    await lucid.wallet.address(),
  ).paymentCredential?.hash;

  console.log(`Creating an UTxO at the smart contract script address...`);

  const txHash = await lock(10000000n, { into: validator }, lucid);

  await awaitTxConfirms(lucid, txHash);

  console.log(`10 ADA locked into the contract at:
          Tx ID: ${txHash}
            ${cardanoscanLink(txHash, lucid)}
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

export async function test(gameData: GameData, lucid: Lucid): Promise<boolean> {
  let passed = true;
  console.log("================TESTS==================");
  const endBalance = await getWalletBalanceLovelace(lucid);
  if (gameData.originalBalance - endBalance > 4000000n) {
    failTest("TEST 1 FAILED - you spent too much ADA");
    passed = false;
  } else {
    passTest("TEST 1 PASSED", lucid);
  }
  if (passed) {
    passAllTests(
      "\nCongratulations on the successful completion of the Level 00: Hello World!\nGood luck with the next level.",
      lucid,
    );
    return true;
  } else {
    failTests();
    return false;
  }
}
