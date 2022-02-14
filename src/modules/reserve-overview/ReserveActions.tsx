import { InformationCircleIcon } from '@heroicons/react/outline';
import { Trans } from '@lingui/macro';
import { Box, Button, Paper, Stack, StackProps, SvgIcon, Typography } from '@mui/material';
import React from 'react';
import { FormattedNumber, FormattedNumberProps } from 'src/components/primitives/FormattedNumber';
import {
  ComputedReserveData,
  useAppDataContext,
} from 'src/hooks/app-data-provider/useAppDataProvider';
import { useWalletBalances } from 'src/hooks/app-data-provider/useWalletBalances';
import { useModalContext } from 'src/hooks/useModal';
import {
  assetCanBeBorrowedByUser,
  getMaxAmountAvailableToBorrow,
} from 'src/utils/getMaxAmountAvailableToBorrow';
import { getMaxAmountAvailableToSupply } from 'src/utils/getMaxAmountAvailableToSupply';

const ReserveRow: React.FC<StackProps> = (props) => (
  <Stack
    direction="row"
    justifyContent="space-between"
    alignItems="center"
    sx={{ mb: '24px' }}
    {...props}
  />
);

interface DoubleFormattedProps extends FormattedNumberProps {
  usdValue: string;
}

const DoubleFormatted: React.FC<DoubleFormattedProps> = ({ usdValue, ...props }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    }}
  >
    <FormattedNumber {...props} />
    <FormattedNumber color="text.muted" symbol="USD" variant="helperText" value={usdValue} />
  </Box>
);

interface ReserveActionsProps {
  underlyingAsset: string;
}

export const ReserveActions = ({ underlyingAsset }: ReserveActionsProps) => {
  const { openBorrow, openSupply } = useModalContext();
  const { user, reserves, loading: loadingReserves } = useAppDataContext();
  const { walletBalances, loading: loadingBalance } = useWalletBalances();
  // const balance = useWalletBalance(currentChainId, underlyingAsset);
  if (loadingReserves || loadingBalance) return null;
  const poolReserve = reserves.find(
    (reserve) => reserve.underlyingAsset === underlyingAsset
  ) as ComputedReserveData;
  const balance = walletBalances[underlyingAsset];
  const canBorrow = assetCanBeBorrowedByUser(poolReserve, user);
  const maxAmountToBorrow = getMaxAmountAvailableToBorrow(poolReserve, user).toString();
  const maxAmountToSupply = getMaxAmountAvailableToSupply(
    balance.amount,
    poolReserve,
    underlyingAsset
  ).toString();

  return (
    <Paper sx={{ py: '16px', px: '24px' }}>
      <Typography variant="h3" sx={{ mb: '40px' }}>
        <Trans>Your supplies</Trans>
      </Typography>

      <ReserveRow>
        <Typography>
          <Trans>Wallet balance</Trans>
        </Typography>
        <DoubleFormatted value={balance?.amount || 0} usdValue={balance?.amountUSD || '0'} />
      </ReserveRow>

      <ReserveRow>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography>
            <Trans>Available to supply</Trans>
          </Typography>
          <SvgIcon sx={{ fontSize: '18px', color: '#E0E5EA' }}>
            <InformationCircleIcon />
          </SvgIcon>
        </Stack>
        <FormattedNumber value={maxAmountToSupply} />
      </ReserveRow>
      <ReserveRow>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography>
            <Trans>Available to borrow</Trans>
          </Typography>
          <SvgIcon sx={{ fontSize: '18px', color: '#E0E5EA' }}>
            <InformationCircleIcon />
          </SvgIcon>
        </Stack>
        <FormattedNumber value={canBorrow ? maxAmountToBorrow : '0'} />
      </ReserveRow>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => openSupply(underlyingAsset)}>
          <Trans>Supply</Trans>
        </Button>
        <Button
          disabled={!canBorrow}
          variant="contained"
          onClick={() => openBorrow(underlyingAsset)}
        >
          <Trans>Borrow</Trans>
        </Button>
      </Stack>
    </Paper>
  );
};