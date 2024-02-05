import {
  Data,
  Lucid,
  MintingPolicy,
  PrivateKey,
  Script,
  SpendingValidator,
  UTxO,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  filterUTXOsByTxHash,
  getFormattedTxDetails,
  getWalletBalanceLovelace,
  resetWallet,
} from "../../common/offchain/utils.ts";
import { createLendingDatum, LendingDatum, LendingRedeemer } from "./types.ts";
import blueprint from "../plutus.json" assert { type: "json" };
import {
  failTest,
  failTests,
  passAllTests,
  passTest,
  submitSolutionRecord,
} from "../../common/offchain/test_utils.ts";

export type Validators = {
  collateralPolicy: MintingPolicy;
  collateralPolicyId: string;
  lendingValidator: SpendingValidator;
  lendingAddress: string;
};
export type Wallet = {
  privateKey: PrivateKey;
  address: string;
  lendingUTxOs: UTxO[];
  hash: string;
  collateralAsset: string;
};
export type GameData = {
  validators: Validators;
  wallets: Wallet[];
  originalBalance: bigint;
};
export type TestData = void;

export function addUTxOToWallet(
  gameData: GameData,
  walletAddress: string,
  utxo: UTxO,
) {
  for (const wallet of gameData.wallets) {
    if (wallet.address == walletAddress) {
      wallet.lendingUTxOs.push(utxo);
    }
  }
}

function readValidators(lucid: Lucid): Validators {
  const collateralToken = blueprint.validators.find((v) =>
    v.title == "collateral_token.collateral_token"
  );
  if (!collateralToken) {
    throw new Error("Validation token policy not found.");
  }

  const collateralPolicy: MintingPolicy = {
    type: "PlutusV2",
    script: collateralToken.compiledCode,
  };

  const collateralPolicyId = lucid.utils.validatorToScriptHash(
    collateralPolicy,
  );

  const lending = blueprint.validators.find((v) =>
    v.title == "lending.lending"
  );
  if (!lending) {
    throw new Error("Lending validator not found.");
  }
  const lendingValidator: Script = {
    type: "PlutusV2",
    script: lending.compiledCode,
  };
  const lendingAddress = lucid.utils.validatorToAddress(lendingValidator);

  return {
    collateralPolicy,
    collateralPolicyId,
    lendingValidator,
    lendingAddress,
  };
}

async function checkWalletValidity(
  lucid: Lucid,
  gameData: GameData,
  wallet: Wallet,
) {
  const privateKey = wallet.privateKey;
  const address = await lucid.selectWalletFromPrivateKey(privateKey).wallet
    .address();
  const sigHash = lucid.utils.getAddressDetails(address).paymentCredential
    ?.hash;
  if (sigHash === undefined) {
    throw new Error("The signature hash of provided wallet was undefined.");
  }
  if (
    wallet.address != address || wallet.hash != sigHash ||
    wallet.collateralAsset !=
      `${gameData.validators.collateralPolicyId}${sigHash}`
  ) {
    throw new Error(
      "Wallet provided to askForRepayment() was compromised. This is not the intended exploit!",
    );
  }
  resetWallet(lucid);
}

/**
 * @param lucid
 * @param gameData
 * @param wallet The wallet of the borrower connected to his [utxos]. See [GameData.wallets].
 * @param utxos Lending UTxOs that are to be repaid by the borrowers. Can contain multiple UTxOs but they need to belong to a single borrower.
 * @returns Lending UTxOs that resulted from the transaction repaying [utxos].
 */
export async function askForRepayment(
  lucid: Lucid,
  gameData: GameData,
  wallet: Wallet,
  utxos: UTxO[],
): Promise<UTxO[]> {
  const lenderAddress = await lucid.wallet.address();

  await checkWalletValidity(lucid, gameData, wallet);

  lucid.selectWalletFromPrivateKey(wallet.privateKey);

  const initialRepayTx = lucid
    .newTx()
    .attachSpendingValidator(gameData.validators.lendingValidator)
    .collectFrom(utxos, Data.to("Repay", LendingRedeemer));

  const repayTx = utxos.reduce((accTx, utxo) => {
    if (utxo.datum == null) {
      throw new Error("UTxO does not contain datum.");
    }
    if (!(wallet.collateralAsset in utxo.assets)) {
      throw new Error("UTxO does not contain expected collateral token.");
    }
    const datum = Data.from(utxo.datum, LendingDatum);
    const repayment = datum.borrowed_amount +
      datum.borrowed_amount * datum.interest / 10000n;
    return accTx.payToContract(
      gameData.validators.lendingAddress,
      {
        inline: createLendingDatum(
          wallet.address,
          lenderAddress,
          datum.borrowed_amount,
          datum.interest,
          datum.loan_duration,
          datum.loan_end,
          datum.collateral.policy_id,
          datum.collateral.asset_name,
          true,
          datum.unique_id,
        ),
      },
      { lovelace: repayment },
    );
  }, initialRepayTx);

  const completedRTx = await repayTx.addSigner(wallet.address).complete();
  const signedRTx = await completedRTx.sign().complete();
  const repayTxHash = await signedRTx.submit();

  console.log(
    `Provided UTxOs were repaid in full${
      getFormattedTxDetails(repayTxHash, lucid)
    }`,
  );

  await awaitTxConfirms(lucid, repayTxHash);

  resetWallet(lucid);

  return filterUTXOsByTxHash(
    await lucid.utxosAt(gameData.validators!.lendingAddress),
    repayTxHash,
  );
}

