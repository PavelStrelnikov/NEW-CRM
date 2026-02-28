/**
 * Reusable file upload component with camera support for mobile.
 */
import React, { useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  alpha,
  CircularProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '@/hooks/useResponsive';

export interface FileUploadProps {
  onFileSelect: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  isUploading?: boolean;
  maxSizeMB?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx',
  multiple = false,
  disabled = false,
  isUploading = false,
  maxSizeMB = 25,
}) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsive();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files);
      // Reset input to allow selecting same file again
      e.target.value = '';
    }
  };

  const isDisabled = disabled || isUploading;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 2,
        p: 2,
        border: 2,
        borderStyle: 'dashed',
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
        borderRadius: 2,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* File input (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={isDisabled}
      />

      {/* Camera input (hidden, mobile only) */}
      {isMobile && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={isDisabled}
        />
      )}

      {isUploading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">
            {t('files.uploading')}
          </Typography>
        </Box>
      ) : isMobile ? (
        // Mobile: Two buttons - Camera + File
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <Button
            variant="outlined"
            startIcon={<PhotoCameraIcon />}
            onClick={() => cameraInputRef.current?.click()}
            disabled={isDisabled}
            sx={{
              flex: 1,
              minHeight: 48, // Touch-friendly
              py: 1.5,
            }}
          >
            {t('files.takePhoto')}
          </Button>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            sx={{
              flex: 1,
              minHeight: 48,
              py: 1.5,
            }}
          >
            {t('files.chooseFile')}
          </Button>
        </Box>
      ) : (
        // Desktop: Single upload button
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          sx={{ minHeight: 44 }}
        >
          {t('files.uploadFile')}
        </Button>
      )}

      {!isUploading && (
        <Typography variant="caption" color="text.secondary">
          {t('files.maxSize', { size: maxSizeMB })}
        </Typography>
      )}
    </Box>
  );
};

export default FileUpload;
