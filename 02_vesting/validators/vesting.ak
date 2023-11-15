use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite}
use aiken/list
use aiken/transaction.{ScriptContext, Spend, Transaction, ValidityRange}
use aiken/transaction/credential.{VerificationKey}

type Datum {
  lock_until: POSIXTime,
  beneficiary: VerificationKeyHash,
}

type VerificationKeyHash =
  Hash<Blake2b_224, VerificationKey>

type POSIXTime =
  Int

validator {
  fn vesting(datum: Datum, _redeemer: Void, ctx: ScriptContext) {
    let ScriptContext { transaction, purpose } = ctx
    let Transaction { extra_signatories, validity_range, .. } = transaction

    when purpose is {
      Spend(_) -> and {
          signed_by(extra_signatories, datum.beneficiary)?,
          time_elapsed(validity_range, datum.lock_until)?,
        }
      _ -> False
    }
  }
}

fn signed_by(
  tx_signatures: List<VerificationKeyHash>,
  beneficiary: VerificationKeyHash,
) {
  list.has(tx_signatures, beneficiary)?
}

fn time_elapsed(range: ValidityRange, vesting_lock_time: POSIXTime) {
  when range.upper_bound.bound_type is {
    Finite(current_time) -> (vesting_lock_time <= current_time)?
    _ -> False
  }
}
