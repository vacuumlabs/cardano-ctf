import { Data, fromText, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  FIXED_MIN_ADA,
  getFormattedTxDetails,
} from "../../common/offchain/utils.ts";
import { PurchaseOfferDatum, SellRedeemer } from "./types.ts";
import { getBech32FromAddress } from "../../common/offchain/types.ts";

import { GameData, TestData } from "./task.ts";

export async function play(
  lucid: Lucid,
  gameData: GameData,
): Promise<TestData> {
  /**
   * The smart contracts are already deployed, see the [run.ts] file for more details.
   * The [gameData] variable contains all the things you need to interact with the vulnerable smart contracts.
   */

  // ================ YOUR CODE STARTS HERE

  /**
   * HAPPY PATH -- example of interaction with the purchase_offer script
   * In the code that is currently here, we sell our precious NFT to the first purchase offer for our NFT.
   * Try to change this code so that you earn more ADA than is being offerred.
   *
   * DO NOT change anything in the `gameData` variable or in the game setup.
   */

  const asset = `${gameData.assetPolicyId}${fromText(gameData.assetTokenName)}`;
  const offerUtxo = gameData.scriptUtxos.find((utxo) => {
    const datum = Data.from(utxo.datum!, PurchaseOfferDatum);
    return (datum.desired_policy_id == gameData.assetPolicyId) &&
      (datum.desired_token_name == fromText(gameData.assetTokenName));
  })!;
  const offerUtxoOwner = Data.from(offerUtxo.datum!, PurchaseOfferDatum).owner;
  const offerUtxoOwnerAddress = getBech32FromAddress(
    lucid,
    offerUtxoOwner,
  );
  const redeemer = Data.to({
    sold_asset: {
      policy_id: gameData.assetPolicyId,
      asset_name: fromText(gameData.assetTokenName),
    },
  }, SellRedeemer);

  const tx = await lucid
    .newTx()
    .collectFrom([offerUtxo], redeemer)
    .payToAddress(offerUtxoOwnerAddress, {
      [asset]: BigInt(1),
      lovelace: FIXED_MIN_ADA,
    })
    .attachSpendingValidator(gameData.scriptValidator)
    .complete();

  const signedTx = await tx.sign().complete();
  const purchaseTxHash = await signedTx.submit();

  console.log(
    `Purchase Offer transaction submitted${
      getFormattedTxDetails(purchaseTxHash, lucid)
    }`,
  );

  await awaitTxConfirms(lucid, purchaseTxHash);

  // ================ YOUR CODE ENDS HERE
}
