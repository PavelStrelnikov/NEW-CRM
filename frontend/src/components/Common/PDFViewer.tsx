/**
 * PDF viewer component with mobile support.
 * Uses iframe for desktop and object/embed fallback for mobile devices.
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  CircularProgress,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '@/hooks/useResponsive';

interface PDFViewerProps {
  src: string;
  filename?: string;
  open: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  src,
  filename,
  open,
  onClose,
  onDownload,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isMobile } = useResponsive();
  const [isLoading, setIsLoading] = useState(true);
  const [showFallback, setShowFallback] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setShowFallback(false);
    }
  }, [open, src]);

  // On mobile, many browsers don't support PDF in iframe
  // Show a user-friendly fallback with download/open options
  useEffect(() => {
    if (open && isMobile) {
      // Give iframe a chance to load, then show fallback if needed
      const timer = setTimeout(() => {
        setShowFallback(true);
        setIsLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [open, isMobile]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setShowFallback(true);
  };

  const handleOpenInNewTab = () => {
    // Create a new blob URL and open it
    window.open(src, '_blank');
  };

  const controlButtonStyle = {
    color: 'white',
    bgcolor: alpha(theme.palette.common.black, 0.5),
    '&:hover': {
      bgcolor: alpha(theme.palette.common.black, 0.7),
    },
    minWidth: 44,
    minHeight: 44,
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: alpha(theme.palette.common.black, 0.95),
          backgroundImage: 'none',
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top toolbar */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1,
            bgcolor: alpha(theme.palette.common.black, 0.7),
          }}
        >
          <Typography
            variant="body1"
            sx={{
              color: 'white',
              ml: 1,
              maxWidth: isMobile ? '40%' : '50%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: isMobile ? '0.875rem' : '1rem',
            }}
          >
            {filename || 'PDF Document'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={handleOpenInNewTab} sx={controlButtonStyle} size="small">
              <OpenInNewIcon />
            </IconButton>
            {onDownload && (
              <IconButton onClick={onDownload} sx={controlButtonStyle} size="small">
                <DownloadIcon />
              </IconButton>
            )}
            <IconButton onClick={onClose} sx={controlButtonStyle} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* PDF container */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            bgcolor: '#525659',
            overflow: 'auto',
          }}
        >
          {isLoading && !showFallback && (
            <Box
              sx={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                zIndex: 10,
              }}
            >
              <CircularProgress sx={{ color: 'white' }} />
              <Typography sx={{ color: 'white' }}>{t('app.loading')}</Typography>
            </Box>
          )}

          {showFallback ? (
            // Mobile fallback - show friendly UI with action buttons
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                p: 4,
                textAlign: 'center',
              }}
            >
              <PictureAsPdfIcon sx={{ fontSize: 80, color: '#ff5252' }} />
              <Typography variant="h6" sx={{ color: 'white' }}>
                {filename || 'PDF Document'}
              </Typography>
              <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.7), maxWidth: 300 }}>
                {t('files.mobilePdfHint')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: 280 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<OpenInNewIcon />}
                  onClick={handleOpenInNewTab}
                  sx={{ py: 1.5 }}
                >
                  {t('files.openInBrowser')}
                </Button>
                {onDownload && (
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<DownloadIcon />}
                    onClick={onDownload}
                    sx={{
                      py: 1.5,
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        bgcolor: 'rgba(255,255,255,0.1)',
                      }
                    }}
                  >
                    {t('files.download')}
                  </Button>
                )}
              </Box>
            </Box>
          ) : (
            // Desktop - use iframe (works well in most desktop browsers)
            <Box
              component="iframe"
              src={src}
              onLoad={handleLoad}
              onError={handleError}
              sx={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: isLoading ? 'none' : 'block',
              }}
              title={filename || 'PDF Document'}
            />
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewer;
