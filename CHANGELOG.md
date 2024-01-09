## Version 0.3 (Milestone 3) - [2024-01-19]

### Added

- We added **three more tasks**:
  - [purchase_offer](./05_purchase_offer/)
  - [tipjar_v2](./06_tipjar_v2/)
  - [multisig_treasury_v2](./07_multisig_treasury_v2/)
- We added **videos** for clear Milestone achievement purposes.

### Changed

- The code of setting the game up, running the interaction and testing whether
  the level is successfully completed is now abstracted into a `runTask`
  function located inside `common/offchain/utils.ts` and run from `run.ts`.
- The `player_template.ts` and the `player.ts` now contain only the interactions
  with an already set up environment.
- These changes are made for all levels. If you have a legacy `player.ts`,
  compare `player_template.ts` to it to find out what needs to be updated for it
  to work properly.

## Version 0.2 (Milestone 2) - [2023-12-15]

### Added

- We added the **Lucid emulator** as an alternative to running on the testnet.
  It speeds up playing the game significantly. No more waiting times for
  unsuccessful runs!
- We added **three more tasks**:
  - [vesting](./02_vesting/)
  - [multisig_treasury](./03_multisig_treasury/)
  - [tipjar](./04_tipjar/)
- We added **videos** for even clearer Milestone achievement purposes.

### Changed

- Tests run now first on the emulator. Only if they pass on the emulator, they
  are run on the testnet as well. The behavior can be changed in the config.
- The player now edits the file `player.ts` and starts the tests by running
  `run.ts`.
- These changes make the videos for Milestone 1 slightly imprecise, refer to the
  updated READMEs for precise instructions.

## Version 0.1 (Milestone 1) - [2023-11-15]

### Added

- We added the framework.
- **Two tasks**: [hello_world](./00_hello_world/) and
  [sell_nft](./01_sell_nft/).
- We included **videos** for the Milestone completion.
