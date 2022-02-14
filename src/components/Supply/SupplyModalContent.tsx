import React, { useEffect, useState } from 'react';
import {
  ComputedReserveData,
  useAppDataContext,
} from '../../hooks/app-data-provider/useAppDataProvider';
import { SupplyActions } from './SupplyActions';
import { Typography } from '@mui/material';
import { AssetInput } from '../AssetInput';
import {
  calculateHealthFactorFromBalancesBigUnits,
  ComputedUserReserve,
  USD_DECIMALS,
  valueToBigNumber,
} from '@aave/math-utils';
import BigNumber from 'bignumber.js';
import { useProtocolDataContext } from 'src/hooks/useProtocolDataContext';
import { getNetworkConfig, isFeatureEnabled } from 'src/utils/marketsAndNetworksConfig';
import { useWeb3Context } from 'src/libs/hooks/useWeb3Context';
import { TxErrorView } from '../FlowCommons/Error';
import { TxSuccessView } from '../FlowCommons/Success';
import { useWalletBalances } from 'src/hooks/app-data-provider/useWalletBalances';
import { ChangeNetworkWarning } from '../Warnings/ChangeNetworkWarning';
import { TxModalTitle } from '../FlowCommons/TxModalTitle';
import { SupplyCapWarning } from '../Warnings/SupplyCapWarning';
import { TxState } from 'src/helpers/types';
import { API_ETH_MOCK_ADDRESS } from '@aave/contract-helpers';
import { TxModalDetails } from '../FlowCommons/TxModalDetails';
import { GasEstimationError } from '../FlowCommons/GasEstimationError';
import { Trans } from '@lingui/macro';
import { AMPLWarning } from '../Warnings/AMPLWarning';
import { AAVEWarning } from '../Warnings/AAVEWarning';
import { SNXWarning } from '../Warnings/SNXWarning';
import { getMaxAmountAvailableToSupply } from 'src/utils/getMaxAmountAvailableToSupply';

export type SupplyProps = {
  underlyingAsset: string;
  handleClose: () => void;
};

export enum ErrorType {
  NOT_ENOUGH_BALANCE,
  CAP_REACHED,
}

