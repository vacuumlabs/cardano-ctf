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
   * HAPPY PATH -- example interaction with the multisig and treasury scripts.
   * In the code that is currently here, we:
   * 1. Deploy the multisig UTxO signed with our signature and minting correct validation token into it.
   * 2. Try to unlock the treasury and withdraw 8 ADA.
   *
   * The second transaction fails as the multisig contains only one signature (ours) of the two required.
   */

  const ownAddress = await lucid.wallet.address();
  const multisigReleaseValue = 8000000n;

  const multisigScriptHash = lucid.utils.validatorToScriptHash(
    gameData.validators.multisigValidator,
  );

  const validationAsset =
    `${gameData.validators.policyId}${multisigScriptHash}`;

  const createMultisigTx = await lucid
    .newTx()
    .attachMintingPolicy(gameData.validators.validationPolicy)
    .mintAssets(
      { [validationAsset]: BigInt(1) },
      Data.void(),
    )
    .payToContract(gameData.validators.multisigAddress, {
      inline: createMultisigDatum(
        multisigReleaseValue,
        gameData.multisigBeneficiary,
        gameData.treasuryOwners,
        [ownAddress],
        lucid,
      ),
    }, { [validationAsset]: BigInt(1) })
    .addSigner(ownAddress)
    .complete();

  const signedMSTx = await createMultisigTx.sign().complete();
  const submitedMSTx = await signedMSTx.submit();
  console.log(
    `Transaction creating multisig with a validation token was submitted, waiting for confirmations.\ntxHash: ${submitedMSTx}
  (check details at ${cardanoscanLink(submitedMSTx, lucid)})`,
  );
  await awaitTxConfirms(lucid, submitedMSTx);

  const multisigUTxO = filterUTXOsByTxHash(
    await lucid.utxosAt(gameData.validators!.multisigAddress),
    submitedMSTx,
  );

  const treasuryBalance = gameData.treasuryFunds -
    multisigReleaseValue;

  // This transaction will fail because the multisig UTxO lacks the second signature.
  const unlockTreasuryTx = await lucid
    .newTx()
    .collectFrom(multisigUTxO, Data.to("Use", MultisigRedeemer))
    .collectFrom([gameData.treasuryUTxO], Data.void())
    .payToContract(gameData.validators.treasuryAddress, {
      inline: createTreasuryDatum(
        treasuryBalance,
        gameData.treasuryOwners,
        lucid.utils.validatorToScriptHash(
          gameData.validators.multisigValidator,
        ),
        lucid,
      ),
    }, { "lovelace": treasuryBalance })
    .addSigner(ownAddress)
    .attachSpendingValidator(gameData.validators.multisigValidator)
    .attachSpendingValidator(gameData.validators.treasuryValidator)
    .attachMintingPolicy(gameData.validators.validationPolicy)
    .mintAssets({ [validationAsset]: BigInt(-1) }, Data.void())
    .complete();

  const signedUnlockTx = await unlockTreasuryTx.sign().complete();
  const submitedUnlockTx = await signedUnlockTx.submit();
  console.log(
    `Access treasury signed transaction submitted, txHash: ${submitedUnlockTx}
  (check details at ${cardanoscanLink(submitedUnlockTx, lucid)})`,
  );
  await awaitTxConfirms(lucid, submitedUnlockTx);

  // ================ YOUR CODE ENDS HERE
}
