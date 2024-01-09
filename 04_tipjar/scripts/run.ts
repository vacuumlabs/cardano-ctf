import { play } from "./player.ts";
import { setup, test } from "./task.ts";
import { runTask } from "../../common/offchain/utils.ts";

await runTask(setup, play, test);
