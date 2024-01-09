use aiken/dict
use aiken/list
use aiken/transaction.{InlineDatum, Output, ScriptContext, Transaction} as tx
use aiken/transaction/credential.{ScriptCredential}
use aiken/transaction/value
use types.{MultisigDatum, VerificationKeyHash}
use utils.{count_script_outputs}

validator {
  fn multisig_validation(_redeemer: Void, ctx: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    expect tx.Mint(policy_id) = purpose

    let Transaction { outputs, extra_signatories, mint, .. } = transaction
    expect [(asset_name, amount)] =
      mint
        |> value.from_minted_value
        |> value.tokens(policy_id)
        |> dict.to_list()
    when amount is {
      // minting of the validation token
      1 -> {
        expect count_script_outputs(outputs) == 1
        expect [token_output] =
          list.filter(outputs, script_output_for_token(asset_name, _))

        expect InlineDatum(datum_data) = token_output.datum
        expect output_datum: MultisigDatum = datum_data

        // resulting multisig UTxO contains the minted token and signed_users of its datum contains only signatories from this transaction
        expect
          contains_only_signatories(
            output_datum.signed_users,
            extra_signatories,
          )
        value.quantity_of(token_output.value, policy_id, asset_name) == 1
      }
      -1 -> True
      _ -> False
    }
  }
}

fn script_output_for_token(token_name: ByteArray, utxo: Output) -> Bool {
  when utxo.address.payment_credential is {
    ScriptCredential(hash) -> hash == token_name
    _ -> False
  }
}

fn contains_only_signatories(
  signed_users: List<VerificationKeyHash>,
  tx_signatures: List<VerificationKeyHash>,
) -> Bool {
  list.all(signed_users, fn(signature) { list.has(tx_signatures, signature) })
}
