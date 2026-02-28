import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
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

interface SwitchDetailsViewProps {
  getProp: (key: string) => any;
  visibleSecrets: Set<string>;
  toggleSecretVisibility: (key: string) => void;
  handleCopy: (text: string) => void;
  configResult: RouterConfigResult;
}

export const SwitchDetailsView: React.FC<SwitchDetailsViewProps> = ({
  getProp,
  visibleSecrets,
  toggleSecretVisibility,
  handleCopy,
  configResult,
}) => {
  const { t } = useTranslation();
  const isManaged = getProp('switch_managed') === true || getProp('switch_managed') === 'true';
  const poeSupported = getProp('poe_supported') === true || getProp('poe_supported') === 'true';

  return (
    <Grid container spacing={1}>
      {/* ── Card 1: General ──────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<SettingsIcon sx={{ fontSize: 18 }} />}
              title={t('switch.general')}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <CompactField
                label={t('switch.brand')}
                value={getEnumLabel('switch_brand', getProp('switch_brand'), t)}
              />
              <CompactField
                label={t('switch.quantity')}
                value={getProp('switch_quantity')}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1, mt: 1 }}>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', lineHeight: 1.2, mb: 0.25, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}
                >
                  {t('switch.managed')}
                </Typography>
                <Chip
                  label={isManaged ? t('switch.managedYes') : t('switch.managedNo')}
                  color={isManaged ? 'primary' : 'default'}
                  size="small"
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Card 2: Ports ────────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<HubIcon sx={{ fontSize: 18 }} />}
              title={t('switch.ports')}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <CompactField
                label={t('switch.totalPorts')}
                value={getProp('total_ports')}
              />
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', lineHeight: 1.2, mb: 0.25, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}
                >
                  {t('switch.poeSupported')}
                </Typography>
                <Chip
                  label={poeSupported ? t('switch.poeYes') : t('switch.poeNo')}
                  color={poeSupported ? 'success' : 'default'}
                  size="small"
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
              </Box>
            </Box>
            {poeSupported && getProp('poe_ports_count') && (
              <Box sx={{ mt: 1 }}>
                <CompactField
                  label={t('switch.poePortsCount')}
                  value={getProp('poe_ports_count')}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* ── Card 3: Management Access (only if managed) ──────── */}
      {isManaged && (
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
              <SectionHeader
                icon={<VpnKeyIcon sx={{ fontSize: 18 }} />}
                title={t('switch.access')}
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <CompactField
                  label={t('switch.adminUsername')}
                  value={getProp('admin_username')}
                  monospace
                  copyable
                  onCopy={() => handleCopy(getProp('admin_username') || '')}
                />
                <SecretField
                  label={t('switch.adminPassword')}
                  value={getProp('admin_password')}
                  fieldKey="admin_password"
                  visibleSecrets={visibleSecrets}
                  toggleSecretVisibility={toggleSecretVisibility}
                  handleCopy={handleCopy}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* ── Card 4: Notes ────────────────────────────────────── */}
      {getProp('notes') && (
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
              <SectionHeader
                icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
                title={t('switch.notes')}
              />
              <Typography variant="body2" sx={{ fontSize: '0.9375rem', whiteSpace: 'pre-wrap' }}>
                {getProp('notes')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* ── Card 5: Configuration Status ─────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
              title={t('switch.configStatus')}
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
              {t('switch.fieldsConfigured', { filled: configResult.filledCount, total: configResult.totalCount })}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default SwitchDetailsView;
