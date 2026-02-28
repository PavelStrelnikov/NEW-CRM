/**
 * LabelScanPreview - Dialog for reviewing and applying OCR scan results.
 *
 * Three states:
 * 1. Scanning: spinner + description
 * 2. Error: alert with retry button
 * 3. Result: editable field table with apply action
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Checkbox,
  Chip,
  Alert,
  CircularProgress,
  Collapse,
  InputAdornment,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import { LabelScanResult, OcrMappedField } from '@/types';

const CREDENTIAL_KEYS = new Set(['device_password', 'wifi_password']);

interface FieldState {
  checked: boolean;
  editedValue: string;
  showRaw: boolean;
}

interface LabelScanPreviewProps {
  open: boolean;
  onClose: () => void;
  scanResult: LabelScanResult | null;
  onApply: (mappedValues: {
    properties: Record<string, any>;
    basicFields: Record<string, string>;
  }) => void;
  isScanning: boolean;
  scanError: string | null;
  onRetry: () => void;
}

export function LabelScanPreview({
  open,
  onClose,
  scanResult,
  onApply,
  isScanning,
  scanError,
  onRetry,
}: LabelScanPreviewProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isHe = i18n.language === 'he';

  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const [showRawText, setShowRawText] = useState(false);

  // Initialize field states when scan result arrives
  useEffect(() => {
    if (!scanResult) return;

    const initial: Record<string, FieldState> = {};
    for (const field of scanResult.fields) {
      const hasMappingTarget = field.crm_property_key !== null || field.crm_basic_field !== null;
      const hasValue = field.value !== null && field.value !== '' && field.value !== '********';
      const hasRawValue = field.raw_value !== null && field.raw_value !== '';
      const isCredential = CREDENTIAL_KEYS.has(field.ocr_key);

      initial[field.ocr_key] = {
        checked: hasMappingTarget && (hasValue || (isCredential && hasRawValue)),
        editedValue: isCredential ? (field.raw_value || '') : (field.value || ''),
        showRaw: false,
      };
    }
    setFieldStates(initial);
  }, [scanResult]);

  const handleToggle = (key: string) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  };

  const handleValueChange = (key: string, value: string) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: { ...prev[key], editedValue: value },
    }));
  };

  const handleToggleShowRaw = (key: string) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: { ...prev[key], showRaw: !prev[key].showRaw },
    }));
  };

  const handleApply = () => {
    if (!scanResult) return;

    const properties: Record<string, any> = {};
    const basicFields: Record<string, string> = {};

    for (const field of scanResult.fields) {
      const state = fieldStates[field.ocr_key];
      if (!state?.checked || !state.editedValue) continue;

      if (field.crm_property_key) {
        properties[field.crm_property_key] = state.editedValue;
      }
      if (field.crm_basic_field) {
        basicFields[field.crm_basic_field] = state.editedValue;
      }
    }

    onApply({ properties, basicFields });
  };

  const extractedCount = useMemo(() => {
    if (!scanResult) return 0;
    return scanResult.fields.filter(f => f.value !== null).length;
  }, [scanResult]);

  const checkedCount = useMemo(() => {
    return Object.values(fieldStates).filter(s => s.checked).length;
  }, [fieldStates]);

  const getConfidenceChip = (confidence: number) => {
    if (confidence >= 0.8) {
      return (
        <Chip
          label={t('assets.ocr.high')}
          size="small"
          color="success"
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 20 }}
        />
      );
    }
    if (confidence >= 0.5) {
      return (
        <Chip
          label={t('assets.ocr.medium')}
          size="small"
          color="warning"
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 20 }}
        />
      );
    }
    return (
      <Chip
        label={t('assets.ocr.low')}
        size="small"
        color="error"
        variant="outlined"
        sx={{ fontSize: '0.7rem', height: 20 }}
      />
    );
  };

  const getFieldLabel = (field: OcrMappedField) => {
    return isHe ? field.label_he : field.label_en;
  };

  const getTargetLabel = (field: OcrMappedField) => {
    return field.crm_property_key || field.crm_basic_field || t('assets.ocr.noMapping');
  };

  // --- Render ---

  const renderScanning = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <CircularProgress size={48} sx={{ mb: 2 }} />
      <Typography variant="h6">{t('assets.ocr.scanning')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {t('assets.ocr.scanningDesc')}
      </Typography>
    </Box>
  );

  const renderError = () => (
    <Box sx={{ py: 2 }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="subtitle2">{t('assets.ocr.scanError')}</Typography>
        <Typography variant="body2">
          {scanError || t('assets.ocr.scanErrorDesc')}
        </Typography>
      </Alert>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
        >
          {t('assets.ocr.retry')}
        </Button>
      </Box>
    </Box>
  );

  const renderFieldRow = (field: OcrMappedField) => {
    const state = fieldStates[field.ocr_key];
    if (!state) return null;

    const isCredential = CREDENTIAL_KEYS.has(field.ocr_key);
    const hasNoValue = field.value === null;
    const hasMappingTarget = field.crm_property_key !== null || field.crm_basic_field !== null;

    if (hasNoValue) return null;

    return (
      <Box
        key={field.ocr_key}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          py: 1,
          px: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          opacity: state.checked ? 1 : 0.5,
          '&:last-child': { borderBottom: 'none' },
        }}
      >
        <Checkbox
          checked={state.checked}
          onChange={() => handleToggle(field.ocr_key)}
          size="small"
          disabled={!hasMappingTarget}
          sx={{ mt: 0.5 }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>
              {getFieldLabel(field)}
            </Typography>
            {getConfidenceChip(field.confidence)}
            {hasMappingTarget && (
              <Typography variant="caption" color="text.secondary">
                → {getTargetLabel(field)}
              </Typography>
            )}
          </Box>

          <TextField
            value={isCredential && !state.showRaw ? '••••••••' : state.editedValue}
            onChange={(e) => handleValueChange(field.ocr_key, e.target.value)}
            size="small"
            fullWidth
            disabled={isCredential && !state.showRaw}
            InputProps={{
              sx: { fontSize: '0.875rem' },
              endAdornment: isCredential ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => handleToggleShowRaw(field.ocr_key)}
                    edge="end"
                  >
                    {state.showRaw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />

          {field.alternatives.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Alternatives: {field.alternatives.join(', ')}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const renderResult = () => {
    if (!scanResult) return null;

    const hasFields = extractedCount > 0;

    return (
      <Box>
        {/* Warnings */}
        {scanResult.warnings.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {scanResult.warnings.map((w, i) => (
              <Alert key={i} severity="warning" sx={{ mb: 0.5 }}>
                {w}
              </Alert>
            ))}
          </Box>
        )}

        {/* Success header */}
        {hasFields ? (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            {t('assets.ocr.scanComplete')} — {extractedCount} {t('assets.ocr.confidence').toLowerCase()}: {Math.round(scanResult.ocr_confidence * 100)}%
            <Typography variant="caption" display="block" color="text.secondary">
              {t('assets.ocr.processingTime')}: {scanResult.processing_time_ms}ms
              {scanResult.rotation_applied !== 0 && ` • ${t('assets.ocr.rotation')}: ${scanResult.rotation_applied}°`}
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('assets.ocr.noFieldsFound')}
          </Alert>
        )}

        {/* Field list */}
        {hasFields && (
          <Box sx={{
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            mb: 2,
          }}>
            {scanResult.fields.map(renderFieldRow)}
          </Box>
        )}

        {/* Raw text toggle */}
        <Box>
          <Button
            size="small"
            onClick={() => setShowRawText(!showRawText)}
            startIcon={showRawText ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: 'none' }}
          >
            {showRawText ? t('assets.ocr.hideRawText') : t('assets.ocr.showRawText')}
          </Button>
          <Collapse in={showRawText}>
            <Box
              sx={{
                mt: 1,
                p: 1.5,
                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {scanResult.raw_text || '(empty)'}
            </Box>
          </Collapse>
        </Box>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={isScanning ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="span">
          {isScanning ? t('assets.ocr.scanning') : scanError ? t('assets.ocr.scanError') : t('assets.ocr.scanComplete')}
        </Typography>
        {!isScanning && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {isScanning && renderScanning()}
        {!isScanning && scanError && renderError()}
        {!isScanning && !scanError && scanResult && renderResult()}
      </DialogContent>

      {!isScanning && !scanError && scanResult && extractedCount > 0 && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={checkedCount === 0}
            startIcon={<CheckCircleIcon />}
          >
            {t('assets.ocr.apply')} ({checkedCount})
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
