use aiken/transaction.{ScriptContext}

type POSIXTime =
  Int

type Datum {
  problem_id: Int,
  timestamp: POSIXTime,
  solver_address: String,
}

// Simply to get a unique address
validator(_name: String) {
  fn record(_datum: Datum, _redeemer: Void, _ctx: ScriptContext) -> Bool {
    False
  }
}
