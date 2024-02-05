import { Data } from "https://deno.land/x/lucid@0.10.7/mod.ts";

import {
  AddressSchema,
  getAddressFromBech32,
} from "../../common/offchain/types.ts";

const AssetClassSchema = Data.Object({
  policy_id: Data.Bytes(),
  asset_name: Data.Bytes(),
});

type AssetClass = Data.Static<typeof AssetClassSchema>;
export const AssetClass = AssetClassSchema as unknown as AssetClass;

const LendingDatumSchema = Data.Object({
  borrower: AddressSchema,
  lender: Data.Nullable(AddressSchema),
  borrowed_amount: Data.Integer(),
  interest: Data.Integer(),
  loan_duration: Data.Integer(),
  loan_end: Data.Nullable(Data.Integer()),
  collateral: AssetClassSchema,
  repaid: Data.Boolean(),
  unique_id: Data.Integer(),
});

type LendingDatum = Data.Static<typeof LendingDatumSchema>;
export const LendingDatum = LendingDatumSchema as unknown as LendingDatum;

export function createLendingDatum(
  borrowerBech32: string,
  lenderBech32: string | null,
  borrowed_amount: bigint,
  interest: bigint,
  loan_duration: bigint,
  loan_end: bigint | null,
  collateral_policy: string,
  collateral_name: string,
  repaid: boolean,
  unique_id: bigint,
): string {
  const borrower = getAddressFromBech32(borrowerBech32);
  const lender = lenderBech32 != null
    ? getAddressFromBech32(lenderBech32)
    : null;

  const collateral: AssetClass = {
    policy_id: collateral_policy,
    asset_name: collateral_name,
  };

  const datum: LendingDatum = {
    borrower,
    lender,
    borrowed_amount,
    interest,
    loan_duration,
    loan_end,
    collateral,
    repaid,
    unique_id,
  };

  return Data.to(datum, LendingDatum);
}

const LendingRedeemerSchema = Data.Enum([
  Data.Literal("Lend"),
  Data.Literal("Repay"),
  Data.Literal("ClaimRepayment"),
  Data.Literal("ClaimCollateral"),
]);

type LendingRedeemer = Data.Static<typeof LendingRedeemerSchema>;
export const LendingRedeemer =
  LendingRedeemerSchema as unknown as LendingRedeemer;
