import React from 'react';
import { Box, Tooltip, styled, keyframes } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTranslation } from 'react-i18next';
import type { HealthStatus } from '@/types';

// Subtle pulse animation for critical status
const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.85;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

// Styled wrapper for animated icons
const AnimatedIconWrapper = styled(Box)<{ status: HealthStatus }>(({ theme, status }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: status === 'critical' ? `${pulse} 2s ease-in-out infinite` : 'none',
}));

// Modern dark tooltip styling
const StyledTooltip = styled(({ className, ...props }: any) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
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

interface HealthStatusIconProps {
  status: HealthStatus;
  issues?: string[];
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
}

// Parse issue code to human-readable text
const parseIssueCode = (code: string, t: (key: string, options?: any) => string): string => {
  // HDD_1_SMART_FAIL -> "HDD 1: SMART Failure"
  if (code.startsWith('HDD_')) {
    const parts = code.split('_');
    const slot = parts[1];
    const issue = parts.slice(2).join('_');

    if (issue === 'SMART_FAIL') return t('health.hddSmartFail', { slot });
    if (issue === 'SMART_WARNING') return t('health.hddSmartWarning', { slot });
    if (issue === 'STATUS_ERROR') return t('health.hddStatusError', { slot });
  }

  // CAMERAS_OFFLINE_2 -> "2 Cameras Offline"
  if (code.startsWith('CAMERAS_OFFLINE_')) {
    const count = code.split('_')[2];
    return t('health.camerasOffline', { count });
  }

  // NO_RECORDING_24H_2 -> "No Recording on 2 Channels"
  if (code.startsWith('NO_RECORDING_24H_')) {
    const count = code.split('_')[3];
    return t('health.noRecording24h', { count });
  }

  // DEVICE_OFFLINE
  if (code === 'DEVICE_OFFLINE') return t('health.deviceOffline');

  // Fallback: return code as-is
  return code;
};

export const HealthStatusIcon: React.FC<HealthStatusIconProps> = ({
  status,
  issues = [],
  size = 'medium',
  showTooltip = true,
}) => {
  const { t } = useTranslation();

  // Icon sizes
  const iconSize = {
    small: 18,
    medium: 22,
    large: 28,
  }[size];

  // Icon and color based on status
  const getIconConfig = () => {
    switch (status) {
      case 'ok':
        return {
          Icon: CheckCircleOutlineIcon,
          color: '#2e7d32', // Green 800
          bgColor: 'rgba(46, 125, 50, 0.08)',
          label: t('health.statusOk'),
        };
      case 'warning':
        return {
          Icon: WarningAmberIcon,
          color: '#ed6c02', // Orange 700
          bgColor: 'rgba(237, 108, 2, 0.08)',
          label: t('health.statusWarning'),
        };
      case 'critical':
        return {
          Icon: ErrorOutlineIcon,
          color: '#d32f2f', // Red 700
          bgColor: 'rgba(211, 47, 47, 0.08)',
          label: t('health.statusCritical'),
        };
      case 'unknown':
      default:
        return {
          Icon: HelpOutlineIcon,
          color: '#757575', // Grey 600
          bgColor: 'rgba(117, 117, 117, 0.08)',
          label: t('health.statusUnknown'),
        };
    }
  };

  const { Icon, color, bgColor, label } = getIconConfig();

  // Build tooltip content
  const renderTooltipContent = () => {
    const safeIssues = issues || [];
    const parsedIssues = safeIssues.map((issue) => parseIssueCode(issue, t));

    return (
      <Box>
        <Box sx={{ fontWeight: 600, mb: parsedIssues.length > 0 ? 1 : 0, color }}>
          {label}
        </Box>
        {parsedIssues.length > 0 && (
          <Box component="ul" sx={{ m: 0, pl: 2, listStyleType: 'disc' }}>
            {parsedIssues.map((issue, index) => (
              <Box component="li" key={index} sx={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                {issue}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const iconElement = (
    <AnimatedIconWrapper
      status={status}
      sx={{
        width: iconSize + 8,
        height: iconSize + 8,
        borderRadius: '50%',
        backgroundColor: bgColor,
      }}
    >
      <Icon
        sx={{
          fontSize: iconSize,
          color,
        }}
      />
    </AnimatedIconWrapper>
  );

  if (!showTooltip) {
    return iconElement;
  }

  return (
    <StyledTooltip
      title={renderTooltipContent()}
      arrow
      placement="right"
    >
      {iconElement}
    </StyledTooltip>
  );
};

export default HealthStatusIcon;
