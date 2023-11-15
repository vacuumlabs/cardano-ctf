import {
  brightGreen,
  brightRed,
  brightYellow,
} from "https://deno.land/std@0.206.0/fmt/colors.ts";
import { Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";

import { isEmulator } from "./utils.ts";

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
