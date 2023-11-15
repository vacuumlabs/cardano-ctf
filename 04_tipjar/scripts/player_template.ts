import { Data, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  cardanoscanLink,
} from "../../common/offchain/utils.ts";
import { createTipJarDatum, TipJarDatum, TipJarRedeemer } from "./types.ts";
import { setup, test } from "./task.ts";

export async function play(lucid: Lucid): Promise<boolean> {
  /**
   * The whole setup of the task is performed in the setup() function.
   * This function deploys the vulnerable smart contracts and returns gameData,
   *      which contain all the things you need to interact with them.
   */

  const gameData = await setup(lucid);

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

  const tx = await lucid!
    .newTx()
    .collectFrom([utxo], Data.to("AddTip", TipJarRedeemer))
    .payToContract(contract, {
      inline: createTipJarDatum(datum.owner, ["Thank you!"]),
    }, { lovelace: lovelaceInUTxO + 10000000n })
    .attachSpendingValidator(validator)
    .complete();

  const signedTx = await tx.sign().complete();
  const tippingTxHash = await signedTx.submit();

  console.log(`AddTip transaction submitted, txHash: ${tippingTxHash}
  ${cardanoscanLink(tippingTxHash, lucid)}`);

  await awaitTxConfirms(lucid, tippingTxHash);

  // ================ YOUR CODE ENDS HERE

  // We run the tests to see if you succesfully solved the task.
  gameData.lastTx = tippingTxHash;

  return test(gameData, lucid);
}
