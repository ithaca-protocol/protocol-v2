# Configure Reserves 

for deployment and testing, current setup uses the configurations from `reservesConfigs.ts`, for aave, it is located in `markets/aave`.

specs - 

```
export const strategy<RESERVE>: IReserveParams = {
  strategy: <INTEREST_RATE_STRATEGY>,
  baseLTVAsCollateral: '10000' (percentage in 2 decimal precision, i.e - 9950=99.5%),
  liquidationThreshold: '10000' (100%),
  liquidationBonus: '10050' (100.5%),
  borrowingEnabled: true/false,
  stableBorrowRateEnabled: true/false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken (Atoken implementation address),
  reserveFactor: '1000',
};
```

## Reserve Indices
the order of registration of reserves is decided from AaveConfig `markets/aave/index.ts`

currently the first reserve is "ithaca reserve", hence the 0 index is reserved.

## Assets
assets can be configured in the same AaveConfig(`markets/aave/index.ts`), the ReserveAssets, key holds the addresses of all the assets.
