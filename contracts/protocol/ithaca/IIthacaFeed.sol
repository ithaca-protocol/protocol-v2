// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

interface IIthacaFeed {
    event ClientUpdated(uint64 backendId);

    struct ClientParams {
        address client;
        int256 maintenanceMargin;
        int256 mtm;
        uint256 collateral;
    }


    function getClient(
        address client
    ) external view returns (ClientParams memory)

}
