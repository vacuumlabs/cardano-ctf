use aiken/transaction.{ScriptContext}

type Redeemer {
  msg: ByteArray,
}

validator {
  fn hello_world(
    _datum: Void,
    redeemer: Redeemer,
    _context: ScriptContext,
  ) -> Bool {
    let must_say_hello = redeemer.msg == "Hello CTF!"
    must_say_hello
  }
}
