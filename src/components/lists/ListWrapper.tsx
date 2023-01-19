import { Trans } from '@lingui/macro';
import { Box, Paper, Typography } from '@mui/material';
import { ReactNode, useState } from 'react';

import { toggleLocalStorageClick } from '../../helpers/toggle-local-storage-click';

interface ListWrapperProps {
  titleComponent: ReactNode;
  localStorageName?: string;
  subTitleComponent?: ReactNode;
  subChildrenComponent?: ReactNode;
  topInfo?: ReactNode;
  children: ReactNode;
  withTopMargin?: boolean;
  noData?: boolean;
}

export const ListWrapper = ({
  children,
  localStorageName,
  titleComponent,
  subTitleComponent,
  subChildrenComponent,
  topInfo,
  withTopMargin,
  noData,
}: ListWrapperProps) => {
  const [isCollapse, setIsCollapse] = useState(
    localStorageName ? localStorage.getItem(localStorageName) === 'true' : false
  );

  const collapsed = isCollapse && !noData;

  return (
    <Paper
      sx={(theme) => ({
        mt: withTopMargin ? 4 : 0,
        border: `1px solid ${theme.palette.divider}`,
        position: 'relative',
        '&:before': {
          content: "''",
          position: 'absolute',
          top: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.03)',
          borderRadius: '8px',
        },
      })}
    >
      <Box
        sx={{
          px: { xs: 4, xsm: 6 },
          py: { xs: 3.5, xsm: 4 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: { xs: 'flex-start', xsm: 'center' },
            py: '3.6px',
            flexDirection: { xs: 'column', xsm: 'row' },
          }}
        >
          {titleComponent}
          {subTitleComponent}
        </Box>

        {!!localStorageName && !noData && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              minHeight: '28px',
              zIndex: '1',
              pl: 3,
              span: {
                width: '14px',
                height: '2px',
                bgcolor: 'text.secondary',
                position: 'relative',
                ml: 1,
                '&:after': {
                  content: "''",
                  position: 'absolute',
                  width: '14px',
                  height: '2px',
                  bgcolor: 'text.secondary',
                  transition: 'all 0.2s ease',
                  transform: collapsed ? 'rotate(90deg)' : 'rotate(0)',
                  opacity: collapsed ? 1 : 0,
                },
              },
            }}
            onClick={() =>
              !!localStorageName && !noData
                ? toggleLocalStorageClick(isCollapse, setIsCollapse, localStorageName)
                : undefined
            }
          >
            <Typography variant="buttonM" color="text.secondary">
              {collapsed ? <Trans>Show</Trans> : <Trans>Hide</Trans>}
            </Typography>
            <span />
          </Box>
        )}
      </Box>

      {topInfo && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: { xs: 4, xsm: 6 },
            pb: { xs: collapsed && !noData ? 6 : 2, xsm: collapsed && !noData ? 6 : 0 },
            overflowX: 'auto',
          }}
        >
          {topInfo}
        </Box>
      )}
      {subChildrenComponent && !collapsed && (
        <Box sx={{ marginBottom: { xs: 2, xsm: 0 }, }}>{subChildrenComponent}</Box>
      )}
      <Box sx={{ display: collapsed ? 'none' : 'block', position: 'relative', }}>{children}</Box>
    </Paper>
  );
};
