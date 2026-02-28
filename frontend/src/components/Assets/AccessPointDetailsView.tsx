import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useTranslation } from 'react-i18next';
import type { RouterConfigResult } from '@/utils/routerConfigStatus';
import { ENUM_OPTIONS } from '@/constants/propertyFormConfig';

// Readable monospace font stack
const MONO_FONT = '"SF Mono", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace';

// ── Local presentational components ──────────────────────────────────────────

const CompactField: React.FC<{
  label: string;
  value: React.ReactNode;
  monospace?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
}> = ({ label, value, monospace, copyable, onCopy }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block', lineHeight: 1.2, mb: 0.25, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}
    >
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
      <Typography
        variant="body2"
        dir={monospace ? 'ltr' : undefined}
        sx={{
          fontFamily: monospace ? MONO_FONT : 'inherit',
          fontWeight: 500,
          fontSize: '0.9375rem',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: monospace ? 'left' : undefined,
        }}
      >
        {value || '—'}
      </Typography>
      {copyable && value && onCopy && (
        <Tooltip title="Copy">
          <IconButton size="small" onClick={onCopy} sx={{ p: 0.25, ml: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  </Box>
);

const SecretField: React.FC<{
  label: string;
  value: string | null | undefined;
  fieldKey: string;
  visibleSecrets: Set<string>;
  toggleSecretVisibility: (key: string) => void;
  handleCopy: (text: string) => void;
}> = ({ label, value, fieldKey, visibleSecrets, toggleSecretVisibility, handleCopy }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block', lineHeight: 1.2, mb: 0.25, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}
    >
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Typography
        variant="body2"
        dir="ltr"
        sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: '0.9375rem', textAlign: 'left' }}
      >
        {value ? (visibleSecrets.has(fieldKey) ? value : '••••••••') : '—'}
      </Typography>
      {value && (
        <>
          <IconButton size="small" onClick={() => toggleSecretVisibility(fieldKey)} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
            {visibleSecrets.has(fieldKey) ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
          </IconButton>
          <IconButton size="small" onClick={() => handleCopy(value)} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </>
      )}
    </Box>
  </Box>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  color?: string;
}> = ({ icon, title, color = 'primary.main' }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    mb: 1,
    pb: 0.75,
    borderBottom: '1px solid',
    borderColor: 'divider',
  }}>
    <Box sx={{ color, display: 'flex', alignItems: 'center' }}>
      {icon}
    </Box>
    <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
      {title}
    </Typography>
  </Box>
);

// ── Helper: resolve enum label ─────────────────────────────────────────────

function getEnumLabel(key: string, value: any, t: (k: string) => string): string {
  if (!value) return '—';
  const options = ENUM_OPTIONS[key];
  if (!options) return String(value);
  const opt = options.find(o => o.value === value);
  return opt ? t(opt.labelKey) : String(value);
}

// ── Main component ─────────────────────────────────────────────────────────

interface AccessPointDetailsViewProps {
  getProp: (key: string) => any;
  visibleSecrets: Set<string>;
  toggleSecretVisibility: (key: string) => void;
  handleCopy: (text: string) => void;
  configResult: RouterConfigResult;
}

export const AccessPointDetailsView: React.FC<AccessPointDetailsViewProps> = ({
  getProp,
  visibleSecrets,
  toggleSecretVisibility,
  handleCopy,
  configResult,
}) => {
  const { t } = useTranslation();

  return (
    <Grid container spacing={1}>
      {/* ── Card 1: General ──────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<SettingsIcon sx={{ fontSize: 18 }} />}
              title={t('accessPoint.general')}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <CompactField
                label={t('accessPoint.brand')}
                value={getEnumLabel('ap_brand', getProp('ap_brand'), t)}
              />
              <CompactField
                label={t('accessPoint.quantity')}
                value={getProp('ap_quantity')}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Card 2: Wi-Fi ────────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<WifiIcon sx={{ fontSize: 18 }} />}
              title={t('accessPoint.wifi')}
            />
            {getProp('wifi_ssid') || getProp('wifi_password') ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <CompactField
                  label={t('accessPoint.ssid')}
                  value={getProp('wifi_ssid')}
                  monospace
                  copyable
                  onCopy={() => handleCopy(getProp('wifi_ssid') || '')}
                />
                <SecretField
                  label={t('accessPoint.password')}
                  value={getProp('wifi_password')}
                  fieldKey="wifi_password"
                  visibleSecrets={visibleSecrets}
                  toggleSecretVisibility={toggleSecretVisibility}
                  handleCopy={handleCopy}
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {t('router.wifiNotProvided')}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* ── Card 3: Notes ────────────────────────────────────── */}
      {getProp('notes') && (
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
              <SectionHeader
                icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
                title={t('accessPoint.notes')}
              />
              <Typography variant="body2" sx={{ fontSize: '0.9375rem', whiteSpace: 'pre-wrap' }}>
                {getProp('notes')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* ── Card 4: Configuration Status ─────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
              title={t('accessPoint.configStatus')}
            />
            <Box sx={{ mb: 1 }}>
              {configResult.checks.map(check => (
                <Box key={check.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
                  {check.filled ? (
                    <CheckCircleIcon sx={{ fontSize: 16, color: '#2e7d32' }} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#bdbdbd' }} />
                  )}
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: check.filled ? 'text.primary' : 'text.secondary' }}>
                    {t(check.labelKey)}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              {t('accessPoint.fieldsConfigured', { filled: configResult.filledCount, total: configResult.totalCount })}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default AccessPointDetailsView;
