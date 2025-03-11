import {
  C,
  Credential as LucidCredential,
  Data,
  getAddressDetails,
  Lucid,
  networkToId,
} from "https://deno.land/x/lucid@0.10.11/mod.ts";

export const CredentialSchema = Data.Enum([
  Data.Object({ VerificationKeyCredential: Data.Tuple([Data.Bytes()]) }),
  Data.Object({ ScriptCredential: Data.Tuple([Data.Bytes()]) }),
]);

const PaymentCredentialSchema = CredentialSchema;
const StakeCredentialSchema = Data.Enum([
  Data.Object({ Inline: Data.Tuple([CredentialSchema]) }),
  Data.Object({
    Pointer: Data.Tuple([
      Data.Integer(),
      Data.Integer(),
      Data.Integer(),
    ]),
  }),
]);

export const AddressSchema = Data.Object({
  payment_credential: PaymentCredentialSchema,
  stake_credential: Data.Nullable(StakeCredentialSchema),
});

type Credential = Data.Static<typeof CredentialSchema>;
type Address = Data.Static<typeof AddressSchema>;

function getCredential(credential: LucidCredential): Credential {
  switch (credential.type) {
    case "Script":
      return {
        ScriptCredential: [credential.hash] as [string],
      };
    case "Key":
      return {
        VerificationKeyCredential: [credential.hash] as [string],
      };
  }
}

function getLucidCredential(credential: Credential): LucidCredential {
  if ("VerificationKeyCredential" in credential) {
    return {
      type: "Key",
      hash: credential.VerificationKeyCredential[0],
    };
  }

  return {
    type: "Script",
    hash: credential.ScriptCredential[0],
  };
}

export function getAddressFromBech32(bech32Address: string): Address {
  const addressDetails = getAddressDetails(bech32Address);

  if (!addressDetails.paymentCredential) {
    throw Error("Invalid bech32 address' payment credential");
  }

  return {
    payment_credential: getCredential(
      addressDetails.paymentCredential,
    ),
    stake_credential: addressDetails.stakeCredential
      ? { Inline: [getCredential(addressDetails.stakeCredential)] }
      : null,
  };
}

export function getBech32FromAddress(lucid: Lucid, address: Address): string {
  const paymentCredential = getLucidCredential(address.payment_credential);

  if (!address.stake_credential || ("Inline" in address.stake_credential)) {
    const stakeCredential = address.stake_credential
      ? getLucidCredential(address.stake_credential["Inline"][0])
      : undefined;
    return lucid.utils.credentialToAddress(paymentCredential, stakeCredential);
  }

  return C.PointerAddress.new(
    networkToId(lucid.network),
    paymentCredential.type === "Key"
      ? C.StakeCredential.from_keyhash(
        C.Ed25519KeyHash.from_hex(paymentCredential.hash),
      )
      : C.StakeCredential.from_scripthash(
        C.ScriptHash.from_hex(paymentCredential.hash),
      ),
    C.Pointer.new(
      C.BigNum.from_str(address.stake_credential.Pointer[0].toString()),
      C.BigNum.from_str(address.stake_credential.Pointer[1].toString()),
      C.BigNum.from_str(address.stake_credential.Pointer[2].toString()),
    ),
  )
    .to_address()
    .to_bech32(undefined);
}
