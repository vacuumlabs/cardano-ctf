import { Data, Lucid } from "https://deno.land/x/lucid@0.10.11/mod.ts";
import {
  awaitTxConfirms,
  getFormattedTxDetails,
} from "../../common/offchain/utils.ts";
import { SellNFTDatum } from "./types.ts";
import { GameData, TestData } from "./task.ts";

export async function play(
  lucid: Lucid,
  gameData: GameData,
): Promise<TestData> {
  /**
   * The smart contracts are already deployed, see the [run.ts] file for more details.
   * The [gameData] variable contains all the things you need to interact with the vulnerable smart contracts.
   */

  // The created gameData contains all of the important information. You can find it in following variables.

  const validator = gameData.scriptValidator;
  const utxos = gameData.scriptUtxos;
  const seller = gameData.seller;
  const contract = gameData.scriptAddress;
  const asset1 = gameData.assets[0];
  const asset2 = gameData.assets[1];

  if (utxos[0].datum == null || utxos[1].datum == null) {
    throw new Error("UTxO object does not contain datum.");
  }

  const datum1 = Data.from(utxos[0].datum, SellNFTDatum);
  const datum2 = Data.from(utxos[1].datum, SellNFTDatum);

  // ================ YOUR CODE STARTS HERE

  console.log("\nTwo UTxOs at the smart contract script address were created.");

  console.log(`\nThe first UTxO has following atributes`);
  console.log(utxos[0]);
  console.log(`\nIt's datum is following`);
  console.log(datum1);

  console.log(`\nThe second UTxO has following atributes`);
  console.log(utxos[1]);
  console.log(`\nIt's datum is following`);
  console.log(datum2);

  /**
   * HAPPY PATH -- example of interaction with the nft_sell script
   * In the code that is currently here, we use the deployed smart contract to buy a single NFT.
   * There is another UTxO with a more valuable NFT.
   * Try to change this code so that you buy both NFTs while spending less than price1 + price2 ADA.
   *
   * DO NOT change anything in the `gameData` variable.
   */

  const tx = await lucid
    .newTx()
    .collectFrom([utxos[1]], Data.void())
    .payToAddress(seller, { lovelace: datum2.price })
    .attachSpendingValidator(validator)
    .complete();

  const signedTx = await tx.sign().complete();
  const buyingTxHash = await signedTx.submit();

  console.log(
    `BuyNFT transaction submitted${getFormattedTxDetails(buyingTxHash, lucid)}`,
  );

  await awaitTxConfirms(lucid, buyingTxHash);

  // ================ YOUR CODE ENDS HERE
}
