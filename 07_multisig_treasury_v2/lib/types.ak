use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{Address, Script, VerificationKey}

pub type VerificationKeyHash =
  Hash<Blake2b_224, VerificationKey>

pub type ScriptHash =
  Hash<Blake2b_224, Script>

pub type TreasuryDatum {
  value: Int,
  multisig_hash: ScriptHash,
  owners: List<VerificationKeyHash>,
}

pub type MultisigDatum {
  release_value: Int,
  beneficiary: Address,
  required_signers: List<VerificationKeyHash>,
  signed_users: List<VerificationKeyHash>,
}

pub type MultisigRedeemer {
  Use
  Sign
}
