import { Data } from "https://deno.land/x/lucid@0.10.11/mod.ts";

import {
  AddressSchema,
  getAddressFromBech32,
} from "../../common/offchain/types.ts";

const KingDatumSchema = Data.Object({
  current_king: AddressSchema,
  competition_closed: Data.Boolean(),
});

type KingDatum = Data.Static<typeof KingDatumSchema>;
export const KingDatum = KingDatumSchema as unknown as KingDatum;

export function createKingOfCardanoDatum(
  addressBech32: string,
  competitionClosed: boolean,
): string {
  const current_king = getAddressFromBech32(addressBech32);
  return Data.to(
    { current_king, competition_closed: competitionClosed },
    KingDatum,
  );
}

const KingRedeemerSchema = Data.Enum([
  Data.Literal("OverthrowKing"),
  Data.Literal("MintKingNFT"),
  Data.Literal("CloseCompetition"),
]);

type KingRedeemer = Data.Static<typeof KingRedeemerSchema>;
export const KingRedeemer = KingRedeemerSchema as unknown as KingRedeemer;

const KingNFTRedeemerSchema = Data.Bytes();

type KingNFTRedeemer = Data.Static<typeof KingNFTRedeemerSchema>;
export const KingNFTRedeemer =
  KingNFTRedeemerSchema as unknown as KingNFTRedeemer;
