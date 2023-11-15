import { Data, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  awaitTxConfirms,
  cardanoscanLink,
  filterUTXOsByTxHash,
} from "../../common/offchain/utils.ts";
import {
  createMultisigDatum,
  createTreasuryDatum,
  MultisigRedeemer,
} from "./types.ts";
import { setup, test } from "./task.ts";

export async function play(lucid: Lucid): Promise<boolean> {
  /**
   * The whole setup of the task is performed in the setup() function.
   * This function deploys the vulnerable smart contracts and returns gameData,
   *      which contain all the things you need to interact with them.
   */

  const gameData = await setup(lucid);

  // ================ YOUR CODE STARTS HERE

  /**
   * HAPPY PATH -- example interaction with the multisig and treasury scripts.
   * In the code that is currently here, we:
   * 1. Sign the deployed multisig UTxO.
   * 2. Try to unlock the treasury and withdraw 8 ADA.
   *
   * The second transaction fails as the multisig contains only one signature (ours) of the two required.
   *
   * Note: Do NOT change anything in the gameData variable.
   */

  const ownAddress = await lucid.wallet.address();

  const signMultisigTx = await lucid
    .newTx()
    .collectFrom([gameData.multisigUTxO], Data.to("Sign", MultisigRedeemer))
    .payToContract(gameData.validators.multisigAddress, {
      inline: createMultisigDatum(
        BigInt(8000000),
        gameData.multisigBeneficiary,
        gameData.treasuryOwners,
        [ownAddress],
        lucid,
      ),
    }, {})
    .attachSpendingValidator(gameData.validators.multisigValidator)
    .addSigner(ownAddress)
    .complete();

  const signedMSTx = await signMultisigTx.sign().complete();
  const submitedMSTx = await signedMSTx.submit();
  console.log(`Multisig signing transaction submitted, txHash: ${submitedMSTx}
  (check details at ${cardanoscanLink(submitedMSTx, lucid)})`);
  await awaitTxConfirms(lucid, submitedMSTx);

  const multisigUTxO = filterUTXOsByTxHash(
    await lucid.utxosAt(gameData.validators.multisigAddress),
    submitedMSTx,
  );

  const treasuryBalance = gameData.treasuryFunds -
    gameData.multisigReleaseValue;

  const unlockTreasuryTx = await lucid
    .newTx()
    .collectFrom(multisigUTxO, Data.to("Use", MultisigRedeemer))
    .collectFrom([gameData.treasuryUTxO], Data.void())
    .payToContract(gameData.validators.treasuryAddress, {
      inline: createTreasuryDatum(
        treasuryBalance,
        gameData.treasuryOwners,
        lucid,
      ),
    }, { "lovelace": treasuryBalance })
    .addSigner(ownAddress)
    .attachSpendingValidator(gameData.validators.multisigValidator)
    .attachSpendingValidator(gameData.validators.treasuryValidator)
    .complete();

  const signedUnlockTx = await unlockTreasuryTx.sign().complete();
  const submitedUnlockTx = await signedUnlockTx.submit();
  console.log(
    `Access treasury signed transaction submitted, txHash: ${submitedUnlockTx}
  (check details at ${cardanoscanLink(submitedUnlockTx, lucid)})`,
  );
  await awaitTxConfirms(lucid, submitedUnlockTx);

  // ================ YOUR CODE ENDS HERE

  // We run the tests to see if you succesfully solved the task.
  return test(gameData, lucid);
}
