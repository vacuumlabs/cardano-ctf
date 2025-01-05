import { Data } from "https://deno.land/x/lucid@0.10.11/mod.ts";

import {
  AddressSchema,
  getAddressFromBech32,
} from "../../common/offchain/types.ts";

const SellNFTDatumSchema = Data.Object({
  seller: AddressSchema,
  price: Data.Integer(),
});

type SellNFTDatum = Data.Static<typeof SellNFTDatumSchema>;
export const SellNFTDatum = SellNFTDatumSchema as unknown as SellNFTDatum;

export function createSellNFTDatumSchema(
  addressBech32: string,
  price: bigint,
): string | undefined {
  const seller = getAddressFromBech32(addressBech32);
  if (seller === undefined) {
    return undefined;
  }
  const datum: SellNFTDatum = {
    seller: seller,
    price: price,
  };
  const retdat = Data.to(datum, SellNFTDatum);
  return retdat;
}
