import { Data, Lucid } from "https://deno.land/x/lucid@0.10.11/mod.ts";

const VestingSchema = Data.Object({
  lock_until: Data.Integer(),
  beneficiary: Data.Bytes(),
});

type VestingDatum = Data.Static<typeof VestingSchema>;
export const VestingDatum = VestingSchema as unknown as VestingDatum;

export function createVestingDatum(
  lucid: Lucid,
  lockUntil: bigint,
  beneficiary: string,
): string | undefined {
  let beneficiaryHash = lucid.utils.getAddressDetails(beneficiary)
    .paymentCredential?.hash;
  if (beneficiaryHash === undefined) {
    beneficiaryHash = "";
  }
  const datum: VestingDatum = {
    lock_until: lockUntil,
    beneficiary: beneficiaryHash,
  };
  return Data.to(datum, VestingDatum);
}