export async function setup(lucid: Lucid) {
  console.log(`=== SETUP IN PROGRESS ===`);

  const currentBalance = await getWalletBalanceLovelace(lucid);
  if (currentBalance < 120000000) {
    throw new Error(
      "Your wallet contains insufficient funds for this level. At least 120 ADA is needed. Use a faucet to obtain additional ADA.",
    );
  }

  const validators = readValidators(lucid);

  const borrower1PK = lucid.utils.generatePrivateKey();
  const borrower1Address = await lucid.selectWalletFromPrivateKey(borrower1PK)
    .wallet.address();
  const borrower1Hash =
    lucid.utils.getAddressDetails(borrower1Address).paymentCredential!.hash;
  const borrower2PK = lucid.utils.generatePrivateKey();
  const borrower2Address = await lucid.selectWalletFromPrivateKey(borrower2PK)
    .wallet.address();
  const borrower2Hash =
    lucid.utils.getAddressDetails(borrower2Address).paymentCredential!.hash;

  const borrower1Wallet: Wallet = {
    privateKey: borrower1PK,
    address: borrower1Address,
    lendingUTxOs: [],
    hash: borrower1Hash,
    collateralAsset: `${validators.collateralPolicyId}${borrower1Hash}`,
  };
  const borrower2Wallet: Wallet = {
    privateKey: borrower2PK,
    address: borrower2Address,
    lendingUTxOs: [],
    hash: borrower2Hash,
    collateralAsset: `${validators.collateralPolicyId}${borrower2Hash}`,
  };

  resetWallet(lucid);

  const fundBorrowersTx = await lucid
    .newTx()
    .payToAddress(borrower1Address, { lovelace: 50000000n })
    .payToAddress(borrower2Address, { lovelace: 50000000n })
    .complete();
  const signedFBTx = await fundBorrowersTx.sign().complete();
  const submittedFBTx = await signedFBTx.submit();
  console.log(
    `Funding borrowers' wallets with ADA${
      getFormattedTxDetails(submittedFBTx, lucid)
    }`,
  );
  await awaitTxConfirms(lucid, submittedFBTx);

  let uniqueId = 0;
  const borrowedAmounts = [
    5300000n,
    5600000n,
    4700000n,
    6300000n,
    7900000n,
    4600000n,
    4200000n,
    3300000n,
  ];
  const interests = [320n, 700n, 860n, 690n, 830n, 650n, 100n, 770n];
  const durations = [
    5280000000n,
    7080000000n,
    4260000000n,
    1800000000n,
    1380000000n,
    6840000000n,
    4200000000n,
    4620000000n,
  ];
  for (const wallet of [borrower1Wallet, borrower2Wallet]) {
    lucid.selectWalletFromPrivateKey(wallet.privateKey);
    let createLendingsTx = lucid
      .newTx()
      .attachMintingPolicy(validators.collateralPolicy)
      .mintAssets({ [wallet.collateralAsset]: 4n }, Data.void())
      .addSigner(wallet.address);
    for (let i = 0; i < 4; i++) {
      createLendingsTx = createLendingsTx.payToContract(
        validators.lendingAddress,
        {
          inline: createLendingDatum(
            wallet.address,
            null,
            borrowedAmounts[uniqueId],
            interests[uniqueId],
            durations[uniqueId],
            null,
            validators.collateralPolicyId,
            wallet.hash,
            false,
            BigInt(uniqueId),
          ),
        },
        { [wallet.collateralAsset]: 1n },
      );
      uniqueId++;
    }
    const completedTx = await createLendingsTx.complete();
    const signedTx = await completedTx.sign().complete();
    const submittedTx = await signedTx.submit();

    console.log(
      `Loan requests created for wallet: ${wallet.address}${
        getFormattedTxDetails(submittedTx, lucid)
      }`,
    );
    await awaitTxConfirms(lucid, submittedTx);

    wallet.lendingUTxOs = filterUTXOsByTxHash(
      await lucid.utxosAt(validators!.lendingAddress),
      submittedTx,
    );
  }

  resetWallet(lucid);

  const originalBalance = await getWalletBalanceLovelace(lucid);
  console.log(`Your wallet's balance after setup is ${originalBalance}`);

  console.log(`=== SETUP WAS SUCCESSFUL ===`);

  return {
    validators,
    wallets: [borrower1Wallet, borrower2Wallet],
    originalBalance,
  };
}

export async function test(
  lucid: Lucid,
  gameData: GameData,
  _testData: TestData,
): Promise<boolean> {
  let passed = true;
  const endBalance = await getWalletBalanceLovelace(lucid);
  console.log("================TESTS==================");

  const profit = endBalance - gameData.originalBalance;
  console.log(`You have made a profit of ${profit} lovelace`);

  if (profit < 4000000n) {
    failTest(
      "TEST 1 FAILED -- Your wallet did not obtain enough additional ADA",
    );
    passed = false;
  } else {
    passTest("TEST 1 PASSED -- You've made a big profit, enjoy!", lucid);
  }

  if (passed) {
    await submitSolutionRecord(lucid, 8n);
    passAllTests(
      "\nCongratulations on the successful completion of the Level 08: Lending\n" +
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
