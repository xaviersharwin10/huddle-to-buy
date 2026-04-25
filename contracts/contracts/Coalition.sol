// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice N-party atomic-commit coalition. Buyers fund; KeeperHub commits or refunds.
/// @dev Day 4 deliverable. Stub for now — state machine fleshed out when keeper wiring lands.
contract Coalition {
    enum State { Forming, Funded, Committed, Refunded }

    State public state;

    constructor() {
        state = State.Forming;
    }
}
