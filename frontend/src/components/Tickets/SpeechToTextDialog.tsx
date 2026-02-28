/**
 * SpeechToTextDialog - Modal for recording voice and converting to text
 * via the SPT (Speech Processing Test) service.
 *
 * Phases: idle -> recording -> recorded -> processing -> result | error
 */
import { useState, useRef, useEffect, useCallback } from 'react';
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
  Alert,
  CircularProgress,
  Collapse,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '@/hooks/useResponsive';

type SttPhase = 'idle' | 'recording' | 'recorded' | 'processing' | 'result' | 'error';

interface SttResult {
  detected_language: string;
  raw_text: string;
  translated_text: string | null;
  normalized_text: string;
  output_language: string;
}

interface SpeechToTextDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
}

function getSupportedMimeType(): string {
  const types = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'audio/webm';
}

function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3',
  };
  return map[mimeType.split(';')[0]] || 'webm';
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const LANGUAGE_NAMES: Record<string, { en: string; he: string }> = {
  ru: { en: 'Russian', he: 'רוסית' },
  he: { en: 'Hebrew', he: 'עברית' },
  en: { en: 'English', he: 'אנגלית' },
};

export function SpeechToTextDialog({ open, onClose, onInsert }: SpeechToTextDialogProps) {
  const { t, i18n } = useTranslation();
  const { isMobile } = useResponsive();
  const isHe = i18n.language === 'he';

  // State
  const [phase, setPhase] = useState<SttPhase>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [outputLanguage, setOutputLanguage] = useState<'he' | 'ru'>('he');
  const [result, setResult] = useState<SttResult | null>(null);
  const [editedText, setEditedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  // Reset all state when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('idle');
      setAudioBlob(null);
      setRecordingSeconds(0);
      setResult(null);
      setEditedText('');
      setErrorMessage('');
      setShowDetails(false);
    } else {
      cleanup();
    }
  }, [open, cleanup]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const isInsecure = location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
        setErrorMessage(
          isInsecure
            ? t('tickets.stt.errorHttps')
            : t('tickets.stt.errorMicPermission')
        );
        setPhase('error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setPhase('recorded');
      };

      recorder.start();
      setRecordingSeconds(0);
      setPhase('recording');

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(t('tickets.stt.errorMicPermission'));
      } else {
        setErrorMessage(err.message || t('tickets.stt.errorDesc'));
      }
      setPhase('error');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const convertToTicket = async () => {
    if (!audioBlob) return;
    setPhase('processing');

    try {
      const formData = new FormData();
      const ext = getFileExtension(audioBlob.type);
      formData.append('audio', audioBlob, `recording_${Date.now()}.${ext}`);
      formData.append('output_language', outputLanguage);
      formData.append('force_translation', 'true');

      const sptBase = import.meta.env.VITE_SPT_API_URL || '/spt-api';
      const response = await fetch(`${sptBase}/api/speech-to-ticket`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data: SttResult = await response.json();

      if (!data.normalized_text || data.normalized_text.trim() === '') {
        setErrorMessage(t('tickets.stt.errorDesc'));
        setPhase('error');
        return;
      }

      setResult(data);
      setEditedText(data.normalized_text);
      setPhase('result');
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setErrorMessage(t('tickets.stt.errorApiUnavailable'));
      } else {
        setErrorMessage(err.message || t('tickets.stt.errorDesc'));
      }
      setPhase('error');
    }
  };

  const handleInsert = () => {
    onInsert(editedText);
  };

  const handleReset = () => {
    cleanup();
    setAudioBlob(null);
    setRecordingSeconds(0);
    setResult(null);
    setEditedText('');
    setErrorMessage('');
    setShowDetails(false);
    setPhase('idle');
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const btnSize = isMobile ? 80 : 64;

  // --- Phase renderers ---

  const renderIdle = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 3 }}>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {t('tickets.stt.tapToRecord')}
      </Typography>

      <IconButton
        onClick={startRecording}
        sx={{
          width: btnSize,
          height: btnSize,
          bgcolor: 'primary.main',
          color: 'white',
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <MicIcon sx={{ fontSize: btnSize * 0.5 }} />
      </IconButton>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t('tickets.stt.outputLanguage')}:
        </Typography>
        <ToggleButtonGroup
          value={outputLanguage}
          exclusive
          onChange={(_, val) => { if (val) setOutputLanguage(val); }}
          size="small"
        >
          <ToggleButton value="he">{t('tickets.stt.languageHe')}</ToggleButton>
          <ToggleButton value="ru">{t('tickets.stt.languageRu')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );

  const renderRecording = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 3 }}>
      <Typography variant="body1" color="error.main" fontWeight={500}>
        {t('tickets.stt.recordingInProgress')}
      </Typography>

      <Typography
        variant={isMobile ? 'h3' : 'h4'}
        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 300 }}
      >
        {formatTimer(recordingSeconds)}
      </Typography>

      <IconButton
        onClick={stopRecording}
        sx={{
          width: btnSize,
          height: btnSize,
          bgcolor: 'error.main',
          color: 'white',
          animation: 'stt-pulse 1.5s ease-in-out infinite',
          '@keyframes stt-pulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.4)' },
            '70%': { boxShadow: '0 0 0 20px rgba(244, 67, 54, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)' },
          },
          '&:hover': { bgcolor: 'error.dark' },
        }}
      >
        <StopIcon sx={{ fontSize: btnSize * 0.5 }} />
      </IconButton>

      <Typography variant="caption" color="text.secondary">
        {t('tickets.stt.stopRecording')}
      </Typography>
    </Box>
  );

  const renderRecorded = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 3 }}>
      <Typography variant="body1" color="success.main" fontWeight={500}>
        {t('tickets.stt.recorded')} ({formatTimer(recordingSeconds)})
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row', width: '100%', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<AutoFixHighIcon />}
          onClick={convertToTicket}
          sx={{ minWidth: 180 }}
        >
          {t('tickets.stt.convert')}
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<RefreshIcon />}
          onClick={handleReset}
        >
          {t('tickets.stt.reRecord')}
        </Button>
      </Box>
    </Box>
  );

  const renderProcessing = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
      <CircularProgress size={48} />
      <Typography variant="h6">{t('tickets.stt.processing')}</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {t('tickets.stt.processingDesc')}
      </Typography>
    </Box>
  );

  const renderResult = () => {
    if (!result) return null;
    const langName = LANGUAGE_NAMES[result.detected_language]?.[isHe ? 'he' : 'en'] || result.detected_language;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={t('tickets.stt.detectedLanguage', { language: langName })}
            size="small"
            color="info"
            variant="outlined"
          />
        </Box>

        <Typography variant="subtitle2">{t('tickets.stt.normalizedText')}</Typography>
        <TextField
          fullWidth
          multiline
          rows={isMobile ? 6 : 4}
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          autoFocus
        />

        {/* Collapsible details: raw transcript + translation */}
        {(result.raw_text || result.translated_text) && (
          <Box>
            <Button
              size="small"
              onClick={() => setShowDetails(!showDetails)}
              startIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ textTransform: 'none' }}
            >
              {showDetails ? t('tickets.stt.hideDetails') : t('tickets.stt.showDetails')}
            </Button>
            <Collapse in={showDetails}>
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {result.raw_text && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      {t('tickets.stt.rawTranscript')}
                    </Typography>
                    <Box sx={{
                      p: 1.5,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      fontSize: '0.85rem',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 120,
                      overflow: 'auto',
                    }}>
                      {result.raw_text}
                    </Box>
                  </Box>
                )}
                {result.translated_text && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      {t('tickets.stt.translatedText')}
                    </Typography>
                    <Box sx={{
                      p: 1.5,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      fontSize: '0.85rem',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 120,
                      overflow: 'auto',
                    }}>
                      {result.translated_text}
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>
    );
  };

  const renderError = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>
      <Alert severity="error">
        <Typography variant="subtitle2">{t('tickets.stt.error')}</Typography>
        <Typography variant="body2">{errorMessage}</Typography>
      </Alert>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
        {audioBlob && (
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { setPhase('recorded'); setErrorMessage(''); }}>
            {t('tickets.stt.retry')}
          </Button>
        )}
        <Button variant="outlined" startIcon={<MicIcon />} onClick={handleReset}>
          {t('tickets.stt.reRecord')}
        </Button>
      </Box>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={phase === 'processing' ? undefined : handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="span">
          {t('tickets.stt.title')}
        </Typography>
        {phase !== 'processing' && (
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {phase === 'idle' && renderIdle()}
        {phase === 'recording' && renderRecording()}
        {phase === 'recorded' && renderRecorded()}
        {phase === 'processing' && renderProcessing()}
        {phase === 'result' && renderResult()}
        {phase === 'error' && renderError()}
      </DialogContent>

      {phase === 'result' && (
        <DialogActions sx={{
          px: 3,
          py: 2,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 1 : 0,
        }}>
          <Button
            onClick={handleReset}
            color="inherit"
            fullWidth={isMobile}
          >
            {t('tickets.stt.reRecord')}
          </Button>
          <Button
            variant="contained"
            onClick={handleInsert}
            disabled={!editedText.trim()}
            fullWidth={isMobile}
          >
            {t('tickets.stt.insert')}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
