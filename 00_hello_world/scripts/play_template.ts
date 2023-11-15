import {
  Constr,
  Data,
  fromText,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { lucid } from "../../common/offchain/config.ts";
import {
  awaitTxConfirms,
  cardanoscanLink,
} from "../../common/offchain/utils.ts";
import { setup, test } from "./task.ts";

// PART 1 -- the SETUP. DO NOT MODIFY

const gameData = await setup();

// PART 2
// This is just a sanity check, so you do not have to change much here to pass the tests
// Check the validator code to find out how to unlock the locked ADA!
// The following code fails, read the validator carefully to find out why?
// Hint base64: TG9vayBhdCB0aGUgcmVkZWVtZXIu

// We find the contract UTxO where the ADA is locked
// We create the redeemer

// ================ EDITABLE CODE STARTS HERE
// We unlock the locked UTxO using the redeemer "Hello, World!".

console.log(`Building a transaction to unlock the locked script UTxO`);

const redeemer = Data.to(new Constr(0, [fromText("Hello, World!")]));
const utxo = gameData.scriptUtxo;
const scriptValidator = gameData.scriptValidator;

const tx = await lucid
  .newTx()
  .collectFrom([utxo], redeemer)
  .attachSpendingValidator(scriptValidator)
  .complete();

const signedTx = await tx
  .sign()
  .complete();

const unlockTxHash = await signedTx.submit();

console.log(`UTxO was successfuly unlocked with transaction ${unlockTxHash}
  (check details at ${cardanoscanLink(unlockTxHash)})`);

// We await the transaction confirmations.
await awaitTxConfirms(unlockTxHash);

// ================ YOUR CODE ENDS HERE
// Tests start here.

await test(gameData);
