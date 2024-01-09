import {
  applyParamsToScript,
  Lucid,
  MintingPolicy,
  Script,
  SpendingValidator,
  UTxO,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  cardanoscanLink,
  filterUTXOsByTxHash,
  getWalletBalanceLovelace,
} from "../../common/offchain/utils.ts";
import { createTreasuryDatum } from "./types.ts";
import blueprint from "../plutus.json" assert { type: "json" };
import {
  failTest,
  failTests,
  passAllTests,
  passTest,
} from "../../common/offchain/test_utils.ts";

export type Validators = {
  validationPolicy: MintingPolicy;
  policyId: string;
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
  originalBalance: bigint;
};
export type TestData = void;

function readValidators(lucid: Lucid): Validators {
  const validationToken = blueprint.validators.find((v) =>
    v.title == "validation_token.multisig_validation"
  );
  if (!validationToken) {
    throw new Error("Validation token policy not found.");
  }

  const validationPolicy: MintingPolicy = {
    type: "PlutusV2",
    script: validationToken.compiledCode,
  };

  const policyId = lucid.utils.validatorToScriptHash(validationPolicy);

  const treasury = blueprint.validators.find((v) =>
    v.title == "treasury.treasury"
  );
  if (!treasury) {
    throw new Error("Treasury validator not found.");
  }
  const treasuryValidator: Script = {
    type: "PlutusV2",
    script: treasury.compiledCode,
  };
  const treasuryAddress = lucid.utils.validatorToAddress(treasuryValidator);

  const multisig = blueprint.validators.find((v) =>
    v.title == "multisig.multisig"
  );
  if (!multisig) {
    throw new Error("Multisig validator not found.");
  }
  const multisigValidator: Script = {
    type: "PlutusV2",
    script: applyParamsToScript(multisig.compiledCode, [
      policyId,
      lucid.utils.validatorToScriptHash(treasuryValidator),
    ]),
  };
  const multisigAddress = lucid.utils.validatorToAddress(multisigValidator);

  return {
    validationPolicy,
    policyId,
    treasuryValidator,
    treasuryAddress,
    multisigValidator,
    multisigAddress,
  };
}

export async function setup(lucid: Lucid) {
  console.log(`=== SETUP IN PROGRESS ===`);

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
      inline: createTreasuryDatum(
        treasuryFunds,
        owners,
        lucid.utils.validatorToScriptHash(validators.multisigValidator),
        lucid,
      ),
    }, { "lovelace": treasuryFunds })
    .complete();

  const signedTrTx = await createTreasuryTx.sign().complete();
  const submitedTrTx = await signedTrTx.submit();
  console.log(
    `Treasury setup transaction was submitted, waiting for confirmations.\ntxHash: ${submitedTrTx}
  (check details at ${cardanoscanLink(submitedTrTx, lucid)})`,
  );
  await awaitTxConfirms(lucid, submitedTrTx);
  const treasuryUTxO = filterUTXOsByTxHash(
    await lucid.utxosAt(validators!.treasuryAddress),
    submitedTrTx,
  )[0];

  const originalBalance = await getWalletBalanceLovelace(lucid);
  console.log(`Your wallet's balance after setup is ${originalBalance}`);

  console.log(`=== SETUP WAS SUCCESSFUL ===`);

  return {
    validators,
    treasuryFunds,
    treasuryOwners: owners,
    multisigReleaseValue: multisigRelease,
    multisigBeneficiary,
    treasuryUTxO,
    originalBalance,
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
  if (endBalance < gameData.originalBalance) {
    failTest(
      "TEST 1 FAILED -- you spent more ADA than you obtained from the exploit",
    );
    passed = false;
  } else {
    passTest("TEST 1 PASSED", lucid);
  }

  const treasuryUtxos = filterUTXOsByTxHash(
    await lucid.utxosAt(gameData.validators.treasuryAddress),
    gameData.treasuryUTxO.txHash,
  );
  if (treasuryUtxos.length != 0) {
    failTest("TEST 2 FAILED -- the treasury UTxO was not spent");
    passed = false;
  } else {
    passTest("TEST 2 PASSED", lucid);
  }

  if (passed) {
    passAllTests(
      "\nCongratulations on the successful completion of the Level 07: Multisig Treasury v2\n" +
        "A blog post describing this vulnerability is not yet out there. However, you can expect it to be published in our Medium from March to June.\n" +
        "Good luck with the next level.",
      lucid,
    );
    return true;
  } else {
    failTests();
    return false;
  }
}
