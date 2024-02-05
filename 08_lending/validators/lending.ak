use aiken/bytearray
use aiken/dict.{Dict}
use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite}
use aiken/list
use aiken/option.{is_none, is_some, map}
use aiken/transaction.{
  InlineDatum, Input, Output, Redeemer, ScriptContext, ScriptPurpose, Spend,
  Transaction, ValidityRange, find_input,
}
use aiken/transaction/credential.{
  Address, ScriptCredential, VerificationKey, VerificationKeyCredential,
}
use aiken/transaction/value.{
  AssetName, PolicyId, flatten, lovelace_of, quantity_of, without_lovelace,
}

type VerificationKeyHash =
  Hash<Blake2b_224, VerificationKey>

type AssetClass {
  policy_id: PolicyId,
  asset_name: AssetName,
}

type POSIXTime =
  Int

type LendingDatum {
  // the address that wants to borrow ADA
  borrower: Address,
  // the address that lent ADA; is set once the lending is fullfilled
  lender: Option<Address>,
  // the amount of ADA to be borrowed
  borrowed_amount: Int,
  // the size of the interest in percent times 100; interest of 2.5% is written as 250
  interest: Int,
  // for how long the loan is lent
  loan_duration: POSIXTime,
  // the deadline for repayment; is set once the lending is fullfilled to the current time plus loan_duration
  loan_end: Option<POSIXTime>,
  // the collateral token asset; amount not necessary in the datum
  collateral: AssetClass,
  // it is set to True once the lending is repaid
  repaid: Bool,
  // ID set by the user; all lending inputs in a single transaction need to have different IDs;
  // helps to match inputs to outputs and prevent double satisfaction;
  // not necessarily unique across different transactions
  unique_id: Int,
}

type LendingRedeemer {
  Lend
  Repay
  ClaimRepayment
  ClaimCollateral
}

validator {
  fn lending(
    datum: LendingDatum,
    redeemer: LendingRedeemer,
    ctx: ScriptContext,
  ) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    let Transaction {
      inputs,
      outputs,
      extra_signatories,
      validity_range,
      redeemers,
      ..
    } = transaction
    expect Spend(own_output_ref) = purpose
    expect Some(own_input) = find_input(inputs, own_output_ref)
    let own_script_address = own_input.output.address
    expect no_other_script_input(inputs, own_script_address)
    let script_inputs = filter_inputs_by_address(inputs, own_script_address)
    let script_inputs_count = list.length(script_inputs)
    expect unique_input_ids(script_inputs)
    when redeemer is {
      Lend -> {
        let own_output =
          find_corresponding_output(
            outputs,
            own_script_address,
            datum.unique_id,
          )
        let lend_script_inputs_count =
          list.count(
            script_inputs,
            fn(input) { has_correct_redeemer(input, redeemers, Lend) },
          )
        expect lend_script_inputs_count == script_inputs_count
        expect Some(first_script_input_ref) =
          script_inputs
            |> list.head
            |> map(fn(input) { input.output_reference })
        and {
          without_lovelace(own_input.output.value) == without_lovelace(
            own_output.value,
          ),
          correct_lend_datum(own_output, datum, validity_range),
          or {
            own_output_ref != first_script_input_ref,
            loans_paid_to_borrowers(script_inputs, outputs),
          },
        }
      }
      Repay -> {
        let own_output =
          find_corresponding_output(
            outputs,
            own_script_address,
            datum.unique_id,
          )
        let repay_script_inputs_count =
          list.count(
            script_inputs,
            fn(input) { has_correct_redeemer(input, redeemers, Repay) },
          )
        expect repay_script_inputs_count == script_inputs_count
        let repay_value =
          datum.borrowed_amount + datum.borrowed_amount * datum.interest / 10000
        and {
          list.length(flatten(own_output.value)) == 1,
          lovelace_of(own_output.value) >= repay_value,
          correct_repaid_datum(own_output, datum),
          signed_by_address(extra_signatories, datum.borrower),
        }
      }
      ClaimRepayment -> {
        expect Some(lender_address) = datum.lender
        and {
          datum.repaid,
          signed_by_address(extra_signatories, lender_address),
        }
      }
      ClaimCollateral -> {
        expect Some(lender_address) = datum.lender
        expect Some(loan_deadline) = datum.loan_end
        and {
          signed_by_address(extra_signatories, lender_address),
          deadline_passed(validity_range, loan_deadline),
        }
      }
    }
  }
}

fn signed_by_address(
  tx_signatures: List<VerificationKeyHash>,
  required_signature: Address,
) -> Bool {
  expect VerificationKeyCredential(signature_hash) =
    required_signature.payment_credential
  list.has(tx_signatures, signature_hash)
}

fn deadline_passed(range: ValidityRange, deadline: POSIXTime) -> Bool {
  when range.lower_bound.bound_type is {
    Finite(current_time) -> deadline <= current_time
    _ -> False
  }
}

