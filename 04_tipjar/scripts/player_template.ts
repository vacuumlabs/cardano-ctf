import { Data, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  getFormattedTxDetails,
} from "../../common/offchain/utils.ts";
import { createTipJarDatum, TipJarDatum, TipJarRedeemer } from "./types.ts";
import { GameData, TestData } from "./task.ts";

export async function play(
  lucid: Lucid,
  gameData: GameData,
): Promise<TestData> {
  /**
   * The smart contracts are already deployed, see the [run.ts] file for more details.
   * The [gameData] variable contains all the things you need to interact with the vulnerable smart contracts.
   */

  const validator = gameData.scriptValidator;
  const utxo = gameData.scriptUtxo;
  const contract = gameData.scriptAddress;
  const lovelaceInUTxO = gameData.scriptUtxo.assets["lovelace"];

  if (utxo.datum == null) {
    throw new Error("UTxO object does not contain datum.");
  }

  const datum = Data.from(utxo.datum, TipJarDatum);

  // ================ YOUR CODE STARTS HERE

  console.log("\The TipJar was created.");

  console.log(`\nThe UTxO has following atributes`);
  console.log(utxo);
  console.log(`\nIt's datum is following`);
  console.log(datum);

  /**
   * HAPPY PATH -- example interaction with the Tip Jar.
   * In the code below, we tip 10 ADA into the Jar and add a Thank you! note for the owner.
   */

  const tx = await lucid
    .newTx()
    .collectFrom([utxo], Data.to("AddTip", TipJarRedeemer))
    .payToContract(contract, {
      inline: createTipJarDatum(datum.owner, ["Thank you!"]),
    }, { lovelace: lovelaceInUTxO + 10000000n })
    .attachSpendingValidator(validator)
    .complete();

  const signedTx = await tx.sign().complete();
  const tippingTxHash = await signedTx.submit();

  console.log(
    `AddTip transaction submitted${
      getFormattedTxDetails(tippingTxHash, lucid)
    }`,
  );

  await awaitTxConfirms(lucid, tippingTxHash);
  /**
   * This data is needed to make tests runnable.
   * Please make sure that correct data is put there.
   */
  const testData = { lastTx: tippingTxHash };

  // ================ YOUR CODE ENDS HERE

  return testData;
}
