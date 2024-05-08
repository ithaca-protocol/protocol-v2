// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IReserveInterestRateStrategy} from '../../interfaces/IReserveInterestRateStrategy.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingRateOracle} from '../../interfaces/ILendingRateOracle.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';

/**
 * @title CustomReserveInterestRateStrategy contract
 * @notice Implements the calculation of the interest rates depending on the reserve state
 * @dev The model of interest rate is based on a custom implementation
 * - An instance of this same contract, can't be used across different Aave markets, due to the caching
 *   of the LendingPoolAddressesProvider
 **/
contract CustomReserveInterestRateStrategy is IReserveInterestRateStrategy, Ownable {
  using WadRayMath for uint256;
  using SafeMath for uint256;
  using PercentageMath for uint256;

  ILendingPoolAddressesProvider public immutable addressesProvider;

  uint256 internal _slope;
  uint256 internal _reserveFactor;
  uint256 internal _withdrawalShockProbability;
  uint256 internal _intercept;
  address internal _governance;

  constructor(
    ILendingPoolAddressesProvider provider,
    uint256 withdrawalShockProbability,
    uint256 slope,
    uint256 intercept,
    uint256 reserveFactor,
    address governance
  ) public {
    addressesProvider = provider;
    _withdrawalShockProbability = withdrawalShockProbability;
    _slope = slope;
    _intercept = intercept;
    _reserveFactor = reserveFactor;
    _governance = governance;
  }

  modifier onlyGovernance() {
    require(msg.sender == _governance, 'NotGovernance');
    _;
  }

  function setGovernance(address governance) external onlyOwner {
    _governance = governance;
  }

  function slope() external view returns (uint256) {
    return _slope;
  }

  function intercept() external view returns (uint256) {
    return _intercept;
  }

  function reserveFactor() external view returns (uint256) {
    return _reserveFactor;
  }

  function setIntercept(uint256 intercept) external onlyGovernance {
    _intercept = intercept;
  }

  function setSlope(uint256 slope) external onlyGovernance {
    _slope = slope;
  }

  function setWithdrawalShockProbability(
    uint256 withdrawalShockProbability
  ) external onlyGovernance {
    _withdrawalShockProbability = withdrawalShockProbability;
  }

  function withdrawalShockProbability() external view returns (uint256) {
    return _withdrawalShockProbability;
  }

  function baseVariableBorrowRate() external view override returns (uint256) {}

  function getMaxVariableBorrowRate() external view override returns (uint256) {}

  /**
   * @dev Calculates the interest rates depending on the reserve's state and configurations
   * @param reserve The address of the reserve
   * @param liquidityAdded The liquidity added during the operation
   * @param liquidityTaken The liquidity taken during the operation
   * @param totalStableDebt The total borrowed from the reserve a stable rate
   * @param totalVariableDebt The total borrowed from the reserve at a variable rate
   * @param averageStableBorrowRate The weighted average of all the stable rate loans
   * @param reserveFactor The reserve portion of the interest that goes to the treasury of the market
   * @return The liquidity rate, the stable borrow rate and the variable borrow rate
   **/
  function calculateInterestRates(
    address reserve,
    address aToken,
    uint256 liquidityAdded,
    uint256 liquidityTaken,
    uint256 totalStableDebt,
    uint256 totalVariableDebt,
    uint256 averageStableBorrowRate,
    uint256 reserveFactor
  ) external view override returns (uint256, uint256, uint256) {
    uint256 availableLiquidity = IERC20(reserve).balanceOf(aToken);
    availableLiquidity = availableLiquidity.add(liquidityAdded).sub(liquidityTaken);

    return
      calculateInterestRates(
        reserve,
        availableLiquidity,
        totalStableDebt,
        totalVariableDebt,
        averageStableBorrowRate,
        reserveFactor
      );
  }

  struct CalcInterestRatesLocalVars {
    uint256 totalDebt;
    uint256 currentVariableBorrowRate;
    uint256 currentStableBorrowRate;
    uint256 currentLiquidityRate;
    uint256 utilizationRate;
  }

  /**
   * @dev Calculates the interest rates depending on the reserve's state and configurations.
   * NOTE This function is kept for compatibility with the previous DefaultInterestRateStrategy interface.
   * New protocol implementation uses the new calculateInterestRates() interface
   * @param reserve The address of the reserve
   * @param availableLiquidity The liquidity available in the corresponding aToken
   * @param totalStableDebt The total borrowed from the reserve a stable rate
   * @param totalVariableDebt The total borrowed from the reserve at a variable rate
   * @param averageStableBorrowRate The weighted average of all the stable rate loans
   * @param reserveFactor The reserve portion of the interest that goes to the treasury of the market
   * @return The liquidity rate, the stable borrow rate and the variable borrow rate
   **/
  function calculateInterestRates(
    address reserve,
    uint256 availableLiquidity,
    uint256 totalStableDebt,
    uint256 totalVariableDebt,
    uint256 averageStableBorrowRate,
    uint256 reserveFactor
  ) public view override returns (uint256, uint256, uint256) {
    CalcInterestRatesLocalVars memory vars;

    vars.totalDebt = totalStableDebt.add(totalVariableDebt);
    vars.currentVariableBorrowRate = 0;
    vars.currentStableBorrowRate = 0;
    vars.currentLiquidityRate = 0;

    vars.currentStableBorrowRate = ILendingRateOracle(addressesProvider.getLendingRateOracle())
      .getMarketBorrowRate(reserve);

    vars.utilizationRate = vars.totalDebt == 0
      ? 0
      : vars.totalDebt.rayDiv(availableLiquidity.add(vars.totalDebt));

    // a = intercept
    // m = slope
    // q = probability of withdrawal shock
    // η = reserve factor
    // U⋆(θ; ρ) = utilizationRate
    // E[ρ(θ)] = a + m · (1 + (η · q) / (1 - η)) · U⋆(θ; ρ)

    vars.currentVariableBorrowRate =
      _intercept +
      _slope
        .rayMul(
          WadRayMath.ray() +
            _reserveFactor.rayMul(_withdrawalShockProbability).rayDiv(
              WadRayMath.ray() - _reserveFactor
            )
        )
        .rayMul(vars.utilizationRate);

    // E[U(θ) · ρ(U(θ))] = U⋆(θ; ρ) · ((1 - q) · (a + m · U⋆(θ; ρ)) + q · (1 - η) · (a + m · (1 / (1 - η))))

    vars.currentLiquidityRate = vars.utilizationRate.rayMul(
      ((WadRayMath.ray() - _withdrawalShockProbability).rayMul(
        _intercept + _slope.rayMul(vars.utilizationRate)
      ) +
        _withdrawalShockProbability.rayMul(WadRayMath.ray() - _reserveFactor).rayMul(
          (_intercept + _slope.rayMul(WadRayMath.ray().rayDiv(WadRayMath.ray() - _reserveFactor)))
        ))
    );

    return (
      vars.currentLiquidityRate,
      vars.currentStableBorrowRate,
      vars.currentVariableBorrowRate
    );
  }
}
