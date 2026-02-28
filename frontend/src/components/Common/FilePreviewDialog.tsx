/**
 * Universal file preview dialog that handles images, PDFs, and other file types.
 * Uses authenticated blob URLs for secure file access.
 * On mobile, PDFs are opened directly in a new tab for better compatibility.
 */
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  useTheme,
  IconButton,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DescriptionIcon from '@mui/icons-material/Description';
import { useTranslation } from 'react-i18next';
import { ImageLightbox } from './ImageLightbox';
import { PDFViewer } from './PDFViewer';
import { Attachment } from '@/types';
import { attachmentsApi } from '@/api/attachments';
import { useResponsive } from '@/hooks/useResponsive';

type FileType = 'image' | 'pdf' | 'document' | 'other';

function getFileType(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint')
  ) {
    return 'document';
  }
  return 'other';
}

interface FilePreviewDialogProps {
  attachment: Attachment | null;
  attachments?: Attachment[]; // For image gallery navigation
  open: boolean;
  onClose: () => void;
  onNavigate?: (attachment: Attachment) => void;
}

// Cache for blob URLs to avoid re-fetching
const blobUrlCache = new Map<string, string>();

export const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({
  attachment,
  attachments = [],
  open,
  onClose,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isMobile } = useResponsive();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mobilePdfHandled = useRef(false);

  // For image gallery - preloaded blob URLs
  const [imageBlobUrls, setImageBlobUrls] = useState<Map<string, string>>(new Map());

  // Filter image attachments for gallery navigation
  const imageAttachments = useMemo(
    () => attachments.filter((a) => a.mime_type.startsWith('image/')),
    [attachments]
  );

  const currentImageIndex = useMemo(() => {
    if (!attachment || !attachment.mime_type.startsWith('image/')) return 0;
    return imageAttachments.findIndex((a) => a.id === attachment.id);
  }, [attachment, imageAttachments]);

  // Load blob URL for current attachment
  const loadBlobUrl = useCallback(async (att: Attachment) => {
    // Check cache first
    if (blobUrlCache.has(att.id)) {
      return blobUrlCache.get(att.id)!;
    }

    const blob = await attachmentsApi.downloadAttachment(att.id);
    const url = window.URL.createObjectURL(blob);
    blobUrlCache.set(att.id, url);
    return url;
  }, []);

  // On mobile, open PDF directly in new tab
  useEffect(() => {
    if (!open || !attachment) {
      mobilePdfHandled.current = false;
      return;
    }

    const fileType = getFileType(attachment.mime_type);

    // On mobile, immediately open PDF in new tab and close dialog
    if (isMobile && fileType === 'pdf' && !mobilePdfHandled.current) {
      mobilePdfHandled.current = true;
      setIsLoading(true);

      loadBlobUrl(attachment)
        .then((url) => {
          // Open in new tab
          window.open(url, '_blank');
          // Close the dialog
          onClose();
        })
        .catch((err) => {
          console.error('Failed to load PDF:', err);
          setError(t('files.previewError'));
          setIsLoading(false);
        });
    }
  }, [open, attachment, isMobile, loadBlobUrl, onClose, t]);

  // Load current file when dialog opens (for non-mobile-PDF cases)
  useEffect(() => {
    if (!open || !attachment) {
      setBlobUrl(null);
      setError(null);
      return;
    }

    const fileType = getFileType(attachment.mime_type);

    // Skip for mobile PDF (handled above) and non-previewable files
    if ((isMobile && fileType === 'pdf') || fileType === 'document' || fileType === 'other') {
      return;
    }

    setIsLoading(true);
    setError(null);

    loadBlobUrl(attachment)
      .then((url) => {
        setBlobUrl(url);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load file:', err);
        setError(t('files.previewError'));
        setIsLoading(false);
      });
  }, [open, attachment, isMobile, loadBlobUrl, t]);

  // Preload image gallery URLs
  useEffect(() => {
    if (!open || imageAttachments.length === 0) return;

    const loadImages = async () => {
      const urls = new Map<string, string>();

      // Load current image first
      if (attachment && attachment.mime_type.startsWith('image/')) {
        try {
          const url = await loadBlobUrl(attachment);
          urls.set(attachment.id, url);
          setImageBlobUrls(new Map(urls));
        } catch (err) {
          console.error('Failed to load current image:', err);
        }
      }

      // Then load others in background
      for (const img of imageAttachments) {
        if (!urls.has(img.id)) {
          try {
            const url = await loadBlobUrl(img);
            urls.set(img.id, url);
            setImageBlobUrls(new Map(urls));
          } catch (err) {
            console.error('Failed to preload image:', img.filename, err);
          }
        }
      }
    };

    loadImages();
  }, [open, imageAttachments, attachment, loadBlobUrl]);

  const handleDownload = async () => {
    if (!attachment) return;
    try {
      const blob = await attachmentsApi.downloadAttachment(attachment.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleImageIndexChange = (index: number) => {
    if (onNavigate && imageAttachments[index]) {
      onNavigate(imageAttachments[index]);
    }
  };

  if (!attachment) return null;

  const fileType = getFileType(attachment.mime_type);

  // On mobile, PDF is handled by opening in new tab - show loading briefly
  if (isMobile && fileType === 'pdf') {
    if (isLoading) {
      return (
        <Dialog
          open={open}
          onClose={onClose}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: { bgcolor: 'rgba(0,0,0,0.9)' },
          }}
        >
          <DialogContent>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 4,
                gap: 2,
              }}
            >
              <CircularProgress sx={{ color: 'white' }} />
              <Typography sx={{ color: 'white' }}>{t('files.openingPdf')}</Typography>
            </Box>
          </DialogContent>
        </Dialog>
      );
    }
    // If there's an error, show error dialog
    if (error) {
      return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" noWrap sx={{ maxWidth: '80%' }}>{attachment.filename}</Typography>
            <IconButton onClick={onClose}><CloseIcon /></IconButton>
          </Box>
          <DialogContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="error" gutterBottom>{error}</Typography>
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownload} sx={{ mt: 2 }}>
                {t('files.download')}
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      );
    }
    // Otherwise dialog should be closed
    return null;
  }

  // Loading state
  if (isLoading && (fileType === 'image' || fileType === 'pdf')) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: 'rgba(0,0,0,0.9)', minHeight: 300 },
        }}
      >
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              gap: 2,
            }}
          >
            <CircularProgress sx={{ color: 'white' }} />
            <Typography sx={{ color: 'white' }}>{t('app.loading')}</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // Error state
  if (error && (fileType === 'image' || fileType === 'pdf')) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" noWrap sx={{ maxWidth: '80%' }}>{attachment.filename}</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Box>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error" gutterBottom>{error}</Typography>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownload} sx={{ mt: 2 }}>
              {t('files.download')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // Image preview with lightbox
  if (fileType === 'image' && blobUrl) {
    // Build images array with blob URLs
    const images = imageAttachments.map((a) => ({
      src: imageBlobUrls.get(a.id) || '', // May be empty while loading
      filename: a.filename,
      alt: a.filename,
      isLoading: !imageBlobUrls.has(a.id),
    }));

    // Fallback to single image if gallery not loaded
    const displayImages = images.length > 0 && images.some(img => img.src)
      ? images.filter(img => img.src) // Only show loaded images
      : [{ src: blobUrl, filename: attachment.filename, alt: attachment.filename, isLoading: false }];

    // Recalculate index for filtered images
    const filteredIndex = displayImages.findIndex(img => img.filename === attachment.filename);

    return (
      <ImageLightbox
        images={displayImages}
        currentIndex={filteredIndex >= 0 ? filteredIndex : 0}
        open={open}
        onClose={onClose}
        onIndexChange={(idx) => {
          const img = displayImages[idx];
          if (img && onNavigate) {
            const att = imageAttachments.find(a => a.filename === img.filename);
            if (att) onNavigate(att);
          }
        }}
        onDownload={() => handleDownload()}
      />
    );
  }

  // PDF preview (desktop only - mobile is handled above)
  if (fileType === 'pdf' && blobUrl) {
    return (
      <PDFViewer
        src={blobUrl}
        filename={attachment.filename}
        open={open}
        onClose={onClose}
        onDownload={handleDownload}
      />
    );
  }

  // Fallback for documents and other files - show download dialog
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: theme.palette.background.paper,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6" noWrap sx={{ maxWidth: '80%' }}>
          {attachment.filename}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 4,
            gap: 2,
          }}
        >
          {fileType === 'document' ? (
            <DescriptionIcon sx={{ fontSize: 80, color: theme.palette.info.main }} />
          ) : (
            <InsertDriveFileIcon sx={{ fontSize: 80, color: theme.palette.action.active }} />
          )}
          <Typography variant="body1" color="text.secondary" textAlign="center">
            {t('files.previewNotAvailable')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {attachment.mime_type}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} color="inherit">
          {t('app.close')}
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
        >
          {t('files.download')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilePreviewDialog;
