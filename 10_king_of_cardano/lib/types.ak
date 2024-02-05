use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{Address, Script, VerificationKey}

pub type Datum {
  current_king: Address,
  competition_closed: Bool,
}

pub type Redeemer {
  OverthrowKing
  MintKingNFT
  CloseCompetition
}

pub type VerificationKeyHash =
  Hash<Blake2b_224, VerificationKey>

pub type ScriptHash =
  Hash<Blake2b_224, Script>
