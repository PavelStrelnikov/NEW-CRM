import React from 'react';
import { Box, Tooltip, styled } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import type { RouterConfigResult } from '@/utils/routerConfigStatus';
import { getRouterConfigColor } from '@/utils/routerConfigStatus';

// Dark tooltip matching HealthStatusIcon style
const StyledTooltip = styled(({ className, ...props }: any) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(() => ({
  '& .MuiTooltip-tooltip': {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    color: '#ffffff',
    fontSize: '0.8125rem',
    fontWeight: 400,
    padding: '10px 14px',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(8px)',
    maxWidth: 300,
    '& .MuiTooltip-arrow': {
      color: 'rgba(30, 30, 30, 0.95)',
    },
  },
}));

interface RouterConfigStatusIconProps {
  configResult: RouterConfigResult;
  size?: 'small' | 'medium' | 'large';
}

export const RouterConfigStatusIcon: React.FC<RouterConfigStatusIconProps> = ({
  configResult,
  size = 'medium',
}) => {
  const { t } = useTranslation();

  const iconSize = { small: 18, medium: 22, large: 28 }[size];
  const color = getRouterConfigColor(configResult.status);

  const bgColor = {
    configured: 'rgba(46, 125, 50, 0.08)',
    incomplete: 'rgba(237, 108, 2, 0.08)',
    no_data: 'rgba(117, 117, 117, 0.08)',
  }[configResult.status];

  const Icon = {
    configured: CheckCircleOutlineIcon,
    incomplete: WarningAmberIcon,
    no_data: SettingsIcon,
  }[configResult.status];

  const label = {
    configured: t('router.configured'),
    incomplete: t('router.incomplete'),
    no_data: t('router.noData'),
  }[configResult.status];

  const missingChecks = configResult.checks.filter(c => !c.filled);

  const tooltipContent = (
    <Box>
      <Box sx={{ fontWeight: 600, mb: missingChecks.length > 0 ? 0.5 : 0, color }}>
        {label}
      </Box>
      <Box sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.75rem', mb: missingChecks.length > 0 ? 0.5 : 0 }}>
        {t('router.fieldsConfigured', { filled: configResult.filledCount, total: configResult.totalCount })}
      </Box>
      {missingChecks.length > 0 && (
        <Box component="ul" sx={{ m: 0, pl: 2, listStyleType: 'disc' }}>
          {missingChecks.map(c => (
            <Box component="li" key={c.key} sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
              {t(c.labelKey)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  return (
    <StyledTooltip title={tooltipContent} arrow placement="right">
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: iconSize + 8,
          height: iconSize + 8,
          borderRadius: '50%',
          backgroundColor: bgColor,
        }}
      >
        <Icon sx={{ fontSize: iconSize, color }} />
      </Box>
    </StyledTooltip>
  );
};

export default RouterConfigStatusIcon;
