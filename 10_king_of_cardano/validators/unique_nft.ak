use aiken/dict
use aiken/list
use aiken/transaction.{Mint, OutputReference, ScriptContext, Transaction}
use aiken/transaction/value

validator(token_name: ByteArray, utxo_ref: OutputReference) {
  fn unique_nft(_redeemer: Void, ctx: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    let Transaction { inputs, mint, .. } = transaction

    expect Mint(policy_id) = purpose
    expect [(actual_token_name, amount)] =
      mint
        |> value.from_minted_value
        |> value.tokens(policy_id)
        |> dict.to_list()

    or {
      amount == -1,
      and {
        amount == 1,
        actual_token_name == token_name,
        list.any(inputs, fn(input) { input.output_reference == utxo_ref }),
      },
    }
  }
}
