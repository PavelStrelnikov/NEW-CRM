/**
 * SmartProbeLoader - Visual diagnostic modal for device probing
 *
 * Displays a tech-aesthetic progress visualization with:
 * - Real-time step progression
 * - Animated icons and progress bar
 * - RTL support for Hebrew
 * - Error handling with retry capability
 *
 * Supports two modes:
 * - Probe Mode: For existing devices (uses deviceId)
 * - Validation Mode: For new devices (uses formPayload)
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  IconButton,
  Alert,
  Fade,
  useTheme,
  alpha,
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import InfoIcon from '@mui/icons-material/Info';
import StorageIcon from '@mui/icons-material/Storage';
import VideocamIcon from '@mui/icons-material/Videocam';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { keyframes } from '@mui/system';
import { HikvisionProbeResponse } from '@/types';

// Animation keyframes
const pulse = keyframes`
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 5px currentColor; }
  50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
  100% { box-shadow: 0 0 5px currentColor; }
`;

// Probe step configuration
export interface ProbeStep {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  duration: number; // Estimated duration in ms
}

const PROBE_STEPS: ProbeStep[] = [
  {
    id: 'connect',
    labelKey: 'probe.steps.connect',
    descriptionKey: 'probe.steps.connectDesc',
    icon: WifiIcon,
    duration: 2000,
  },
  {
    id: 'auth',
    labelKey: 'probe.steps.auth',
    descriptionKey: 'probe.steps.authDesc',
    icon: VpnKeyIcon,
    duration: 1500,
  },
  {
    id: 'system',
    labelKey: 'probe.steps.system',
    descriptionKey: 'probe.steps.systemDesc',
    icon: InfoIcon,
    duration: 2000,
  },
  {
    id: 'storage',
    labelKey: 'probe.steps.storage',
    descriptionKey: 'probe.steps.storageDesc',
    icon: StorageIcon,
    duration: 3000,
  },
  {
    id: 'channels',
    labelKey: 'probe.steps.channels',
    descriptionKey: 'probe.steps.channelsDesc',
    icon: VideocamIcon,
    duration: 2500,
  },
  {
    id: 'time',
    labelKey: 'probe.steps.time',
    descriptionKey: 'probe.steps.timeDesc',
    icon: AccessTimeIcon,
    duration: 1000,
  },
];

// Определение типа ошибки на основе сообщения/статуса
export type ProbeErrorType = 'network' | 'auth' | 'timeout' | 'unknown';

export function detectErrorType(error: Error | null | undefined): ProbeErrorType {
  if (!error) return 'unknown';

  // Defensive: ensure we always have a string, even for malformed errors
  let rawMessage: unknown;
  try {
    rawMessage = (error as any)?.response?.data?.detail
      ?? (error as Error)?.message
      ?? '';
  } catch {
    rawMessage = '';
  }

  const errorMessage = String(rawMessage ?? '').toLowerCase();

  // Safely extract status code
  let statusCode: number | undefined;
  try {
    statusCode = (error as any)?.response?.status;
  } catch {
    statusCode = undefined;
  }

  // Проверка на ошибки авторизации
  if (statusCode === 401 || statusCode === 403 ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('credentials') ||
      errorMessage.includes('password') ||
      errorMessage.includes('login') ||
      errorMessage.includes('invalid user') ||
      errorMessage.includes('auth failed') ||
      errorMessage.includes('access denied')) {
    return 'auth';
  }

  // Проверка на ошибки сети/подключения
  if (statusCode === 502 || statusCode === 503 || statusCode === 504 ||
      errorMessage.includes('connect') ||
      errorMessage.includes('network') ||
      errorMessage.includes('unreachable') ||
      errorMessage.includes('refused') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('ehostunreach') ||
      errorMessage.includes('enetunreach') ||
      errorMessage.includes('host not found') ||
      errorMessage.includes('no route') ||
      errorMessage.includes('connection failed') ||
      errorMessage.includes('destination unreachable')) {
    return 'network';
  }

  // Проверка на таймаут
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorMessage.includes('deadline exceeded')) {
    return 'timeout';
  }

  return 'unknown';
}

// Get which step failed based on error type
export function getFailedStep(errorType: ProbeErrorType): number {
  switch (errorType) {
    case 'network':
    case 'timeout':
      return 0; // Connectivity step
    case 'auth':
      return 1; // Authentication step
    default:
      return 2; // System info step (generic failure)
  }
}

export interface SmartProbeLoaderProps {
  open: boolean;
  onClose: () => void;
  onRetry: () => void;
  onEditDetails?: () => void; // Для режима валидации - вернуться к форме
  isProbing: boolean;
  probeResult: HikvisionProbeResponse | null;
  probeError: Error | null;
  mode?: 'probe' | 'validate'; // По умолчанию 'probe'
  deviceLabel?: string; // Название устройства для отображения
}

export const SmartProbeLoader: React.FC<SmartProbeLoaderProps> = ({
  open,
  onClose,
  onRetry,
  onEditDetails,
  isProbing,
  probeResult,
  probeError,
  mode = 'probe',
  deviceLabel,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // Debug logging
  console.log('[SmartProbeLoader] Render:', {
    open,
    isProbing,
    hasProbeResult: !!probeResult,
    hasProbeError: !!probeError,
    probeErrorType: probeError ? typeof probeError : 'none',
    probeErrorMessage: probeError instanceof Error ? probeError.message : String(probeError || ''),
    mode,
  });

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Calculate total duration for progress
  const totalDuration = PROBE_STEPS.reduce((sum, step) => sum + step.duration, 0);

  // Reset state when dialog opens (regardless of isProbing state)
  // Critical for validation mode where dialog can open with error already set
  useEffect(() => {
    if (open) {
      // Сбрасываем визуальное состояние при открытии диалога
      setCurrentStep(0);
      setStepProgress(0);
      setOverallProgress(0);
      setCompletedSteps(new Set());
      setFailedStep(null);
      setShowSuccess(false);
    }
  }, [open]);

  // Проверка наличия значительного расхождения времени (> 60 секунд)
  const hasTimeDrift = probeResult?.meta?.time_drift_seconds != null
    && Math.abs(probeResult.meta.time_drift_seconds) > 60;

  // Simulate step progression while probing
  useEffect(() => {
    if (!isProbing || failedStep !== null) return;

    const step = PROBE_STEPS[currentStep];
    if (!step) return;

    // Calculate step duration (slightly randomized)
    const stepDuration = step.duration + (Math.random() - 0.5) * 500;
    const stepInterval = 50; // Update every 50ms
    const incrementPerTick = 100 / (stepDuration / stepInterval);

    const timer = setInterval(() => {
      setStepProgress((prev) => {
        const newProgress = Math.min(prev + incrementPerTick, 100);

        if (newProgress >= 100) {
          // Step complete - move to next
          clearInterval(timer);
          setCompletedSteps((prev) => new Set(prev).add(currentStep));

          if (currentStep < PROBE_STEPS.length - 1) {
            setCurrentStep((prev) => prev + 1);
            setStepProgress(0);
          }
        }

        return newProgress;
      });

      // Update overall progress
      const completedDuration = PROBE_STEPS.slice(0, currentStep).reduce(
        (sum, s) => sum + s.duration,
        0
      );
      const currentStepContribution = (stepProgress / 100) * step.duration;
      const overall = ((completedDuration + currentStepContribution) / totalDuration) * 100;
      setOverallProgress(Math.min(overall, 99)); // Cap at 99% until actual completion
    }, stepInterval);

    return () => clearInterval(timer);
  }, [isProbing, currentStep, stepProgress, totalDuration, failedStep]);

  // Handle probe completion or error
  useEffect(() => {
    try {
      if (!isProbing && probeResult && !probeError) {
        // Success - complete all steps and show success
        setCompletedSteps(new Set(PROBE_STEPS.map((_, i) => i)));
        setOverallProgress(100);
        setShowSuccess(true);

        // Auto-close after showing success (only in probe mode, not validation)
        if (mode === 'probe') {
          const timer = setTimeout(() => {
            onClose();
          }, 2000);
          return () => clearTimeout(timer);
        }
      } else if (!isProbing && probeError) {
        // Error - determine which step failed based on error type
        // Wrapped in try-catch for safety
        let errorType: ProbeErrorType = 'unknown';
        let failedStepIndex = 0;

        try {
          errorType = detectErrorType(probeError);
          failedStepIndex = getFailedStep(errorType);
        } catch (e) {
          // Fallback to unknown error at first step if detection fails
          console.error('[SmartProbeLoader] Error detecting error type:', e);
          errorType = 'unknown';
          failedStepIndex = 0;
        }

        // Complete steps before the failed one
        const completed = new Set<number>();
        for (let i = 0; i < failedStepIndex; i++) {
          completed.add(i);
        }
        setCompletedSteps(completed);
        setCurrentStep(failedStepIndex);
        setFailedStep(failedStepIndex);
      }
    } catch (e) {
      // Critical fallback: if anything fails, show error at first step
      console.error('[SmartProbeLoader] Critical error in useEffect:', e);
      setFailedStep(0);
      setCompletedSteps(new Set());
      setCurrentStep(0);
    }
  }, [isProbing, probeResult, probeError, mode, onClose]);

  // Получить локализованное сообщение об ошибке
  // КРИТИЧНО: Обёрнуто в try-catch т.к. вызывается при рендеринге JSX
  const getErrorMessage = (): string => {
    if (!probeError) return '';

    try {
      const errorType = detectErrorType(probeError);

      // Безопасное получение оригинального сообщения с fallback
      // Handle Pydantic validation errors (array of objects with {type, loc, msg, input})
      const detail = (probeError as any)?.response?.data?.detail;
      let originalError: string;

      if (Array.isArray(detail)) {
        // Pydantic validation error array
        originalError = detail.map((e: any) => e.msg || String(e)).join('; ');
      } else if (typeof detail === 'string') {
        originalError = detail;
      } else if (typeof detail === 'object' && detail !== null) {
        originalError = detail.msg || detail.message || JSON.stringify(detail);
      } else {
        originalError = (probeError as Error)?.message || String(probeError) || '';
      }

      switch (errorType) {
        case 'network':
          return t('probe.errors.network');
        case 'timeout':
          return t('probe.errors.timeout');
        case 'auth':
          return t('probe.errors.auth');
        default:
          return originalError || t('probe.errorDesc');
      }
    } catch (e) {
      console.error('[SmartProbeLoader] Error in getErrorMessage:', e);
      // Fallback: безопасно извлечь сообщение
      try {
        return (probeError as Error)?.message || t('probe.errorDesc');
      } catch {
        return t('probe.errorDesc');
      }
    }
  };

  // Render step icon with animation
  const renderStepIcon = (stepIndex: number, StepIcon: React.ElementType) => {
    const isActive = currentStep === stepIndex && isProbing && failedStep === null;
    const isCompleted = completedSteps.has(stepIndex);
    const isFailed = failedStep === stepIndex;

    const baseIconStyle = {
      fontSize: 28,
      transition: 'all 0.3s ease',
    };

    if (isFailed) {
      return (
        <Box
          sx={{
            color: 'error.main',
            animation: `${glow} 1s ease-in-out infinite`,
          }}
        >
          <ErrorIcon sx={baseIconStyle} />
        </Box>
      );
    }

    if (isCompleted) {
      return (
        <Fade in>
          <CheckCircleIcon
            sx={{
              ...baseIconStyle,
              color: 'success.main',
            }}
          />
        </Fade>
      );
    }

    if (isActive) {
      return (
        <Box
          sx={{
            color: 'primary.main',
            animation: `${pulse} 1.5s ease-in-out infinite`,
          }}
        >
          <StepIcon sx={baseIconStyle} />
        </Box>
      );
    }

    return (
      <StepIcon
        sx={{
          ...baseIconStyle,
          color: 'text.disabled',
        }}
      />
    );
  };

  // Tech aesthetic colors
  const techColors = {
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(135deg, #0a0e17 0%, #111720 50%, #161d28 100%)'
      : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)',
    cardBg: theme.palette.mode === 'dark'
      ? alpha(theme.palette.background.paper, 0.9)
      : alpha(theme.palette.background.paper, 0.95),
    progressTrack: theme.palette.mode === 'dark'
      ? alpha(theme.palette.primary.main, 0.2)
      : alpha(theme.palette.primary.main, 0.15),
  };

  // Get title based on mode
  const getTitle = () => {
    if (mode === 'validate') {
      return t('probe.validateTitle');
    }
    return t('probe.title');
  };

  return (
    <Dialog
      open={open}
      onClose={!isProbing ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: techColors.background,
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: techColors.cardBg,
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isProbing && (
            <StorageIcon
              sx={{
                color: 'primary.main',
                animation: `${spin} 2s linear infinite`,
              }}
            />
          )}
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {getTitle()}
            </Typography>
            {deviceLabel && (
              <Typography variant="caption" color="text.secondary">
                {deviceLabel}
              </Typography>
            )}
          </Box>
        </Box>
        {!isProbing && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={{ bgcolor: techColors.cardBg, pt: 3 }}>
        {/* Overall Progress Bar */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('probe.progress')}
            </Typography>
            <Typography variant="body2" fontWeight={600} color="primary.main">
              {Math.round(overallProgress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: techColors.progressTrack,
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                transition: 'transform 0.2s ease',
              },
            }}
          />
        </Box>

        {/* Steps Stepper */}
        <Stepper
          activeStep={currentStep}
          orientation="vertical"
          sx={{
            '& .MuiStepConnector-line': {
              borderColor: 'divider',
              borderWidth: 2,
              minHeight: 24,
            },
            '& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
              borderColor: 'success.main',
            },
            '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line': {
              borderColor: 'primary.main',
            },
          }}
        >
          {PROBE_STEPS.map((step, index) => {
            const isActive = currentStep === index && isProbing && failedStep === null;
            const isCompleted = completedSteps.has(index);
            const isFailed = failedStep === index;

            return (
              <Step key={step.id} completed={isCompleted}>
                <StepLabel
                  icon={renderStepIcon(index, step.icon)}
                  sx={{
                    '& .MuiStepLabel-labelContainer': {
                      color: isActive
                        ? 'primary.main'
                        : isCompleted
                        ? 'success.main'
                        : isFailed
                        ? 'error.main'
                        : 'text.secondary',
                    },
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight={isActive ? 600 : 500}
                    color={
                      isFailed
                        ? 'error.main'
                        : isCompleted
                        ? 'success.main'
                        : isActive
                        ? 'primary.main'
                        : 'text.primary'
                    }
                  >
                    {t(step.labelKey)}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t(step.descriptionKey)}
                  </Typography>
                  {isActive && (
                    <LinearProgress
                      variant="determinate"
                      value={stepProgress}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: techColors.progressTrack,
                        mb: 1,
                      }}
                    />
                  )}
                </StepContent>
              </Step>
            );
          })}
        </Stepper>

        {/* Success State */}
        {showSuccess && !probeError && (
          <Fade in>
            <Alert
              severity="success"
              icon={<CheckCircleIcon sx={{ fontSize: 32 }} />}
              sx={{
                mt: 3,
                borderRadius: 2,
                '& .MuiAlert-icon': {
                  alignItems: 'center',
                },
              }}
              action={
                mode === 'validate' && (
                  <Button color="inherit" size="small" onClick={onClose}>
                    {t('probe.continue')}
                  </Button>
                )
              }
            >
              <Typography variant="subtitle1" fontWeight={600}>
                {mode === 'validate' ? t('probe.validateSuccess') : t('probe.success')}
              </Typography>
              <Typography variant="body2">
                {mode === 'validate' ? t('probe.validateSuccessDesc') : t('probe.successDesc')}
              </Typography>
            </Alert>
          </Fade>
        )}

        {/* Предупреждение о рассинхронизации времени - показывается после успешного probe если drift > 60s */}
        {/* Кнопка синхронизации находится в AssetDetails, здесь только информация */}
        {showSuccess && !probeError && hasTimeDrift && (
          <Fade in>
            <Alert
              severity="warning"
              icon={<WarningIcon />}
              sx={{
                mt: 2,
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle2" fontWeight={600}>
                {t('probe.timeDrift')}
              </Typography>
              <Typography variant="body2">
                {t('probe.timeDriftDesc', { seconds: Math.abs(probeResult?.meta?.time_drift_seconds || 0) })}
              </Typography>
            </Alert>
          </Fade>
        )}

        {/* Time OK - shown when time is synced (drift < 60s) */}
        {showSuccess && !probeError && !hasTimeDrift && probeResult?.meta?.time_drift_seconds != null && mode === 'probe' && (
          <Fade in>
            <Alert
              severity="info"
              icon={<AccessTimeIcon />}
              sx={{
                mt: 2,
                borderRadius: 2,
              }}
            >
              <Typography variant="body2">
                {t('probe.timeOkDesc')}
              </Typography>
            </Alert>
          </Fade>
        )}

        {/* Error State */}
        {probeError && (
          <Fade in>
            <Alert
              severity="error"
              sx={{
                mt: 3,
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                {mode === 'validate' ? t('probe.validateError') : t('probe.error')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {getErrorMessage()}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={onRetry}
                  variant="outlined"
                >
                  {t('probe.retry')}
                </Button>
                {mode === 'validate' && onEditDetails && (
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={onEditDetails}
                    variant="outlined"
                  >
                    {t('probe.editDetails')}
                  </Button>
                )}
              </Box>
            </Alert>
          </Fade>
        )}

        {/* Status Message */}
        {isProbing && !probeError && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.info.main, 0.1),
              border: '1px solid',
              borderColor: alpha(theme.palette.info.main, 0.3),
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="info.main">
              {mode === 'validate' ? t('probe.validating') : t('probe.scanning')}
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SmartProbeLoader;
