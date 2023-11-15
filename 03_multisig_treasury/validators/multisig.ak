use aiken/list
use aiken/transaction.{InlineDatum, ScriptContext, Transaction}
use types.{MultisigDatum, MultisigRedeemer, Sign, Use, VerificationKeyHash}
use utils.{count_outputs_by_address, own_input}

validator {
  fn multisig(
    datum: MultisigDatum,
    redeemer: MultisigRedeemer,
    ctx: ScriptContext,
  ) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    let Transaction { inputs, outputs, extra_signatories, .. } = transaction

    let own_input = own_input(purpose, inputs)

    let multisig_script_address = own_input.output.address
    let multisig_input_count =
      count_outputs_by_address(
        list.map(inputs, fn(utxo) { utxo.output }),
        multisig_script_address,
      )
    let multisig_output_count =
      count_outputs_by_address(outputs, multisig_script_address)

    when redeemer is {
      Use -> {
        expect multisig_input_count == 1
        expect multisig_output_count == 0
        list.any(
          datum.signed_users,
          fn(signature) { list.has(extra_signatories, signature) },
        )
      }
      Sign -> {
        expect Some(own_output) =
          list.find(
            outputs,
            fn(output) { multisig_script_address == output.address },
          )
        expect InlineDatum(datum_data) = own_output.datum
        expect output_datum: MultisigDatum = datum_data

        and {
          multisig_input_count == 1,
          multisig_output_count == 1,
          // Check proper modification of the Multisig UTxO
          output_datum.release_value == datum.release_value,
          output_datum.beneficiary == datum.beneficiary,
          output_datum.required_signers == datum.required_signers,
          list.length(output_datum.signed_users) > list.length(
            datum.signed_users,
          ),
          correctly_extended_signed_users(
            datum.signed_users,
            output_datum.signed_users,
            datum.required_signers,
            extra_signatories,
          ),
        }
      }
    }
  }
}

fn correctly_extended_signed_users(
  old_signed: List<VerificationKeyHash>,
  new_signed: List<VerificationKeyHash>,
  required_signers: List<VerificationKeyHash>,
  tx_signatures: List<VerificationKeyHash>,
) -> Bool {
  let no_repeated_signatures =
    list.all(
      new_signed,
      fn(signature) { list.count(new_signed, fn(x) { x == signature }) == 1 },
    )

  let no_removed_signatures =
    list.all(old_signed, fn(signature) { list.has(new_signed, signature) })

  let only_relevant_signatures =
    list.all(
      new_signed,
      fn(signature) { list.has(required_signers, signature) },
    )

  let all_new_signatures_actually_signed =
    list.all(
      new_signed,
      fn(signature) {
        list.has(old_signed, signature) || list.has(tx_signatures, signature)
      },
    )

  and {
    no_repeated_signatures,
    no_removed_signatures,
    only_relevant_signatures,
    all_new_signatures_actually_signed,
  }
}
