use aiken/list
use aiken/transaction.{
  InlineDatum, ScriptContext, Spend, Transaction, find_input,
}
use aiken/transaction/credential.{VerificationKeyCredential}
use aiken/transaction/value.{lovelace_of}
use types.{
  CloseCompetition, Datum, MintKingNFT, OverthrowKing, Redeemer,
  VerificationKeyHash,
}
use utils.{count_script_outputs}

const minimum_increase = 5_000_000

validator(
  admin_pkh: VerificationKeyHash,
  unique_nft_policy_id: ByteArray,
  unique_nft_tn: ByteArray,
) {
  fn king_of_cardano(
    datum: Datum,
    redeemer: Redeemer,
    ctx: ScriptContext,
  ) -> Bool {
    expect Spend(own_output_ref) = ctx.purpose
    let Transaction { inputs, mint, .. } = ctx.transaction
    expect Some(own_input) = find_input(ctx.transaction.inputs, own_output_ref)

    // To prevent double satisfaction
    expect count_script_outputs(list.map(inputs, fn(utxo) { utxo.output })) == 1
    when redeemer is {
      OverthrowKing -> {
        let previous_ada_value = lovelace_of(own_input.output.value)

        let paid_to_previous_king =
          list.any(ctx.transaction.outputs, fn(output) { and {
                lovelace_of(output.value) >= previous_ada_value,
                output.address == datum.current_king,
              } })

        expect Some(own_continuing_output) =
          list.find(
            ctx.transaction.outputs,
            fn(output) { output.address == own_input.output.address },
          )

        expect InlineDatum(next_datum) = own_continuing_output.datum
        expect parsed_next_datum: Datum = next_datum

        let ada_amount_increased =
          lovelace_of(own_continuing_output.value) >= previous_ada_value + minimum_increase
        let unique_token_still_present =
          value.quantity_of(
            own_continuing_output.value,
            unique_nft_policy_id,
            unique_nft_tn,
          ) == 1
        let no_token_dos =
          list.length(value.flatten(own_continuing_output.value)) == 2

        and {
          // Interaction allowed only while it is not closed
          datum.competition_closed == False,
          // You can not close the competition
          parsed_next_datum.competition_closed == False,
          ada_amount_increased,
          unique_token_still_present,
          no_token_dos,
          paid_to_previous_king,
        }
      }
      MintKingNFT -> {
        expect VerificationKeyCredential(kings_pkh) =
          datum.current_king.payment_credential
        and {
          datum.competition_closed,
          list.has(ctx.transaction.extra_signatories, kings_pkh),
          // Unique NFT is burned
          (
            mint
              |> value.from_minted_value
              |> value.quantity_of(unique_nft_policy_id, unique_nft_tn)
          ) == -1,
        }
      }
      CloseCompetition -> {
        expect Some(own_continuing_output) =
          list.find(
            ctx.transaction.outputs,
            fn(output) { output.address == own_input.output.address },
          )
        let expected_continuing_datum =
          Datum(datum.current_king, True) |> InlineDatum
        and {
          datum.competition_closed == False,
          own_continuing_output.datum == expected_continuing_datum,
          own_continuing_output.value == own_input.output.value,
          list.has(ctx.transaction.extra_signatories, admin_pkh),
        }
      }
    }
  }
}
