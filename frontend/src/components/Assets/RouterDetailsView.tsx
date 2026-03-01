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
import PublicIcon from '@mui/icons-material/Public';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import WifiIcon from '@mui/icons-material/Wifi';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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

// ── Local presentational components (mirror AssetDetails.tsx) ──────────────

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

interface RouterDetailsViewProps {
  getProp: (key: string) => any;
  visibleSecrets: Set<string>;
  toggleSecretVisibility: (key: string) => void;
  handleCopy: (text: string) => void;
  configResult: RouterConfigResult;
}

export const RouterDetailsView: React.FC<RouterDetailsViewProps> = ({
  getProp,
  visibleSecrets,
  toggleSecretVisibility,
  handleCopy,
  configResult,
}) => {
  const { t } = useTranslation();
  const wanType = getProp('wan_connection_type');

  return (
    <Grid container spacing={1}>
      {/* ── Card 1: Internet Connection ──────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<PublicIcon sx={{ fontSize: 18 }} />}
              title={t('router.internetConnection')}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <CompactField
                label={t('router.provider')}
                value={getEnumLabel('provider_name', getProp('provider_name'), t)}
              />
              <CompactField
                label={t('router.wanType')}
                value={getEnumLabel('wan_connection_type', wanType, t)}
              />
            </Box>

            {/* Conditional PPPoE fields */}
            {wanType === 'PPPoE' && (
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600, color: 'primary.main' }}>
                  PPPoE
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <CompactField
                    label={t('assets.propGroup.pppoe')}
                    value={getProp('pppoe_username')}
                    monospace
                    copyable
                    onCopy={() => handleCopy(getProp('pppoe_username') || '')}
                  />
                  <SecretField
                    label={t('assets.devicePassword')}
                    value={getProp('pppoe_password')}
                    fieldKey="pppoe_password"
                    visibleSecrets={visibleSecrets}
                    toggleSecretVisibility={toggleSecretVisibility}
                    handleCopy={handleCopy}
                  />
                </Box>
              </Box>
            )}

            {/* Conditional L2TP fields */}
            {wanType === 'L2TP' && (
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600, color: 'primary.main' }}>
                  L2TP / VPN
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1 }}>
                  <CompactField
                    label="L2TP Server"
                    value={getProp('l2tp_server')}
                    monospace
                    copyable
                    onCopy={() => handleCopy(getProp('l2tp_server') || '')}
                  />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 0.5 }}>
                  <CompactField
                    label={t('assets.propGroup.l2tp')}
                    value={getProp('l2tp_username')}
                    monospace
                    copyable
                    onCopy={() => handleCopy(getProp('l2tp_username') || '')}
                  />
                  <SecretField
                    label={t('assets.devicePassword')}
                    value={getProp('l2tp_password')}
                    fieldKey="l2tp_password"
                    visibleSecrets={visibleSecrets}
                    toggleSecretVisibility={toggleSecretVisibility}
                    handleCopy={handleCopy}
                  />
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* ── Card 2: Router Access ────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<VpnKeyIcon sx={{ fontSize: 18 }} />}
              title={t('router.routerAccess')}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <CompactField
                label={t('assets.deviceUsername')}
                value={getProp('admin_username')}
                monospace
                copyable
                onCopy={() => handleCopy(getProp('admin_username') || '')}
              />
              <SecretField
                label={t('assets.devicePassword')}
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

      {/* ── Card 3: Wi-Fi ────────────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<WifiIcon sx={{ fontSize: 18 }} />}
              title={t('router.wifi')}
            />
            {getProp('wifi_name') || getProp('wifi_password') ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <CompactField
                  label="SSID"
                  value={getProp('wifi_name')}
                  monospace
                  copyable
                  onCopy={() => handleCopy(getProp('wifi_name') || '')}
                />
                <SecretField
                  label={t('assets.devicePassword')}
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

      {/* ── Card 4: Configuration Status ─────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <SectionHeader
              icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
              title={t('router.configStatus')}
            />
            <Box sx={{ mb: 1 }}>
              {configResult.checks.map(check => (
                <Box key={check.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
                  {check.filled ? (
                    <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  )}
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: check.filled ? 'text.primary' : 'text.secondary' }}>
                    {t(check.labelKey)}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              {t('router.fieldsConfigured', { filled: configResult.filledCount, total: configResult.totalCount })}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default RouterDetailsView;