fn find_corresponding_output(
  outputs: List<Output>,
  script_address: Address,
  id: Int,
) -> Output {
  expect [corresponding_output] =
    list.filter(
      outputs,
      fn(output) { output.address == script_address && get_id(output) == id },
    )
  corresponding_output
}

fn get_id(output: Output) -> Int {
  expect InlineDatum(datum_data) = output.datum
  expect datum: LendingDatum = datum_data
  datum.unique_id
}

fn correct_repaid_datum(output: Output, input_datum: LendingDatum) -> Bool {
  expect InlineDatum(datum_data) = output.datum
  expect datum: LendingDatum = datum_data
  and {
    input_datum.borrower == datum.borrower,
    is_some(datum.lender),
    input_datum.lender == datum.lender,
    input_datum.borrowed_amount == datum.borrowed_amount,
    input_datum.interest == datum.interest,
    input_datum.loan_duration == datum.loan_duration,
    is_some(datum.loan_end),
    input_datum.loan_end == datum.loan_end,
    input_datum.collateral == datum.collateral,
    input_datum.unique_id == datum.unique_id,
    datum.repaid,
  }
}

fn correct_lend_datum(
  output: Output,
  input_datum: LendingDatum,
  range: ValidityRange,
) -> Bool {
  expect InlineDatum(datum_data) = output.datum
  expect datum: LendingDatum = datum_data

  expect Finite(current_time) = range.upper_bound.bound_type
  expect Some(loan_end) = datum.loan_end

  and {
    input_datum.borrower == datum.borrower,
    is_none(input_datum.lender),
    is_some(datum.lender),
    input_datum.borrowed_amount == datum.borrowed_amount,
    input_datum.interest == datum.interest,
    input_datum.loan_duration == datum.loan_duration,
    is_none(input_datum.loan_end),
    current_time + datum.loan_duration <= loan_end,
    input_datum.collateral == datum.collateral,
    input_datum.unique_id == datum.unique_id,
    !datum.repaid,
    quantity_of(
      output.value,
      datum.collateral.policy_id,
      datum.collateral.asset_name,
    ) >= 1,
  }
}

fn no_other_script_input(
  inputs: List<Input>,
  own_script_address: Address,
) -> Bool {
  list.all(
    inputs,
    fn(input) {
      when input.output.address.payment_credential is {
        VerificationKeyCredential(_vkc) -> True
        ScriptCredential(_sc) -> input.output.address == own_script_address
      }
    },
  )
}

fn has_correct_redeemer(
  input: Input,
  redeemers: Dict<ScriptPurpose, Redeemer>,
  target_redeemer: LendingRedeemer,
) -> Bool {
  let purpose = Spend(input.output_reference)
  expect Some(redeemer_data) = dict.get(redeemers, purpose)
  expect redeemer: LendingRedeemer = redeemer_data
  redeemer == target_redeemer
}

fn extract_datums(inputs: List<Input>) -> List<LendingDatum> {
  list.map(
    inputs,
    fn(input) {
      expect InlineDatum(datum_data) = input.output.datum
      expect datum: LendingDatum = datum_data
      datum
    },
  )
}

fn loans_paid_to_borrowers(
  script_inputs: List<Input>,
  outputs: List<Output>,
) -> Bool {
  let lend_datums = extract_datums(script_inputs)
  let aggregated_payments =
    list.foldl(
      lend_datums,
      dict.new(),
      fn(datum: LendingDatum, aggregate: Dict<Address, Int>) -> Dict<
        Address,
        Int,
      > {
        if dict.has_key(aggregate, datum.borrower) {
          dict.insert_with(
            aggregate,
            key: datum.borrower,
            value: datum.borrowed_amount,
            with: fn(_key, value1, value2) { Some(value1 + value2) },
            compare: compare_address,
          )
        } else {
          dict.insert(
            aggregate,
            key: datum.borrower,
            value: datum.borrowed_amount,
            compare: compare_address,
          )
        }
      },
    )

  list.all(dict.to_list(aggregated_payments), paid_to_address(_, outputs))
}

fn compare_address(address1: Address, address2: Address) -> Ordering {
  expect VerificationKeyCredential(cred1) = address1.payment_credential
  expect VerificationKeyCredential(cred2) = address2.payment_credential
  bytearray.compare(cred1, cred2)
}

fn paid_to_address(payment_data: (Address, Int), outputs: List<Output>) -> Bool {
  let (address, amount) = payment_data
  list.any(outputs, fn(output) { and {
        output.address == address,
        lovelace_of(output.value) >= amount,
      } })
}

fn filter_inputs_by_address(
  inputs: List<Input>,
  address: Address,
) -> List<Input> {
  list.filter(inputs, fn(input) { address == input.output.address })
}

fn unique_input_ids(script_inputs: List<Input>) -> Bool {
  let input_ids =
    list.map(extract_datums(script_inputs), fn(datum) { datum.unique_id })
  list.length(script_inputs) == list.length(list.unique(input_ids))
}
