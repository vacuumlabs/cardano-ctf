use aiken/bytearray
use aiken/dict
use aiken/list
use aiken/transaction.{Mint, ScriptContext, Transaction}
use aiken/transaction/credential.{ScriptCredential, VerificationKeyCredential}
use aiken/transaction/value
use types.{ScriptHash}
use utils.{count_script_outputs}

validator(
  king_of_cardano_script_hash: ScriptHash,
  unique_nft_policy_id: ByteArray,
  unique_nft_tn: ByteArray,
) {
  fn king_nft(redeemer: ByteArray, ctx: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    let Transaction { inputs, mint, .. } = transaction
    let minted_value = value.from_minted_value(mint)

    expect Mint(policy_id) = purpose

    // We want the correct king_of_cardano script on input
    let king_of_cardano_input_found =
      list.any(transaction.inputs, fn(input) { and {
            when input.output.address.payment_credential is {
              VerificationKeyCredential(_) -> False
              ScriptCredential(script_hash) ->
                script_hash == king_of_cardano_script_hash
            },
            value.quantity_of(
              input.output.value,
              unique_nft_policy_id,
              unique_nft_tn,
            ) == 1,
          } })
    expect [(king_nft_tn, king_nft_amount)] =
      minted_value
        |> value.tokens(policy_id)
        |> dict.to_list()

    and {
      king_of_cardano_input_found,
      // No other script on input
      count_script_outputs(list.map(inputs, fn(utxo) { utxo.output })) == 1,
      // Unique NFT is burned
      value.quantity_of(minted_value, unique_nft_policy_id, unique_nft_tn) == -1,
      // Only one king NFT is minted
      king_nft_amount == 1,
      // Token name follows the correct format
      bytearray.length(redeemer) > 0,
      king_nft_tn == bytearray.concat(redeemer, " is King of Cardano"),
    }
  }
}
