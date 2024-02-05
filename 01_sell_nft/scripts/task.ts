import {
  applyDoubleCborEncoding,
  applyParamsToScript,
  Constr,
  Data,
  fromText,
  Lucid,
  MintingPolicy,
  OutRef,
  Script,
  SpendingValidator,
  UTxO,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";

import { UNIQUE_ID } from "../../common/offchain/config.ts";
import {
  failTest,
  failTests,
  passAllTests,
  passTest,
  submitSolutionRecord,
} from "../../common/offchain/test_utils.ts";

import {
  awaitTxConfirms,
  decodeBase64,
  filterUTXOsByTxHash,
  getFormattedTxDetails,
  getWalletBalanceLovelace,
} from "../../common/offchain/utils.ts";
import { createSellNFTDatumSchema, SellNFTDatum } from "./types.ts";
import blueprint from "../plutus.json" assert { type: "json" };

export type Validators = {
  mintNFT: MintingPolicy;
  lockingValidator: SpendingValidator;
  sellNFT: SpendingValidator;
  sellingAddress: string;
  lockingAddress: string;
};
export type AppliedValidators = {
  mintNFT: MintingPolicy;
  policyId: string;
};
export type GameData = {
  scriptValidator: Script;
  scriptAddress: string;
  scriptUtxos: UTxO[];
  assets: string[];
  seller: string;
  originalBalance: bigint;
};
export type TestData = void;

function readValidators(lucid: Lucid): Validators {
  const mintNFT = blueprint.validators.find(
    (v) => v.title === "nft.unique_nft",
  );

  if (!mintNFT) {
    throw new Error("MintNFT validator not found");
  }

  const sell = blueprint.validators.find((v) => v.title === "nft_sell.buy");

  if (!sell) {
    throw new Error("SellNFT validator not found");
  }

  const lock = blueprint.validators.find((v) =>
    v.title === "locked.always_fails"
  );

  if (!lock) {
    throw new Error("Lock validator not found");
  }

  const lockValidator: Script = {
    type: "PlutusV2",
    script: lock.compiledCode,
  };
  const sellValidator: Script = {
    type: "PlutusV2",
    script: sell.compiledCode,
  };
  const lockAddress = lucid.utils.validatorToAddress(lockValidator);
  const sellAddress = lucid.utils.validatorToAddress(sellValidator);

  return {
    mintNFT: {
      type: "PlutusV2",
      script: mintNFT.compiledCode,
    },
    lockingValidator: lockValidator,
    sellNFT: sellValidator,
    sellingAddress: sellAddress,
    lockingAddress: lockAddress,
  };
}

function applyParamsToNFT(
  tokenName: string,
  outputReference: OutRef,
  validators: Validators,
  lucid: Lucid,
): AppliedValidators {
  const outRef = new Constr(0, [
    new Constr(0, [outputReference.txHash]),
    BigInt(outputReference.outputIndex),
  ]);

  const mintNFT = applyParamsToScript(validators.mintNFT.script, [
    fromText(tokenName),
    outRef,
  ]);

  const policyId = lucid.utils.validatorToScriptHash({
    type: "PlutusV2",
    script: mintNFT,
  });

  return {
    mintNFT: { type: "PlutusV2", script: applyDoubleCborEncoding(mintNFT) },
    policyId,
  };
}

export async function setup(lucid: Lucid) {
  console.log(`=== SETUP IN PROGRESS ===`);

  // Compile and setup the validators
  const validators = readValidators(lucid);

  const tokenName1 = `${UNIQUE_ID} -- NFT1`;
  const token1Price = 50000000n; // 50 ADA
  const token2Price = 40000000n; // 40 ADA

  const tokenName2 = `${UNIQUE_ID} -- NFT2`;
  const utxosAtBeginning = await lucid?.wallet.getUtxos()!;
  const nftOriginUtxo = utxosAtBeginning[0];
  const originalBalance = await getWalletBalanceLovelace(lucid);
  console.log(`Your wallet's balance at the beginning is ${originalBalance}`);

  const outputReference = {
    txHash: nftOriginUtxo.txHash,
    outputIndex: nftOriginUtxo.outputIndex,
  };
  const parameterizedContract1 = applyParamsToNFT(
    tokenName1,
    outputReference,
    validators,
    lucid,
  );
  const parameterizedContract2 = applyParamsToNFT(
    tokenName2,
    outputReference,
    validators,
    lucid,
  );
  const assetName1 = `${parameterizedContract1!.policyId}${
    fromText(tokenName1)
  }`;
  const assetName2 = `${parameterizedContract2!.policyId}${
    fromText(tokenName2)
  }`;
  const seller =
    "addr_test1vzztaxzsletuxldhd6ucyugn5uaye0qeumes3zt03q9xd4qe52pp4";

  const mintRedeemer = Data.void();
  console.log("Minting NFTs and locking them into a vulnerable contract...");
  const tx = await lucid
    .newTx()
    .collectFrom([nftOriginUtxo])
    .attachMintingPolicy(parameterizedContract1!.mintNFT)
    .attachMintingPolicy(parameterizedContract2!.mintNFT)
    .mintAssets(
      { [assetName1]: BigInt(1) },
      mintRedeemer,
    )
    .mintAssets(
      { [assetName2]: BigInt(1) },
      mintRedeemer,
    )
    .payToContract(validators!.sellingAddress, {
      inline: createSellNFTDatumSchema(seller, token1Price),
    }, { [assetName2]: BigInt(1) })
    .payToContract(validators!.sellingAddress, {
      inline: createSellNFTDatumSchema(seller, token2Price),
    }, { [assetName1]: BigInt(1) })
    .complete();
  const signedTx = await tx.sign().complete();
  const txHash = await signedTx.submit();
  console.log(
    "Setup transaction was submitted to testnet, awaiting confirmations!",
  );
  await awaitTxConfirms(lucid, txHash);
  console.log(`NFTs were minted${getFormattedTxDetails(txHash, lucid)}`);

  const scriptUtxos = filterUTXOsByTxHash(
    await lucid.utxosAt(validators!.sellingAddress),
    txHash,
  );

  console.log(`=== SETUP WAS SUCCESSFUL ===`);

  return {
    scriptValidator: validators!.sellNFT,
    scriptAddress: validators!.sellingAddress,
    scriptUtxos: scriptUtxos,
    assets: [assetName1, assetName2],
    seller: seller,
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

  const usersUTxOs = await lucid.utxosAt(await lucid.wallet.address());
  const endBalance = await getWalletBalanceLovelace(lucid);

  console.log(`Your wallet's balance at the end is ${endBalance}`);

  const asset1 = gameData.assets[0];
  const asset2 = gameData.assets[1];

  // 1. Test that NFT1 is on user's address
  const nft1InUsersWallet = usersUTxOs.some((utxo) =>
    Object.prototype.hasOwnProperty.call(utxo.assets, asset1)
  );
  if (nft1InUsersWallet) {
    passTest(`TEST 1 PASSED - you bought NFT ${asset1}`, lucid);
  } else {
    failTest(`TEST 1 FAILED - you did not buy NFT ${asset1}`);
    passed = false;
  }

  //2. Test that NFT2 is on user's address
  const nft2InUsersWallet = usersUTxOs.some((utxo) =>
    Object.prototype.hasOwnProperty.call(utxo.assets, asset2)
  );
  if (nft2InUsersWallet) {
    passTest(`TEST 2 PASSED - you bought NFT ${asset2}`, lucid);
  } else {
    failTest(`TEST 2 FAILED - you did not buy NFT ${asset2}`);
    passed = false;
  }

  //3. Test that the user did not pay the full amounts for both UTxOs

  if (
    gameData.scriptUtxos[0].datum == null ||
    gameData.scriptUtxos[1].datum == null
  ) {
    throw new Error("UTxO object does not contain a datum.");
  }

  const datum1 = Data.from(gameData.scriptUtxos[0].datum, SellNFTDatum);
  const datum2 = Data.from(gameData.scriptUtxos[1].datum, SellNFTDatum);

  const spentFunds = endBalance - gameData.originalBalance;
  if (spentFunds < datum1.price + datum2.price) {
    passTest(
      `TEST 3 PASSED - you spent less than the price of both NFTs`,
      lucid,
    );
  } else {
    failTest(`TEST 3 FAILED - you spent too much ADA!`);
    passed = false;
  }

  if (passed) {
    await submitSolutionRecord(lucid, 1n);

    const encoded_blog_url =
      "aHR0cHM6Ly9tZWRpdW0uY29tL0B2YWN1dW1sYWJzX2F1ZGl0aW5nL2NhcmRhbm8tdnVsbmVyYWJpbGl0aWVzLTEtZG91YmxlLXNhdGlzZmFjdGlvbi0yMTlmMWJjOTY2NWU=";

    passAllTests(
      "\nCongratulations on the successful completion of the Level 01: Sell NFT\n" +
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
