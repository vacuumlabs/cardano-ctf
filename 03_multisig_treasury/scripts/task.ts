import {
  applyParamsToScript,
  Lucid,
  Script,
  SpendingValidator,
  UTxO,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  cardanoscanLink,
  decodeBase64,
  filterUTXOsByTxHash,
  getWalletBalanceLovelace,
} from "../../common/offchain/utils.ts";
import { createMultisigDatum, createTreasuryDatum } from "./types.ts";
import blueprint from "../plutus.json" assert { type: "json" };
import {
  failTest,
  failTests,
  passAllTests,
  passTest,
} from "../../common/offchain/test_utils.ts";

export type Validators = {
  treasuryValidator: SpendingValidator;
  treasuryAddress: string;
  multisigValidator: SpendingValidator;
  multisigAddress: string;
};
export type GameData = {
  validators: Validators;
  treasuryFunds: bigint;
  treasuryOwners: string[];
  multisigReleaseValue: bigint;
  multisigBeneficiary: string;
  treasuryUTxO: UTxO;
  treasuryUTxOHash: string;
  multisigUTxO: UTxO;
  originalBalance: bigint;
};
export type TestData = void;

function readValidators(lucid: Lucid): Validators {
  const multisig = blueprint.validators.find((v) =>
    v.title == "multisig.multisig"
  );
  if (!multisig) {
    throw new Error("Multisig validator not found.");
  }
  const multisigValidator: Script = {
    type: "PlutusV2",
    script: multisig.compiledCode,
  };
  const multisigAddress = lucid.utils.validatorToAddress(multisigValidator);

  const treasury = blueprint.validators.find((v) =>
    v.title == "treasury.treasury"
  );
  if (!treasury) {
    throw new Error("Treasury validator not found.");
  }
  const treasuryValidator: Script = {
    type: "PlutusV2",
    script: applyParamsToScript(treasury.compiledCode, [multisig.hash]),
  };
  const treasuryAddress = lucid.utils.validatorToAddress(treasuryValidator);

  return {
    treasuryValidator: treasuryValidator,
    treasuryAddress: treasuryAddress,
    multisigValidator: multisigValidator,
    multisigAddress: multisigAddress,
  };
}

export async function setup(lucid: Lucid) {
  console.log(`=== SETUP IN PROGRESS ===`);

  // Compile and setup the validators
  const validators = readValidators(lucid);
  const treasuryFunds = 10000000n;
  const multisigRelease = 8000000n;
  const ownAddress = await lucid.wallet.address();
  const multisigBeneficiary = ownAddress;
  const owners = [
    ownAddress,
    "addr_test1vrvpqazgry8p3lahfhwssx5hywl6m045wtjwjy98rqhraegvk9r78",
  ];

  const createTreasuryTx = await lucid
    .newTx()
    .payToContract(validators.treasuryAddress, {
      inline: createTreasuryDatum(treasuryFunds, owners, lucid),
    }, { "lovelace": treasuryFunds })
    .complete();

  const signedTrTx = await createTreasuryTx.sign().complete();
  const submitedTrTx = await signedTrTx.submit();
  console.log(
    `Treasury setup transaction was submitted, waiting for confirmations.\ntxHash: ${submitedTrTx}
  (check details at ${cardanoscanLink(submitedTrTx, lucid)})`,
  );
  await awaitTxConfirms(lucid, submitedTrTx);
  const treasuryUtxo = filterUTXOsByTxHash(
    await lucid.utxosAt(validators!.treasuryAddress),
    submitedTrTx,
  )[0];

  const createMultisigTx = await lucid
    .newTx()
    .payToContract(validators.multisigAddress, {
      inline: createMultisigDatum(
        multisigRelease,
        multisigBeneficiary,
        owners,
        [],
        lucid,
      ),
    }, {})
    .complete();

  const signedMSTx = await createMultisigTx.sign().complete();
  const submitedMSTx = await signedMSTx.submit();
  console.log(
    `Multisig setup transaction was submitted, waiting for confirmations.\ntxHash: ${submitedMSTx}
  (check details at ${cardanoscanLink(submitedMSTx, lucid)})`,
  );
  await awaitTxConfirms(lucid, submitedMSTx);

  const multisigUtxo = filterUTXOsByTxHash(
    await lucid.utxosAt(validators!.multisigAddress),
    submitedMSTx,
  )[0];

  const originalBalance = await getWalletBalanceLovelace(lucid);
  console.log(`Your wallet's balance after setup is ${originalBalance}`);

  console.log(`=== SETUP WAS SUCCESSFUL ===`);

  return {
    validators: validators,
    treasuryFunds: treasuryFunds,
    treasuryOwners: owners,
    multisigReleaseValue: multisigRelease,
    multisigBeneficiary: multisigBeneficiary,
    treasuryUTxO: treasuryUtxo,
    treasuryUTxOHash: submitedTrTx,
    multisigUTxO: multisigUtxo,
    originalBalance: originalBalance,
  };
}

export async function test(
  lucid: Lucid,
  gameData: GameData,
  _testData: TestData,
): Promise<boolean> {
  let passed = true;
  console.log("================TESTS==================");

  const endBalance = await getWalletBalanceLovelace(lucid);
  if (endBalance - gameData.originalBalance < 5000000n) {
    failTest(
      "TEST 1 FAILED -- you did not obtain enough additional ADA by unlocking the treasury",
    );
    passed = false;
  } else {
    passTest("TEST 1 PASSED", lucid);
  }

  const treasuryUtxos = filterUTXOsByTxHash(
    await lucid.utxosAt(gameData.validators.treasuryAddress),
    gameData.treasuryUTxOHash,
  );
  if (treasuryUtxos.length != 0) {
    failTest("TEST 2 FAILED -- the treasury UTxO was not spent");
    passed = false;
  } else {
    passTest("TEST 2 PASSED", lucid);
  }

  if (passed) {
    const encoded_blog_url =
      "aHR0cHM6Ly9tZWRpdW0uY29tL0B2YWN1dW1sYWJzX2F1ZGl0aW5nL2NhcmRhbm8tdnVsbmVyYWJpbGl0aWVzLTMtdHJ1c3Qtbm8tdXR4by1iMjUyNjUwYWMyYjk=";

    passAllTests(
      "\nCongratulations on the successful completion of the Level 03: Multisig Treasury\n" +
        `You can read more about the underlying vulnerability in this blog post: ${
          decodeBase64(encoded_blog_url)
        }` + "\nGood luck with the next level.",
      lucid,
    );
    return true;
  } else {
    failTests();
    return false;
  }
}
