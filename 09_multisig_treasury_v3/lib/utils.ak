use aiken/list
use aiken/transaction.{Input, Output, ScriptPurpose, Spend}
use aiken/transaction/credential.{
  Address, ScriptCredential, VerificationKeyCredential,
}
use types.{ScriptHash}

pub fn count_outputs_by_address(utxos: List<Output>, address: Address) -> Int {
  list.count(utxos, fn(utxo) { address == utxo.address })
}

pub fn count_outputs_by_validator_hash(
  utxos: List<Output>,
  validator_hash: ScriptHash,
) -> Int {
  list.count(
    utxos,
    fn(utxo) {
      when utxo.address.payment_credential is {
        VerificationKeyCredential(_) -> False
        ScriptCredential(script_hash) -> validator_hash == script_hash
      }
    },
  )
}

pub fn count_script_outputs(utxos: List<Output>) -> Int {
  list.count(utxos, is_script_output)
}

pub fn own_input(purpose: ScriptPurpose, inputs: List<Input>) -> Input {
  expect Spend(output_reference) = purpose
  expect Some(found_input) =
    list.find(inputs, fn(input) { output_reference == input.output_reference })
  found_input
}

pub fn is_script_output(utxo: Output) -> Bool {
  when utxo.address.payment_credential is {
    ScriptCredential(_) -> True
    _ -> False
  }
}
