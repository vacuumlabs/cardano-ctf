use aiken/transaction.{ScriptContext}

validator {
  fn always_fails(
    _datum: Void,
    _redeemer: Void,
    _context: ScriptContext,
  ) -> Bool {
    False
  }
}
