import {
  brightGreen,
  brightRed,
  brightYellow,
} from "https://deno.land/std@0.206.0/fmt/colors.ts";
import {
  applyParamsToScript,
  Data,
  fromText,
  Lucid,
  Script,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";

import { getCurrentTime, isEmulator } from "./utils.ts";
import solutionRecordingBlueprint from "../solution_recording/plutus.json" assert {
  type: "json",
};

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

type SolutionRecordDatum = Data.Static<typeof SolutionRecordSchema>;
const SolutionRecordDatum =
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

export async function submitSolutionRecord(lucid: Lucid, problemId: bigint) {
  if (isEmulator(lucid)) return;

  const ownAddress = await lucid.wallet.address();
  const solutionRecord = solutionRecordingBlueprint.validators.find((v) =>
    v.title == "solution_record.record"
  );
  if (!solutionRecord) {
    throw new Error("Solution recording validator not found.");
  }
  const solutionRecordValidator: Script = {
    type: "PlutusV2",
    script: applyParamsToScript(solutionRecord.compiledCode, [
      fromText("CTF2: Solution Recording"),
    ]),
  };
  const solutionRecordAddress = lucid.utils.validatorToAddress(
    solutionRecordValidator,
  );

  const tx = await lucid
    .newTx()
    .payToContract(solutionRecordAddress, {
      inline: createSolutionRecordDatum(
        problemId,
        BigInt(getCurrentTime(lucid)),
        ownAddress,
      ),
    }, {})
    .complete();

  const signedTx = await tx.sign().complete();
  await signedTx.submit();

  console.log(`Submitting solution record on the testnet.`);
}
