import {
  brightGreen,
  brightRed,
  brightYellow,
} from "https://deno.land/std@0.206.0/fmt/colors.ts";
import { Data, fromText, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";

import { getCurrentTime, isEmulator } from "./utils.ts";

export function passTest(s: string, l: Lucid) {
  if (isEmulator(l)) {
    console.log(brightYellow(s));
  } else {
    console.log(brightGreen(s));
  }
}

export function passAllTests(s: string, l: Lucid) {
  console.log("");
  if (isEmulator(l)) {
    console.log(
      brightYellow(
        "Congratulations! You seem to succesfully pass all the tests.",
      ),
    );
    console.log(
      brightYellow(
        "To fully finish this task, you have to finish it on testnet too.",
      ),
    );
    // TODO: check if it is not already configured
    console.log(
      brightYellow(
        "Please refer to the README to configure everything correctly.",
      ),
    );
  } else {
    console.log(brightGreen(s));
  }
}

export function failTest(s: string) {
  console.log(brightRed(s));
}

export function failTests() {
  console.log("Some tests did not pass, don't stop trying!");
}

const SolutionRecordSchema = Data.Object({
  problem_id: Data.Integer(),
  timestamp: Data.Integer(),
  solver_address: Data.Bytes(),
});

export type SolutionRecordDatum = Data.Static<typeof SolutionRecordSchema>;
export const SolutionRecordDatum =
  SolutionRecordSchema as unknown as SolutionRecordDatum;

function createSolutionRecordDatum(
  problem_id: bigint,
  timestamp: bigint,
  solver_address: string,
): string {
  const datum: SolutionRecordDatum = {
    problem_id,
    timestamp,
    solver_address: fromText(solver_address),
  };
  return Data.to(datum, SolutionRecordDatum);
}

export const SOLUTION_RECORD_ADDRESS =
  "addr_test1wqxdcgqqexv4mqfnaj2lp77824hcgz4fgsrkdhzwy2a20fq5zsp5u";

export async function submitSolutionRecord(lucid: Lucid, problemId: bigint) {
  if (isEmulator(lucid)) return;
  const ownAddress = await lucid.wallet.address();
  const tx = await lucid
    .newTx()
    .payToContract(SOLUTION_RECORD_ADDRESS, {
      inline: createSolutionRecordDatum(
        problemId,
        BigInt(getCurrentTime(lucid)),
        ownAddress,
      ),
    }, { lovelace: 2000000n })
    .complete();

  const signedTx = await tx.sign().complete();
  await signedTx.submit();

  console.log(`Submitting solution record on the testnet.`);
}
