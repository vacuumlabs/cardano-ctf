use aiken/list
use aiken/option
use aiken/transaction.{ScriptContext, Spend, find_input}
use aiken/transaction/credential.{Address}
use aiken/transaction/value.{AssetName, PolicyId, quantity_of}

type AssetClass {
  policy_id: PolicyId,
  asset_name: AssetName,
}

type Datum {
  owner: Address,
  desired_policy_id: PolicyId,
  // If None, then any NFT from the collection will do.
  desired_token_name: Option<AssetName>,
}

// Normally, there would be a Claim redeemer as well. It's not needed for our demonstration, though
type SellRedeemer {
  sold_asset: AssetClass,
}

validator {
  fn purchase_offer(
    datum: Datum,
    redeemer: SellRedeemer,
    ctx: ScriptContext,
  ) -> Bool {
    expect Spend(own_output_ref) = ctx.purpose
    expect Some(own_input) = find_input(ctx.transaction.inputs, own_output_ref)
    let AssetClass(sold_policy_id, sold_token_name) = redeemer.sold_asset

    let sold_compatible_asset = and {
        sold_policy_id == datum.desired_policy_id,
        when datum.desired_token_name is {
          None -> True
          Some(token_name) -> token_name == sold_token_name
        },
      }

    let asset_really_sold =
      ctx.transaction.outputs
        |> list.find(fn(output) { and {
                 output.address == datum.owner,
                 quantity_of(output.value, sold_policy_id, sold_token_name) == 1,
               } })
        |> option.is_some

    let single_script_input =
      (
        ctx.transaction.inputs
          |> list.filter(
               fn(input) { input.output.address == own_input.output.address },
             )
          |> list.length
      ) == 1

    and {
      sold_compatible_asset,
      asset_really_sold,
      single_script_input,
    }
  }
}
