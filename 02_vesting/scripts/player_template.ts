import { Data, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  cardanoscanLink,
  getCurrentTime,
  hour,
  minute,
  sleep,
} from "../../common/offchain/utils.ts";
import { setup, test } from "./task.ts";

export async function play(lucid: Lucid): Promise<boolean> {
  const gameData = await setup(lucid);

  // ================ YOUR CODE STARTS HERE

  /**
   * HAPPY PATH -- example interaction with the vesting script
   * The code waits the whole vesting duration and then claims the rewards.
   */

  let currentTime = getCurrentTime(lucid);
  const remainingTime = gameData.lockUntil - currentTime;
  const offset = 5 * minute();

  console.log(
    `Vesting will be unlocked in ${
      Math.floor(remainingTime / hour())
    } hours and ${Math.floor((remainingTime % hour()) / minute())} minutes.
    waiting till the end of the vesting...`,
  );

  await sleep(BigInt(remainingTime + 2 * offset));

  const ownAddress = await lucid.wallet.address();
  currentTime = getCurrentTime(lucid);

  const tx = await lucid
    .newTx()
    .collectFrom([gameData.vestingtUtxo], Data.void())
    .attachSpendingValidator(gameData.vestingValidator)
    .addSigner(ownAddress)
    .validFrom(currentTime - offset)
    .validTo(currentTime + offset)
    .complete();

  const signedTx = await tx.sign().complete();

  const txHash = await signedTx.submit();
  await awaitTxConfirms(lucid, txHash);
  console.log(`vesting unlocked at:
          Tx ID: ${txHash}
            ${cardanoscanLink(txHash, lucid)}
      `);

  // ================ YOUR CODE ENDS HERE

  // We run the tests to see if you succesfully solved the task.
  return test(gameData, lucid);
}
