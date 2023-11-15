use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/transaction.{
  InlineDatum, Input, ScriptContext, Spend, find_input, find_script_outputs,
}
use aiken/transaction/credential.{ScriptCredential, VerificationKey}
use aiken/transaction/value.{lovelace_of}

type Datum {
  owner: Hash<Blake2b_224, VerificationKey>,
  messages: List<ByteArray>,
}

type Redeemer {
  Claim
  AddTip
}

const minimum_tip: Int = 5000000

validator {
  fn tipjar(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
    expect Spend(output_reference) = ctx.purpose
    let tx_inputs = ctx.transaction.inputs
    let tx_outputs = ctx.transaction.outputs
    expect Some(own_input) = find_input(tx_inputs, output_reference)
    expect ScriptCredential(own_hash) =
      own_input.output.address.payment_credential
    let script_outputs = find_script_outputs(tx_outputs, own_hash)
    // Only 1 script input
    expect count_input_scripts(tx_inputs) == 1
    // Only 1 output
    expect list.length(script_outputs) == 1
    expect Some(script_output) = list.head(script_outputs)
    expect InlineDatum(output_datum_raw) = script_output.datum
    expect output_datum: Datum = output_datum_raw

    when redeemer is {
      AddTip -> and {
          // Value is increased when tipping
          (lovelace_of(own_input.output.value) + minimum_tip <= lovelace_of(
            script_output.value,
          ))?,
          datum_is_correct(datum, output_datum)?,
        }
      // Owner can claim the tip jar by signing the transaction
      Claim -> list.has(ctx.transaction.extra_signatories, datum.owner)
    }
  }
}

fn count_input_scripts(inputs: List<Input>) -> Int {
  list.count(
    inputs,
    fn(input) {
      when input.output.address.payment_credential is {
        ScriptCredential(_) -> True
        _ -> False
      }
    },
  )
}

fn datum_is_correct(inputDatum: Datum, outputDatum: Datum) -> Bool {
  and {
    // Check that the owner is not changed
    (inputDatum.owner == outputDatum.owner)?,
    // Check that no messages were changed and one new is added
    datum_contains_one_more_message(inputDatum.messages, outputDatum.messages)?,
  }
}

fn datum_contains_one_more_message(
  input_messages: List<ByteArray>,
  output_messages: List<ByteArray>,
) -> Bool {
  let new_message = list.head(output_messages)
  when new_message is {
    Some(msg) -> list.push(input_messages, msg) == output_messages
    None -> False
  }
}
