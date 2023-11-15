# Cardano Vulnerabilities Game — Capture the Flag (CTF)

Welcome to the Cardano Capture the Flag (CTF) challenge by the
[Vacuumlabs Auditing](https://vacuumlabs.com/blockchain/smart-contract-auditing/)
team! It is a game where Cardano developers and enthusiasts can try to exploit
purposefully vulnerable smart contracts and learn about the most common security
issues and how to prevent them. In a way, you can try the job of auditors on
some common Cardano vulnerabilities. We believe this will provide the community
with educational materials needed to write more secure smart contracts.

Each task has its own folder. It consists of three main parts:

- The validators written in [Aiken](https://aiken-lang.org/). They are located
  in the `validators` folder. You can compile them by running `aiken build` in
  the root directory of the task.
- The off-chain code. We use the [Lucid](https://github.com/spacebudz/lucid)
  library and the [Blockfrost](https://blockfrost.io/) API to interact with the
  Preview testnet. The off-chain scripts contain:
  - Code deploying the smart contracts onto the Cardano Preview testnet.
  - Sample interaction with the deployed contract. This is the part you should
    modify and / or extend to exploit a vulnerability.
  - Tests that verify if you successfully exploited the vulnerability or not.
- A README file containing task-specific instructions.

The tasks are more or less of an increasing difficulty. The suggested path is to
go from a simple [hello_world](./00_hello_world/) task up. The tasks' README's
also explain more in the beginning, leaving more up to you in the more complex
levels.

## Setup

Before you start playing, there are few tools you have to setup:

1. Install
   [Deno](https://docs.deno.com/runtime/manual/getting_started/installation).
2. Install [Aiken](https://aiken-lang.org/installation-instructions).
3. Copy the template config file in `common/offchain/config_temp.ts` to
   `common/offchain/config.ts`.
   - Generate a private key and address. We prepared a private key generation
     code for you, you can run it by:

     ```
     deno run --allow-net --allow-write ./common/offchain/generate_private_key.ts
     ```

     Put your private key into the `PRIVATE_KEY` constant located in the
     `common/offchain/config.ts`.

     DO NOT REUSE A PRIVATE KEY THAT YOU USE FOR MAINNET! Generate a new one
     instead!
   - Get Blockfrost API key by registering at https://blockfrost.io/ . Put this
     API key into the `BLOCKFROST_API_KEY` constant in the
     `common/offchain/config.ts`.
4. Request tADA into your address (see the newly created `key.addr` file) from
   the [Cardano Faucet](https://docs.cardano.org/cardano-testnet/tools/faucet/).
   The environment we use is **Preview Testnet**.
5. You are good to go! To verify that everything is set up correctly, try
   solving the very first sample task: [Hello World](./00_hello_world/).

## Tasks

0. [hello_world](./00_hello_world/) — A sanity check to verify that everything's
   setup correctly.
1. [sell_nft](./01_sell_nft/) — Try to buy two NFTs by paying less than their
   stated prices!

## Troubleshooting

### Videos

There are videos in the [videos folder](./videos/). Check them out if you're
struggling. Beware, it can contain spoilers, especially the first video that
solves the hello_world task entirely.

### Errors during a transaction submission

Sometimes, Lucid errors out when it submits a transaction. This usually happens
when you wait for too short between two different transactions from your wallet.

In the meantime, if you encounter this error, you can try to change the default
value of `CONFIRMS_WAIT` in the [config](./common/offchain/config.ts) to a
higher number. This makes it wait for more confirmations before it follows up
with the next transaction, increasing the time and making the chance of such
errors smaller.

### Long waiting time

From our experience, the time required for a transaction validation are ever
changing on the preview testnet. If it takes too long, try to decrease the
default value of `CONFIRMS_WAIT` in the [config](./common/offchain/config.ts) to
a lower number. Be careful not to change it too low, otherwise you might get
errors during submissions.

## Feedback

Please, share your thoughts and feedback with us at audit@vacuumlabs.com.

## Warning & Disclaimer

The smart contract code in the examples is purposefully vulnerable. DO NOT copy
parts of the code into your project, as you may copy a vulnerability, too.

## License

Licensed under GPL-3.0. Full license text can be found [here](./LICENSE).
