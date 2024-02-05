use aiken/dict
use aiken/list
use aiken/transaction.{Mint, ScriptContext, Transaction} as tx
use aiken/transaction/value

validator {
  fn collateral_token(_redeemer: Void, ctx: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    expect Mint(policy_id) = purpose

    let Transaction { extra_signatories, mint, .. } = transaction
    expect [(asset_name, amount)] =
      mint
        |> value.from_minted_value
        |> value.tokens(policy_id)
        |> dict.to_list()
    if amount < 0 {
      True
    } else {
      list.any(extra_signatories, fn(signature) { signature == asset_name })
    }
  }
}
