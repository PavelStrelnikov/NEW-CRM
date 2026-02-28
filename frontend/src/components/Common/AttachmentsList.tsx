/**
 * Display and manage a list of attachments with inline preview support.
 * Uses authenticated blob URLs for thumbnails.
 * Responsive design for mobile devices.
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Typography,
  Tooltip,
  CircularProgress,
  alpha,
  useTheme,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useTranslation } from 'react-i18next';
import { Attachment } from '@/types';
import { formatIsraelTime } from '@/utils/timezone';
import { attachmentsApi } from '@/api/attachments';
import { useToast } from '@/contexts/ToastContext';
import { useResponsive } from '@/hooks/useResponsive';
import { FilePreviewDialog } from './FilePreviewDialog';

interface AttachmentsListProps {
  attachments: Attachment[];
  isLoading?: boolean;
  canDelete?: boolean;
  onDelete?: (attachmentId: string) => void;
  isDeleting?: string | null;
}

/**
 * Check if file type supports inline preview.
 */
function canPreview(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf'
  );
}

/**
 * Get appropriate icon for file type.
 */
function getFileIcon(mimeType: string, size: number = 24) {
  const sx = { fontSize: size };
  if (mimeType.startsWith('image/')) {
    return <ImageIcon color="primary" sx={sx} />;
  }
  if (mimeType === 'application/pdf') {
    return <PictureAsPdfIcon color="error" sx={sx} />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <DescriptionIcon color="info" sx={sx} />;
  }
  return <InsertDriveFileIcon color="action" sx={sx} />;
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Cache for thumbnail blob URLs
const thumbnailCache = new Map<string, string>();

/**
 * Component for lazy-loading image thumbnails via authenticated API.
 */
const ImageThumbnail: React.FC<{ attachment: Attachment; size?: number }> = ({ attachment, size = 48 }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadThumbnail = async () => {
      // Check cache first
      if (thumbnailCache.has(attachment.id)) {
        setThumbnailUrl(thumbnailCache.get(attachment.id)!);
        setIsLoading(false);
        return;
      }

      try {
        const blob = await attachmentsApi.downloadAttachment(attachment.id);
        if (!mounted) return;

        const url = window.URL.createObjectURL(blob);
        thumbnailCache.set(attachment.id, url);
        setThumbnailUrl(url);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load thumbnail:', err);
        if (mounted) {
          setError(true);
          setIsLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      mounted = false;
    };
  }, [attachment.id]);

  if (isLoading) {
    return <Skeleton variant="rectangular" width={size} height={size} />;
  }

  if (error || !thumbnailUrl) {
    return <ImageIcon color="primary" sx={{ fontSize: size * 0.6 }} />;
  }

  return (
    <Box
      component="img"
      src={thumbnailUrl}
      alt={attachment.filename}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
};

/**
 * Delete confirmation dialog.
 */
interface DeleteConfirmDialogProps {
  open: boolean;
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  filename,
  onConfirm,
  onCancel,
  isDeleting,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t('files.deleteConfirmTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('files.deleteConfirmMessage')}
        </DialogContentText>
        <Typography
          variant="body2"
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
            fontWeight: 500,
            wordBreak: 'break-word',
          }}
        >
          {filename}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={isDeleting}>
          {t('app.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
        >
          {t('app.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const AttachmentsList: React.FC<AttachmentsListProps> = ({
  attachments,
  isLoading = false,
  canDelete = false,
  onDelete,
  isDeleting,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isMobile } = useResponsive();
  const { showError } = useToast();
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Attachment | null>(null);

  const handleDownload = async (attachment: Attachment) => {
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
    } catch (error) {
      console.error('Download failed:', error);
      showError(t('files.downloadError'));
    }
  };

  const handlePreview = (attachment: Attachment) => {
    setPreviewAttachment(attachment);
  };

  const handleClosePreview = () => {
    setPreviewAttachment(null);
  };

  const handleNavigatePreview = (attachment: Attachment) => {
    setPreviewAttachment(attachment);
  };

  const handleDeleteClick = (attachment: Attachment) => {
    setDeleteConfirm(attachment);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm && onDelete) {
      onDelete(deleteConfirm.id);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  // Close delete dialog when deletion completes
  useEffect(() => {
    if (deleteConfirm && !isDeleting) {
      // Check if the file was actually deleted (no longer in attachments)
      const stillExists = attachments.some(a => a.id === deleteConfirm.id);
      if (!stillExists) {
        setDeleteConfirm(null);
      }
    }
  }, [attachments, deleteConfirm, isDeleting]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (attachments.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('files.noFiles')}</Typography>
      </Box>
    );
  }

  // Mobile layout - card-based
  if (isMobile) {
    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 1.5 }}>
          {attachments.map((attachment) => {
            const isImage = attachment.mime_type.startsWith('image/');
            const hasPreview = canPreview(attachment.mime_type);

            return (
              <Card
                key={attachment.id}
                variant="outlined"
                sx={{
                  cursor: hasPreview ? 'pointer' : 'default',
                  '&:active': hasPreview ? {
                    bgcolor: alpha(theme.palette.action.hover, 0.08),
                  } : {},
                }}
                onClick={() => hasPreview && handlePreview(attachment)}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  {/* Top row: thumbnail + filename */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                    {/* Thumbnail */}
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        minWidth: 56,
                        borderRadius: 1,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isImage ? 'transparent' : alpha(theme.palette.action.hover, 0.08),
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      {isImage ? (
                        <ImageThumbnail attachment={attachment} size={56} />
                      ) : (
                        getFileIcon(attachment.mime_type, 28)
                      )}
                    </Box>

                    {/* File info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 500,
                          wordBreak: 'break-word',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.3,
                        }}
                      >
                        {attachment.filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {formatFileSize(attachment.size_bytes)} • {formatIsraelTime(attachment.created_at, 'dd/MM/yy HH:mm')}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Action buttons - full width on mobile */}
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      mt: 1,
                      pt: 1.5,
                      borderTop: `1px solid ${theme.palette.divider}`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasPreview && (
                      <Button
                        variant="outlined"
                        size="medium"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handlePreview(attachment)}
                        sx={{ flex: 1, minHeight: 44 }}
                      >
                        {t('files.preview')}
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      size="medium"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownload(attachment)}
                      sx={{ flex: 1, minHeight: 44 }}
                    >
                      {t('files.download')}
                    </Button>
                    {canDelete && onDelete && (
                      <IconButton
                        onClick={() => handleDeleteClick(attachment)}
                        color="error"
                        disabled={isDeleting === attachment.id}
                        sx={{
                          minWidth: 44,
                          minHeight: 44,
                          border: `1px solid ${theme.palette.error.main}`,
                          borderRadius: 1,
                        }}
                      >
                        {isDeleting === attachment.id ? (
                          <CircularProgress size={20} color="error" />
                        ) : (
                          <DeleteIcon />
                        )}
                      </IconButton>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        {/* Preview dialog */}
        <FilePreviewDialog
          attachment={previewAttachment}
          attachments={attachments}
          open={!!previewAttachment}
          onClose={handleClosePreview}
          onNavigate={handleNavigatePreview}
        />

        {/* Delete confirmation dialog */}
        <DeleteConfirmDialog
          open={!!deleteConfirm}
          filename={deleteConfirm?.filename || ''}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={isDeleting === deleteConfirm?.id}
        />
      </>
    );
  }

  // Desktop layout - list-based
  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {attachments.map((attachment, index) => {
          const isImage = attachment.mime_type.startsWith('image/');
          const hasPreview = canPreview(attachment.mime_type);

          return (
            <Box
              key={attachment.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: 1.5,
                px: 3,
                cursor: hasPreview ? 'pointer' : 'default',
                borderBottom: index < attachments.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                '&:hover': {
                  bgcolor: alpha(theme.palette.action.hover, 0.04),
                },
              }}
              onClick={() => hasPreview && handlePreview(attachment)}
            >
              {/* Thumbnail or icon */}
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  minWidth: 48,
                  borderRadius: 1,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isImage ? 'transparent' : alpha(theme.palette.action.hover, 0.08),
                }}
              >
                {isImage ? (
                  <ImageThumbnail attachment={attachment} />
                ) : (
                  getFileIcon(attachment.mime_type)
                )}
              </Box>

              {/* File info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {attachment.filename}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(attachment.size_bytes)}
                  {' • '}
                  {attachment.uploaded_by_actor_display}
                  {' • '}
                  {formatIsraelTime(attachment.created_at)}
                </Typography>
              </Box>

              {/* Action buttons */}
              <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                {hasPreview && (
                  <Tooltip title={t('files.preview')}>
                    <IconButton
                      onClick={() => handlePreview(attachment)}
                      color="primary"
                      size="small"
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={t('files.download')}>
                  <IconButton
                    onClick={() => handleDownload(attachment)}
                    color="primary"
                    size="small"
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
                {canDelete && onDelete && (
                  <Tooltip title={t('app.delete')}>
                    <IconButton
                      onClick={() => handleDeleteClick(attachment)}
                      color="error"
                      size="small"
                      disabled={isDeleting === attachment.id}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      {isDeleting === attachment.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <DeleteIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Preview dialog */}
      <FilePreviewDialog
        attachment={previewAttachment}
        attachments={attachments}
        open={!!previewAttachment}
        onClose={handleClosePreview}
        onNavigate={handleNavigatePreview}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteConfirm}
        filename={deleteConfirm?.filename || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting === deleteConfirm?.id}
      />
    </>
  );
};

export default AttachmentsList;
