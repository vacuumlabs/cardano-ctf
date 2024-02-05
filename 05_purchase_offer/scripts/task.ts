import {
  applyDoubleCborEncoding,
  applyParamsToScript,
  Constr,
  Credential,
  Data,
  fromText,
  getAddressDetails,
  Lucid,
  MintingPolicy,
  OutRef,
  Script,
  SpendingValidator,
  UTxO,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { shuffleArray } from "https://deno.land/x/shuffle_array@v1.0.7/mod.ts";

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
import { createPurchaseOfferDatumSchema } from "./types.ts";
import blueprint from "../plutus.json" assert { type: "json" };

export type Validators = {
  mintNFT: MintingPolicy;
  purchaseOfferValidator: SpendingValidator;
};
export type AppliedValidators = {
  mintNFT: MintingPolicy;
  policyId: string;
};
export type GameData = {
  scriptValidator: Script;
  scriptUtxos: UTxO[];
  assetPolicyId: string;
  assetTokenName: string;
  balanceAfterSetup: bigint;
};
export type TestData = void;

type Prescription = {
  owner: string;
  desiredAssetPolicyId: string;
  desiredAssetTokenName: string | null;
  setProtocolStakingCredential: boolean;
};

const offerredPrice = 10000000n; // 10 ADA

function readValidators(): Validators {
  const mintNFT = blueprint.validators.find(
    (v) => v.title === "nft.unique_nft",
  );
  if (!mintNFT) throw new Error("MintNFT validator not found");

  const offer = blueprint.validators.find((v) =>
    v.title === "purchase_offer.purchase_offer"
  );
  if (!offer) throw new Error("PurchaseOffer validator not found");

  return {
    mintNFT: {
      type: "PlutusV2",
      script: mintNFT.compiledCode,
    },
    purchaseOfferValidator: {
      type: "PlutusV2",
      script: offer.compiledCode,
    },
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

export async function setup(lucid: Lucid): Promise<GameData> {
  console.log(`=== SETUP IN PROGRESS ===`);

  // Compile and setup the validators
  const validators = readValidators();

  const assetTokenName = `${UNIQUE_ID} -- NFT`;
  const utxosAtBeginning = await lucid.wallet.getUtxos();
  const nftOriginUtxo = utxosAtBeginning[0];
  const originalBalance = await getWalletBalanceLovelace(lucid);
  console.log(`Your wallet's balance at the beginning is ${originalBalance}`);

  const outputReference = {
    txHash: nftOriginUtxo.txHash,
    outputIndex: nftOriginUtxo.outputIndex,
  };
  const parameterizedNFTContract = applyParamsToNFT(
    assetTokenName,
    outputReference,
    validators,
    lucid,
  );

  const assetPolicyId = parameterizedNFTContract!.policyId;
  const asset = `${assetPolicyId}${fromText(assetTokenName)}`;

  const protocolStakingCredential: Credential = {
    type: "Key",
    hash: "84848484848484848484848484848484848484848484848484848484",
  };

  // Based on these encoded "prescriptions", purchase offer UTxOs are created.
  // Note that the resulting array is randomly shuffled -- resulting in a different order every time you run it.
  const encodedPrescriptions =
    "W3sib3duZXIiOiJhZGRyX3Rlc3QxcXpwcXJjMnh2ZXZuM2pkbnh2aDB6am0yZm5ta3lqcmVudGZrZDZjZndsbnpqcnV6cThzNXZlamU4cnlteHZldzc5OWs1bjhodmZ5OG54a252bTRzamFseDl5OHNkOTB3MDciLCJkZXNpcmVkQXNzZXRQb2xpY3lJZCI6IlBPTElDWTAiLCJkZXNpcmVkQXNzZXRUb2tlbk5hbWUiOm51bGwsInNldFByb3RvY29sU3Rha2luZ0NyZWRlbnRpYWwiOnRydWV9LHsib3duZXIiOiJhZGRyX3Rlc3QxcXo0cjZycjVqenUzcnJ6dnBycTgzNXVnYTZwNWxhemZkdm5ndXVycjA4bmY1ZmEyODV4OGZ5OWV6eHh5Y3p4cTByZmMzbTVyZmw2eWo2ZXgzZWN4eDcweG5nbnNwc3pmYTgiLCJkZXNpcmVkQXNzZXRQb2xpY3lJZCI6IlBPTElDWTEiLCJkZXNpcmVkQXNzZXRUb2tlbk5hbWUiOiJUT0tFTjAiLCJzZXRQcm90b2NvbFN0YWtpbmdDcmVkZW50aWFsIjpmYWxzZX0seyJvd25lciI6ImFkZHJfdGVzdDFxcjZ2Y2pyZWR4Nm5ydnNsOWQ0ZzhwcGhndnZ4M21udmRlbWdkMDV1cXpwNWpxaDVlM3k4ajZkNHh4ZXA3Mm0yc3d6cndzY2Nkcmh4Y21ua3M2bGZjcXlyZnlwcXlmd20wNyIsImRlc2lyZWRBc3NldFBvbGljeUlkIjoiUE9MSUNZMCIsImRlc2lyZWRBc3NldFRva2VuTmFtZSI6bnVsbCwic2V0UHJvdG9jb2xTdGFraW5nQ3JlZGVudGlhbCI6dHJ1ZX0seyJvd25lciI6ImFkZHJfdGVzdDFxcHpyOXB6OHU4ajlzcnF4MzlycnVkdWp3Nm1wZXV1N2t2dWpzc2d4OG01Z2Ztenl4Mnp5MGMweXRxeHFkejJ4OGNtZXlhNGtybmVlYXZlZTlwcXN2MGhnc25rcTljd2tjdCIsImRlc2lyZWRBc3NldFBvbGljeUlkIjoiUE9MSUNZMCIsImRlc2lyZWRBc3NldFRva2VuTmFtZSI6bnVsbCwic2V0UHJvdG9jb2xTdGFraW5nQ3JlZGVudGlhbCI6dHJ1ZX0seyJvd25lciI6ImFkZHJfdGVzdDFxcHpyOXB6OHU4ajlzcnF4MzlycnVkdWp3Nm1wZXV1N2t2dWpzc2d4OG01Z2Ztenl4Mnp5MGMweXRxeHFkejJ4OGNtZXlhNGtybmVlYXZlZTlwcXN2MGhnc25rcTljd2tjdCIsImRlc2lyZWRBc3NldFBvbGljeUlkIjoiUE9MSUNZMCIsImRlc2lyZWRBc3NldFRva2VuTmFtZSI6IlRPS0VOMSIsInNldFByb3RvY29sU3Rha2luZ0NyZWRlbnRpYWwiOmZhbHNlfSx7Im93bmVyIjoiYWRkcl90ZXN0MXFyNnZjanJlZHg2bnJ2c2w5ZDRnOHBwaGd2dngzbW52ZGVtZ2QwNXVxenA1anFoNWUzeThqNmQ0eHhlcDcybTJzd3pyd3NjY2RyaHhjbW5rczZsZmNxeXJmeXBxeWZ3bTA3IiwiZGVzaXJlZEFzc2V0UG9saWN5SWQiOiJQT0xJQ1kwIiwiZGVzaXJlZEFzc2V0VG9rZW5OYW1lIjoiVE9LRU4xIiwic2V0UHJvdG9jb2xTdGFraW5nQ3JlZGVudGlhbCI6ZmFsc2V9LHsib3duZXIiOiJhZGRyX3Rlc3QxcXJtenN1c2hyMHlnM2V0ZnBrejBzdW15bTZycnZqcnFzN256Mzh1dXVzbGFrejhrOXBlcHd4N2czcmpranJ2eWxwZWtmaDV4eGV5eHBwYXg5ejBlZWVwbG12eXFkZGdreTQiLCJkZXNpcmVkQXNzZXRQb2xpY3lJZCI6IlBPTElDWTAiLCJkZXNpcmVkQXNzZXRUb2tlbk5hbWUiOm51bGwsInNldFByb3RvY29sU3Rha2luZ0NyZWRlbnRpYWwiOnRydWV9LHsib3duZXIiOiJhZGRyX3Rlc3QxcXBtNm5la2hmcTU1M3B2NXhuczhoa3hqemVyaDUyZGdrM25oMHg2eDU0cXRsZW5oNDhuZHdqcGZmenplZ2Q4cTAwdmR5OWo4MGc1NjNkcjh3N2Q1ZGYycWhsbnFwMHZzeW0iLCJkZXNpcmVkQXNzZXRQb2xpY3lJZCI6IlBPTElDWTAiLCJkZXNpcmVkQXNzZXRUb2tlbk5hbWUiOiJUT0tFTjIiLCJzZXRQcm90b2NvbFN0YWtpbmdDcmVkZW50aWFsIjpmYWxzZX0seyJvd25lciI6ImFkZHJfdGVzdDFxcGp4eWVyamp6ZHhsZTV2eHdobmhyZ3o0dmtsZnFkNXpheWd4ZTQ3dndxeXpjdHl2Zmo4OXl5NmRsbmdjdmEwOHd4czkyZWQ3anFtZzk2Z3NkbnR1Y3VxZzlzc2pqejRkbiIsImRlc2lyZWRBc3NldFBvbGljeUlkIjoiUE9MSUNZMCIsImRlc2lyZWRBc3NldFRva2VuTmFtZSI6bnVsbCwic2V0UHJvdG9jb2xTdGFraW5nQ3JlZGVudGlhbCI6dHJ1ZX0seyJvd25lciI6ImFkZHJfdGVzdDFxcG1ndXp2emdzMGNlbXFweTNwbmZ5ajlkam56aGNlZHNobGZwdHUwN2V1eGNtcmszY3ljeTNxbDNua3F6ZnpyeGpmeTJtOXg5MDNqbXAwN2p6aGNsYW5jZDNrcXd4enp6bSIsImRlc2lyZWRBc3NldFBvbGljeUlkIjoiUE9MSUNZMCIsImRlc2lyZWRBc3NldFRva2VuTmFtZSI6IlRPS0VOMiIsInNldFByb3RvY29sU3Rha2luZ0NyZWRlbnRpYWwiOmZhbHNlfSx7Im93bmVyIjoiYWRkcl90ZXN0MXF6bmx2bGZrbjZsYXVjczYycDdzdzZmczJrbnVoZjRhM3duY2N3dDhuM3lmaDM5ODdlN25kODRsbWUzcDU1cmFxYTVucTRkOGV3bnRtemE4M3N1azA4emduMHpxMjA1OHdxIiwiZGVzaXJlZEFzc2V0UG9saWN5SWQiOiJQT0xJQ1kwIiwiZGVzaXJlZEFzc2V0VG9rZW5OYW1lIjpudWxsLCJzZXRQcm90b2NvbFN0YWtpbmdDcmVkZW50aWFsIjp0cnVlfSx7Im93bmVyIjoiYWRkcl90ZXN0MXFwbWd1enZ6Z3MwY2VtcXB5M3BuZnlqOWRqbnpoY2Vkc2hsZnB0dTA3ZXV4Y21yazNjeWN5M3FsM25rcXpmenJ4amZ5Mm05eDkwM2ptcDA3anpoY2xhbmNkM2txd3h6enptIiwiZGVzaXJlZEFzc2V0UG9saWN5SWQiOiJQT0xJQ1kwIiwiZGVzaXJlZEFzc2V0VG9rZW5OYW1lIjpudWxsLCJzZXRQcm90b2NvbFN0YWtpbmdDcmVkZW50aWFsIjp0cnVlfSx7Im93bmVyIjoiYWRkcl90ZXN0MXFwbTZuZWtoZnE1NTNwdjV4bnM4aGt4anplcmg1MmRnazNuaDB4Nng1NHF0bGVuaDQ4bmR3anBmZnp6ZWdkOHEwMHZkeTlqODBnNTYzZHI4dzdkNWRmMnFobG5xcDB2c3ltIiwiZGVzaXJlZEFzc2V0UG9saWN5SWQiOiJQT0xJQ1kwIiwiZGVzaXJlZEFzc2V0VG9rZW5OYW1lIjpudWxsLCJzZXRQcm90b2NvbFN0YWtpbmdDcmVkZW50aWFsIjp0cnVlfSx7Im93bmVyIjoiYWRkcl90ZXN0MXFwanh5ZXJqanpkeGxlNXZ4d2huaHJnejR2a2xmcWQ1emF5Z3hlNDd2d3F5emN0eXZmajg5eXk2ZGxuZ2N2YTA4d3hzOTJlZDdqcW1nOTZnc2RudHVjdXFnOXNzamp6NGRuIiwiZGVzaXJlZEFzc2V0UG9saWN5SWQiOiJQT0xJQ1kxIiwiZGVzaXJlZEFzc2V0VG9rZW5OYW1lIjoiVE9LRU4wIiwic2V0UHJvdG9jb2xTdGFraW5nQ3JlZGVudGlhbCI6ZmFsc2V9LHsib3duZXIiOiJhZGRyX3Rlc3QxcXB3aHdtZWZsMjU2dnNuYzJtZWp4bHA3am0zcjUwdGZjYW51OGZ2bXJmdnFxMzZhd2Foam43NGY1ZXA4czRobnlkN3JhOWh6OGc3a24zbThjd2pla3hqY3FwcnNuZTl3NTkiLCJkZXNpcmVkQXNzZXRQb2xpY3lJZCI6IlBPTElDWTAiLCJkZXNpcmVkQXNzZXRUb2tlbk5hbWUiOm51bGwsInNldFByb3RvY29sU3Rha2luZ0NyZWRlbnRpYWwiOnRydWV9LHsib3duZXIiOiJhZGRyX3Rlc3QxcXB3aHdtZWZsMjU2dnNuYzJtZWp4bHA3am0zcjUwdGZjYW51OGZ2bXJmdnFxMzZhd2Foam43NGY1ZXA4czRobnlkN3JhOWh6OGc3a24zbThjd2pla3hqY3FwcnNuZTl3NTkiLCJkZXNpcmVkQXNzZXRQb2xpY3lJZCI6IlBPTElDWTEiLCJkZXNpcmVkQXNzZXRUb2tlbk5hbWUiOm51bGwsInNldFByb3RvY29sU3Rha2luZ0NyZWRlbnRpYWwiOmZhbHNlfSx7Im93bmVyIjoiYWRkcl90ZXN0MXF6cHFyYzJ4dmV2bjNqZG54dmgwemptMmZubWt5anJlbnRma2Q2Y2Z3bG56anJ1enE4czV2ZWplOHJ5bXh2ZXc3OTlrNW44aHZmeThueGtudm00c2phbHg5eThzZDkwdzA3IiwiZGVzaXJlZEFzc2V0UG9saWN5SWQiOiJQT0xJQ1kxIiwiZGVzaXJlZEFzc2V0VG9rZW5OYW1lIjpudWxsLCJzZXRQcm90b2NvbFN0YWtpbmdDcmVkZW50aWFsIjpmYWxzZX0seyJvd25lciI6ImFkZHJfdGVzdDFxejRyNnJyNWp6dTNycnp2cHJxODM1dWdhNnA1bGF6ZmR2bmd1dXJyMDhuZjVmYTI4NXg4Znk5ZXp4eHljenhxMHJmYzNtNXJmbDZ5ajZleDNlY3h4NzB4bmduc3BzemZhOCIsImRlc2lyZWRBc3NldFBvbGljeUlkIjoiUE9MSUNZMCIsImRlc2lyZWRBc3NldFRva2VuTmFtZSI6bnVsbCwic2V0UHJvdG9jb2xTdGFraW5nQ3JlZGVudGlhbCI6dHJ1ZX0seyJvd25lciI6ImFkZHJfdGVzdDFxejRyNnJyNWp6dTNycnp2cHJxODM1dWdhNnA1bGF6ZmR2bmd1dXJyMDhuZjVmYTI4NXg4Znk5ZXp4eHljenhxMHJmYzNtNXJmbDZ5ajZleDNlY3h4NzB4bmduc3BzemZhOCIsImRlc2lyZWRBc3NldFBvbGljeUlkIjoiUE9MSUNZMCIsImRlc2lyZWRBc3NldFRva2VuTmFtZSI6IlRPS0VOMCIsInNldFByb3RvY29sU3Rha2luZ0NyZWRlbnRpYWwiOmZhbHNlfV0=";
  const tokenNameMapping = {
    TOKEN0: fromText(assetTokenName),
    TOKEN1: fromText(assetTokenName.slice(1)),
    TOKEN2: fromText(assetTokenName.slice(2)),
  };
  const policyMapping = {
    POLICY0: assetPolicyId,
    POLICY1: (assetPolicyId[0] != "f" ? "f" : "d") + assetPolicyId.slice(1),
  };

  const decodeAssets = (prescription: Prescription): Prescription => ({
    ...prescription,
    desiredAssetPolicyId: policyMapping[
      prescription.desiredAssetPolicyId as keyof typeof policyMapping
    ],
    desiredAssetTokenName: prescription.desiredAssetTokenName != null
      ? tokenNameMapping[
        prescription.desiredAssetTokenName as keyof typeof tokenNameMapping
      ]
      : null,
  });
  const offerPrescriptions = shuffleArray(
    JSON.parse(decodeBase64(encodedPrescriptions)) as Prescription[],
  ).map(decodeAssets);

  console.log(
    "Minting a precious NFT and creating multiple purchase offers...",
  );
  const tx = lucid
    .newTx()
    .collectFrom([nftOriginUtxo])
    .attachMintingPolicy(parameterizedNFTContract!.mintNFT)
    .mintAssets(
      { [asset]: BigInt(1) },
      Data.void(),
    );

  const enhancedTx = offerPrescriptions.reduce(
    (
      accTx,
      {
        owner,
        desiredAssetPolicyId,
        desiredAssetTokenName,
        setProtocolStakingCredential,
      },
    ) => {
      const validatorAddress = lucid.utils.validatorToAddress(
        validators!.purchaseOfferValidator,
        setProtocolStakingCredential
          ? protocolStakingCredential
          : getAddressDetails(owner)!.stakeCredential,
      );

      return accTx.payToContract(validatorAddress, {
        inline: createPurchaseOfferDatumSchema(
          owner,
          desiredAssetPolicyId,
          desiredAssetTokenName,
        ),
      }, { lovelace: offerredPrice });
    },
    tx,
  );

  const completedTx = await enhancedTx.complete();
  const signedTx = await completedTx.sign().complete();
  const txHash = await signedTx.submit();
  console.log(
    "Setup transaction was submitted to testnet, awaiting confirmations!",
  );
  await awaitTxConfirms(lucid, txHash);
  console.log(
    `NFT was minted and put to your balance. Purchase offers were also created${
      getFormattedTxDetails(txHash, lucid)
    }`,
  );

  const scriptUtxos = filterUTXOsByTxHash(
    await lucid.utxosAt(
      lucid.utils.scriptHashToCredential(
        lucid.utils.validatorToScriptHash(validators!.purchaseOfferValidator),
      ),
    ),
    txHash,
  );

  console.log(`=== SETUP WAS SUCCESSFUL ===`);

  const balanceAfterSetup = await getWalletBalanceLovelace(lucid);
  console.log(`Your wallet's balance after setup is ${balanceAfterSetup}`);

  return {
    scriptValidator: validators!.purchaseOfferValidator,
    scriptUtxos,
    assetPolicyId,
    assetTokenName,
    balanceAfterSetup,
  };
}

export async function test(
  lucid: Lucid,
  gameData: GameData,
  _testData: TestData,
): Promise<boolean> {
  console.log("================TESTS==================");
  let passed = true;

  const endBalance = await getWalletBalanceLovelace(lucid);

  console.log(`Your wallet's balance at the end is ${endBalance}`);

  // 1. Test that the user earned more than 50 ADA on top of his initial balance
  const balanceDiff = endBalance - gameData.balanceAfterSetup;
  if (balanceDiff > offerredPrice) {
    passTest(
      `TEST 1 PASSED - you earned more than the offerred price`,
      lucid,
    );
  } else {
    failTest(`TEST 1 FAILED - you did not earn enough ADA!`);
    passed = false;
  }

  if (passed) {
    await submitSolutionRecord(lucid, 5n);

    passAllTests(
      "\nCongratulations on the successful completion of the Level 05: Purchase Offer\nA blog post describing this vulnerability is not yet out there. However, you can expect it to be published in our Medium from March to June.\nGood luck with the next level.",
      lucid,
    );
    return true;
  } else {
    failTests();
    return false;
  }
}
