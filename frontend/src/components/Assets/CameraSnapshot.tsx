/**
 * Reusable camera snapshot dialog with auto-refresh.
 *
 * Supports two modes:
 * 1. NVR channel: pass nvrAssetId + channelNumber
 * 2. Standalone CAMERA asset: pass cameraAssetId
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { hikvisionApi } from '@/api/hikvision';
import { camerasApi } from '@/api/cameras';

interface CameraSnapshotProps {
  open: boolean;
  onClose: () => void;
  /** NVR mode: asset ID of the NVR */
  nvrAssetId?: string;
  /** NVR mode: channel number on the NVR */
  channelNumber?: number;
  /** Camera mode: asset ID of a standalone CAMERA asset */
  cameraAssetId?: string;
  /** Dialog title override */
  title?: string;
  /** Auto-refresh interval in seconds (0 = disabled, default 30) */
  autoRefreshSeconds?: number;
}

export const CameraSnapshot: React.FC<CameraSnapshotProps> = ({
  open,
  onClose,
  nvrAssetId,
  channelNumber,
  cameraAssetId,
  title,
  autoRefreshSeconds = 30,
}) => {
  const { t } = useTranslation();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(autoRefreshSeconds > 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [imageUrl]);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let blob: Blob;

      if (nvrAssetId && channelNumber !== undefined) {
        // NVR channel mode
        blob = await hikvisionApi.getSnapshot(nvrAssetId, channelNumber);
      } else if (cameraAssetId) {
        // Standalone camera mode
        blob = await camerasApi.getSnapshot(cameraAssetId);
      } else {
        throw new Error('No camera source specified');
      }

      // Revoke previous URL before creating new one
      setImageUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || err?.message || t('assets.snapshotError')
      );
    } finally {
      setLoading(false);
    }
  }, [nvrAssetId, channelNumber, cameraAssetId, t]);

  // Fetch on open
  useEffect(() => {
    if (open) {
      fetchSnapshot();
    }
    return () => {
      // Cleanup on close
      setImageUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [open, fetchSnapshot]);

  // Auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (open && autoRefresh && autoRefreshSeconds > 0) {
      intervalRef.current = setInterval(fetchSnapshot, autoRefreshSeconds * 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [open, autoRefresh, autoRefreshSeconds, fetchSnapshot]);

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const defaultTitle = channelNumber !== undefined
    ? t('assets.snapshotTitle', { channel: channelNumber })
    : t('assets.cameraSnapshot');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>{title || defaultTitle}</Box>
        <Tooltip title={t('assets.cameraSnapshotRefresh')}>
          <IconButton
            onClick={fetchSnapshot}
            disabled={loading}
            size="small"
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent sx={{ textAlign: 'center', minHeight: 200 }}>
        {loading && !imageUrl && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              {t('assets.snapshotLoading')}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        )}

        {imageUrl && (
          <Box sx={{ position: 'relative' }}>
            {loading && (
              <CircularProgress
                size={24}
                sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
              />
            )}
            <Box
              component="img"
              src={imageUrl}
              alt={title || defaultTitle}
              sx={{
                maxWidth: '100%',
                maxHeight: '70vh',
                borderRadius: 1,
                boxShadow: 1,
              }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        {autoRefreshSeconds > 0 && (
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                {t('assets.cameraSnapshotAutoRefresh', { seconds: autoRefreshSeconds })}
              </Typography>
            }
          />
        )}
        <Button onClick={handleClose}>{t('app.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CameraSnapshot;