export const SupplyModalContent = ({ underlyingAsset, handleClose }: SupplyProps) => {
  const { walletBalances } = useWalletBalances();
  const { marketReferencePriceInUsd, reserves, user } = useAppDataContext();
  const { currentChainId, currentMarketData } = useProtocolDataContext();
  const { chainId: connectedChainId } = useWeb3Context();

  // states
  const [supplyTxState, setSupplyTxState] = useState<TxState>({ success: false });
  const [amount, setAmount] = useState('');
  const [amountToSupply, setAmountToSupply] = useState(amount);
  const [gasLimit, setGasLimit] = useState<string | undefined>(undefined);
  const [blockingError, setBlockingError] = useState<ErrorType | undefined>();

  const supplyUnWrapped = underlyingAsset.toLowerCase() === API_ETH_MOCK_ADDRESS.toLowerCase();

  const networkConfig = getNetworkConfig(currentChainId);

  const poolReserve = reserves.find((reserve) => {
    if (supplyUnWrapped) {
      return reserve.symbol === networkConfig.wrappedBaseAssetSymbol;
    }
    return reserve.underlyingAsset === underlyingAsset;
  }) as ComputedReserveData;

  const userReserve = user.userReservesData.find((userReserve) => {
    if (supplyUnWrapped) {
      return poolReserve.underlyingAsset === userReserve.underlyingAsset;
    }
    return underlyingAsset === userReserve.underlyingAsset;
  }) as ComputedUserReserve;

  const walletBalance = walletBalances[underlyingAsset]?.amount;

  const supplyApy = poolReserve.supplyAPY;

  // Calculate max amount to supply
  const maxAmountToSupply = getMaxAmountAvailableToSupply(
    walletBalance,
    poolReserve,
    underlyingAsset
  );

  useEffect(() => {
    if (amount === '-1') {
      setAmountToSupply(maxAmountToSupply.toString());
    } else {
      setAmountToSupply(amount);
    }
  }, [amount, maxAmountToSupply]);

  // Calculation of future HF
  const amountIntEth = new BigNumber(amountToSupply).multipliedBy(
    poolReserve.formattedPriceInMarketReferenceCurrency
  );
  // TODO: is it correct to ut to -1 if user doesnt exist?
  const amountInUsd = amountIntEth.multipliedBy(marketReferencePriceInUsd).shiftedBy(-USD_DECIMALS);
  const totalCollateralMarketReferenceCurrencyAfter = user
    ? valueToBigNumber(user.totalCollateralMarketReferenceCurrency).plus(amountIntEth)
    : '-1';

  const liquidationThresholdAfter = user
    ? valueToBigNumber(user.totalCollateralMarketReferenceCurrency)
        .multipliedBy(user.currentLiquidationThreshold)
        .plus(amountIntEth.multipliedBy(poolReserve.formattedReserveLiquidationThreshold))
        .dividedBy(totalCollateralMarketReferenceCurrencyAfter)
    : '-1';

  let healthFactorAfterDeposit = user ? valueToBigNumber(user.healthFactor) : '-1';

  if (
    user &&
    ((!user.isInIsolationMode && !poolReserve.isIsolated) ||
      (user.isInIsolationMode &&
        user.isolatedReserve?.underlyingAsset === poolReserve.underlyingAsset))
  ) {
    healthFactorAfterDeposit = calculateHealthFactorFromBalancesBigUnits({
      collateralBalanceMarketReferenceCurrency: totalCollateralMarketReferenceCurrencyAfter,
      borrowBalanceMarketReferenceCurrency: valueToBigNumber(
        user.totalBorrowsMarketReferenceCurrency
      ),
      currentLiquidationThreshold: liquidationThresholdAfter,
    });
  }

  // ************** Warnings **********
  // supply cap warning
  const percentageOfCap = valueToBigNumber(poolReserve.totalLiquidity)
    .dividedBy(poolReserve.supplyCap)
    .toNumber();
  const showSupplyCapWarning: boolean =
    poolReserve.supplyCap !== '0' && percentageOfCap >= 0.99 && percentageOfCap < 1;

  // isolation warning
  const hasDifferentCollateral = user.userReservesData.find(
    (reserve) => reserve.usageAsCollateralEnabledOnUser && reserve.reserve.id !== poolReserve.id
  );
  const showIsolationWarning: boolean =
    !user.isInIsolationMode &&
    poolReserve.isIsolated &&
    !hasDifferentCollateral &&
    (userReserve?.underlyingBalance !== '0' ? userReserve?.usageAsCollateralEnabledOnUser : true);

  // TODO: check if calc is correct to see if cap reached
  const capReached =
    poolReserve.supplyCap !== '0' &&
    valueToBigNumber(amountToSupply).gt(
      new BigNumber(poolReserve.supplyCap).minus(poolReserve.totalLiquidity)
    );

  // error handler
  useEffect(() => {
    if (valueToBigNumber(amountToSupply).gt(walletBalance)) {
      setBlockingError(ErrorType.NOT_ENOUGH_BALANCE);
    } else if (capReached) {
      setBlockingError(ErrorType.CAP_REACHED);
    } else {
      setBlockingError(undefined);
    }
  }, [walletBalance, amountToSupply, capReached]);

  const handleBlocked = () => {
    switch (blockingError) {
      case ErrorType.NOT_ENOUGH_BALANCE:
        return <Trans>Not enough balance on your wallet</Trans>;
      case ErrorType.CAP_REACHED:
        return <Trans>Cap reached. Lower supply amount</Trans>;
      default:
        return null;
    }
  };

  const showHealthFactor =
    user &&
    user.totalBorrowsMarketReferenceCurrency !== '0' &&
    poolReserve.usageAsCollateralEnabled;

  // is Network mismatched
  const isWrongNetwork = currentChainId !== connectedChainId;

  return (
    <>
      {!supplyTxState.txError && !supplyTxState.success && (
        <>
          <TxModalTitle title="Supply" symbol={poolReserve.symbol} />
          {isWrongNetwork && (
            <ChangeNetworkWarning networkName={networkConfig.name} chainId={currentChainId} />
          )}
          {showIsolationWarning && (
            <Typography>You are about to enter into isolation. FAQ link</Typography>
          )}
          {showSupplyCapWarning && <SupplyCapWarning />}
          {poolReserve.symbol === 'AMPL' && <AMPLWarning />}
          {poolReserve.symbol === 'AAVE' && isFeatureEnabled.staking(currentMarketData) && (
            <AAVEWarning />
          )}
          {poolReserve.symbol === 'SNX' && !maxAmountToSupply.eq('0') && <SNXWarning />}
          <AssetInput
            value={amountToSupply}
            onChange={setAmount}
            usdValue={amountInUsd.toString()}
            symbol={supplyUnWrapped ? networkConfig.baseAssetSymbol : poolReserve.symbol}
            assets={[
              {
                balance: maxAmountToSupply.toString(),
                symbol: supplyUnWrapped ? networkConfig.baseAssetSymbol : poolReserve.symbol,
              },
            ]}
          />
          {blockingError !== undefined && (
            <Typography variant="helperText" color="red">
              {handleBlocked()}
            </Typography>
          )}
          <TxModalDetails
            sx={{ mt: '30px' }}
            apy={supplyApy}
            incentives={poolReserve.aIncentivesData}
            showHf={showHealthFactor || false}
            healthFactor={user ? user.healthFactor : '-1'}
            futureHealthFactor={healthFactorAfterDeposit.toString()}
            gasLimit={gasLimit}
            symbol={poolReserve.symbol}
            usedAsCollateral={userReserve.usageAsCollateralEnabledOnUser}
            action="Supply"
          />
        </>
      )}
      {supplyTxState.txError && <TxErrorView errorMessage={supplyTxState.txError} />}
      {supplyTxState.success && !supplyTxState.txError && (
        <TxSuccessView action="Supplied" amount={amountToSupply} symbol={poolReserve.symbol} />
      )}
      {supplyTxState.gasEstimationError && (
        <GasEstimationError error={supplyTxState.gasEstimationError} />
      )}
      <SupplyActions
        sx={{ mt: '48px' }}
        setSupplyTxState={setSupplyTxState}
        poolReserve={poolReserve}
        amountToSupply={amountToSupply}
        handleClose={handleClose}
        isWrongNetwork={isWrongNetwork}
        setGasLimit={setGasLimit}
        poolAddress={supplyUnWrapped ? underlyingAsset : poolReserve.underlyingAsset}
        symbol={supplyUnWrapped ? networkConfig.baseAssetSymbol : poolReserve.symbol}
        blocked={blockingError !== undefined}
      />
    </>
  );
};