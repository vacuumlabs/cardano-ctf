//use aiken/cbor
use aiken/list
use aiken/transaction.{ScriptContext, Spend}
use aiken/transaction/credential.{Address}
use aiken/transaction/value.{lovelace_of}

type Datum {
  seller: Address,
  price: Int,
}

validator {
  fn buy(datum: Datum, _redeemer: Void, ctx: ScriptContext) -> Bool {
    expect Spend(_output_reference) = ctx.purpose
    expect Some(_seller_output) =
      list.find(
        ctx.transaction.outputs,
        fn(output) {
          // While debugging you can use this approach. Don't forget to import cbor library.
          // To display the traces validator needs to be compiled with an appropriate flag.
          // Check aiken build --help for more information.
          //
          // trace cbor.diagnostic(output.address)
          // trace cbor.diagnostic(datum.seller)
          // trace cbor.diagnostic(datum)
          // trace cbor.diagnostic(lovelace_of(output.value))
          // trace cbor.diagnostic(datum.price)

          (output.address == datum.seller)? && (lovelace_of(output.value) >= datum.price)?
        },
      )
    True
  }
}
