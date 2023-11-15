import { Data } from "https://deno.land/x/lucid@0.10.7/mod.ts";

const HelloRedeemerSchema = Data.Object({
  msg: Data.Bytes(),
});

type HelloRedeemer = Data.Static<typeof HelloRedeemerSchema>;
export const HelloRedeemer = HelloRedeemerSchema as unknown as HelloRedeemer;
