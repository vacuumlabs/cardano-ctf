use aiken/list
use aiken/transaction.{InlineDatum, Input, Output, ScriptContext, Transaction}
use aiken/transaction/credential.{Address, ScriptCredential}
use aiken/transaction/value.{lovelace_of}
use types.{MultisigDatum, TreasuryDatum, VerificationKeyHash}
use utils.{count_script_outputs, own_input}

validator(multisigHash: ByteArray) {
  fn treasury(
    treasury_input_datum: TreasuryDatum,
    _redeemer: Void,
    ctx: ScriptContext,
  ) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    let Transaction { inputs, outputs, .. } = transaction

    // Parsing inputs and outputs
    let treasury_input = own_input(purpose, inputs)
    let treasury_script_address = treasury_input.output.address
    expect Some(multisig_input) =
      list.find(inputs, has_multisig_hash(_, multisigHash))
    expect Some(treasury_output) =
      list.find(
        outputs,
        fn(output) { treasury_script_address == output.address },
      )

    // Parsing the datums of the ongoing script UTxOs
    expect InlineDatum(datum_data) = multisig_input.output.datum
    expect multisig_datum: MultisigDatum = datum_data
    expect InlineDatum(datum_data) = treasury_output.datum
    expect treasury_output_datum: TreasuryDatum = datum_data

    // Checking the treasury output UTxO
    let treasury_output_value = lovelace_of(treasury_output.value)
    let treasury_updated_correctly = and {
        treasury_output_value >= 2000000,
        treasury_output_value >= treasury_output_datum.value,
        correctly_changed_treasury_datum(
          treasury_input_datum,
          treasury_output_datum,
          multisig_datum.release_value,
        ),
      }

    // All the checks
    and {
      count_script_outputs(list.map(inputs, fn(input) { input.output })) == 2,
      count_script_outputs(outputs) == 1,
      treasury_updated_correctly,
      contains_all_required_signatures(
        treasury_input_datum.owners,
        multisig_datum.signed_users,
      ),
      funds_released_to_beneficiary(
        outputs,
        multisig_datum.beneficiary,
        multisig_datum.release_value,
      ),
    }
  }
}

fn contains_all_required_signatures(
  owners: List<VerificationKeyHash>,
  signers: List<VerificationKeyHash>,
) -> Bool {
  expect list.length(owners) == list.length(signers)
  list.all(owners, fn(owner) { list.has(signers, owner) })
}

fn correctly_changed_treasury_datum(
  input_datum: TreasuryDatum,
  output_datum: TreasuryDatum,
  released_value: Int,
) -> Bool {
  and {
    input_datum.owners == output_datum.owners,
    input_datum.value <= output_datum.value + released_value,
  }
}

fn funds_released_to_beneficiary(
  utxos: List<Output>,
  beneficiary: Address,
  release_value: Int,
) -> Bool {
  list.any(
    utxos,
    fn(utxo) {
      utxo.address == beneficiary && lovelace_of(utxo.value) >= release_value
    },
  )
}

fn has_multisig_hash(utxo: Input, multisigHash: ByteArray) -> Bool {
  when utxo.output.address.payment_credential is {
    ScriptCredential(hash) -> multisigHash == hash
    _ -> False
  }
}
