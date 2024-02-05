use aiken/list
use aiken/transaction.{Output}
use aiken/transaction/credential.{ScriptCredential}

pub fn count_script_outputs(utxos: List<Output>) -> Int {
  list.count(utxos, is_script_output)
}

fn is_script_output(utxo: Output) -> Bool {
  when utxo.address.payment_credential is {
    ScriptCredential(_) -> True
    _ -> False
  }
}
