/**
 * TimeSyncDialog - Модальное окно синхронизации времени устройства
 *
 * Отображает процесс синхронизации и результат операции.
 * Вызывается из AssetDetails при обнаружении рассинхронизации времени.
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import { hikvisionApi, TimeSyncResponse } from '@/api/hikvision';
import { keyframes } from '@mui/system';

// Анимация вращения для иконки синхронизации
const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

export interface TimeSyncDialogProps {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  deviceLabel?: string;
  driftSeconds?: number;
  onSyncSuccess?: () => void; // Колбэк при успешной синхронизации
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export const TimeSyncDialog: React.FC<TimeSyncDialogProps> = ({
  open,
  onClose,
  deviceId,
  deviceLabel,
  driftSeconds,
  onSyncSuccess,
}) => {
  const { t } = useTranslation();

  // Состояние синхронизации
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [result, setResult] = useState<TimeSyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Сбрасываем состояние при открытии диалога
  useEffect(() => {
    if (open) {
      setStatus('idle');
      setResult(null);
      setError(null);
    }
  }, [open]);

  // Автоматически начинаем синхронизацию при открытии
  useEffect(() => {
    if (open && status === 'idle') {
      handleSync();
    }
  }, [open]);

  // Обработчик синхронизации
  const handleSync = async () => {
    setStatus('syncing');
    setError(null);

    try {
      const syncResult = await hikvisionApi.syncTime(deviceId);

      if (syncResult.success) {
        setStatus('success');
        setResult(syncResult);
        // Вызываем колбэк успеха
        onSyncSuccess?.();
      } else {
        setStatus('error');
        setError(syncResult.message || t('probe.timeSyncFailed'));
      }
    } catch (err: any) {
      console.error('[TimeSyncDialog] Ошибка синхронизации:', err);
      setStatus('error');
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        t('probe.timeSyncFailed')
      );
    }
  };

  // Обработчик закрытия
  const handleClose = () => {
    // Закрываем только если не в процессе синхронизации
    if (status !== 'syncing') {
      onClose();
    }
  };

  // Повторная попытка синхронизации
  const handleRetry = () => {
    handleSync();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccessTimeIcon color="primary" />
        <Typography variant="h6" component="span">
          {t('probe.timeSync')}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Название устройства */}
        {deviceLabel && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {deviceLabel}
          </Typography>
        )}

        {/* Состояние: Синхронизация */}
        {status === 'syncing' && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <SyncIcon
              sx={{
                fontSize: 48,
                color: 'primary.main',
                animation: `${spin} 1s linear infinite`,
                mb: 2,
              }}
            />
            <Typography variant="body1" fontWeight={500}>
              {t('probe.timeSyncing')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {driftSeconds != null && (
                <>
                  {t('probe.timeDriftDesc', { seconds: Math.abs(driftSeconds) })}
                </>
              )}
            </Typography>
            <CircularProgress size={24} sx={{ mt: 2 }} />
          </Box>
        )}

        {/* Состояние: Успех */}
        {status === 'success' && (
          <Alert
            severity="success"
            icon={<CheckCircleIcon />}
            sx={{ borderRadius: 2 }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              {t('probe.timeSynced')}
            </Typography>
            <Typography variant="body2">
              {t('probe.timeSyncedDesc')}
            </Typography>
            {result && result.drift_after != null && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('probe.timeDriftDesc', { seconds: Math.abs(result.drift_after) })}
              </Typography>
            )}
          </Alert>
        )}

        {/* Состояние: Ошибка */}
        {status === 'error' && (
          <Alert
            severity="error"
            icon={<ErrorIcon />}
            sx={{ borderRadius: 2 }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              {t('probe.timeSyncFailed')}
            </Typography>
            <Typography variant="body2">
              {error || t('probe.errorDesc')}
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/* Кнопка повторить - только при ошибке */}
        {status === 'error' && (
          <Button
            onClick={handleRetry}
            color="primary"
            startIcon={<SyncIcon />}
          >
            {t('probe.retry')}
          </Button>
        )}

        {/* Кнопка закрыть - всегда видна, кроме процесса синхронизации */}
        {status !== 'syncing' && (
          <Button onClick={handleClose} color="inherit">
            {t('app.close')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TimeSyncDialog;
