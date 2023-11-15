import {
  Data,
  getAddressDetails,
} from "https://deno.land/x/lucid@0.10.6/mod.ts";

export const CredentialSchema = Data.Enum([
  Data.Object({ VerificationKeyCredential: Data.Tuple([Data.Bytes()]) }),
  Data.Object({ ScriptCredential: Data.Tuple([Data.Bytes()]) }),
]);

export const PaymentCredentialSchema = CredentialSchema;

export const StakeCredentialSchema = Data.Enum([
  Data.Object({ Inline: CredentialSchema }),
  Data.Object({
    Pointer: Data.Object({
      Slot_number: Data.Integer(),
      Transaction_index: Data.Integer(),
      Certificate_index: Data.Integer(),
    }),
  }),
]);

export const AddressSchema = Data.Object({
  payment_credential: PaymentCredentialSchema,
  stake_credential: Data.Nullable(StakeCredentialSchema),
});

type Address = Data.Static<typeof AddressSchema>;
export const Address = AddressSchema as unknown as Address;

export function getAddressFromBech32(bech32Addr: string): Address | undefined {
  const addressDetails = getAddressDetails(bech32Addr);

  let payment_credential = undefined;
  if (addressDetails.paymentCredential?.type == "Script") {
    const paymentCredential: [string] = [addressDetails.paymentCredential.hash];
    payment_credential = {
      ScriptCredential: paymentCredential,
    };
  } else if (addressDetails.paymentCredential?.type == "Key") {
    const paymentCredential: [string] = [addressDetails.paymentCredential.hash];
    payment_credential = {
      VerificationKeyCredential: paymentCredential,
    };
  } else {
    return undefined;
  }

  // stake credentials are not set as they are not needed for the first tasks
  // they could be added later if needed

  return {
    payment_credential: payment_credential,
    stake_credential: null,
  };
}
