/**
 * Image lightbox component for viewing images with zoom and navigation.
 * Supports mobile back button and responsive sizing.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  IconButton,
  Box,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useResponsive } from '@/hooks/useResponsive';

export interface LightboxImage {
  src: string;
  alt?: string;
  filename?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  onDownload?: (index: number) => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  currentIndex,
  open,
  onClose,
  onIndexChange,
  onDownload,
}) => {
  const theme = useTheme();
  const { isMobile } = useResponsive();
  const [index, setIndex] = useState(currentIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Sync index with prop
  useEffect(() => {
    setIndex(currentIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex, open]);

  // Handle browser back button
  useEffect(() => {
    if (!open) return;

    // Push a state when dialog opens
    window.history.pushState({ imagePreview: true }, '');

    const handlePopState = (event: PopStateEvent) => {
      // When back button is pressed, close the dialog
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [open, onClose]);

  const currentImage = images[index];
  const hasMultiple = images.length > 1;

  const goToPrevious = useCallback(() => {
    const newIndex = index > 0 ? index - 1 : images.length - 1;
    setIndex(newIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onIndexChange?.(newIndex);
  }, [index, images.length, onIndexChange]);

  const goToNext = useCallback(() => {
    const newIndex = index < images.length - 1 ? index + 1 : 0;
    setIndex(newIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onIndexChange?.(newIndex);
  }, [index, images.length, onIndexChange]);

  const handleZoomIn = () => {
    setScale((s) => Math.min(s + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s - 0.5, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Close and go back in history
  const handleClose = useCallback(() => {
    // Go back in history to remove our pushed state
    if (window.history.state?.imagePreview) {
      window.history.back();
    } else {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          handleClose();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          handleReset();
          break;
      }
    },
    [open, goToPrevious, goToNext, handleClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Mouse drag for panning when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Double click/tap to zoom
  const handleDoubleClick = () => {
    if (scale === 1) {
      setScale(2);
    } else {
      handleReset();
    }
  };

  if (!currentImage) return null;

  const controlButtonStyle = {
    color: 'white',
    bgcolor: alpha(theme.palette.common.black, 0.6),
    '&:hover': {
      bgcolor: alpha(theme.palette.common.black, 0.8),
    },
    minWidth: 40,
    minHeight: 40,
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: alpha(theme.palette.common.black, 0.95),
          backgroundImage: 'none',
          // On desktop: modal-like with max dimensions
          ...(!isMobile && {
            maxHeight: '90vh',
            maxWidth: '90vw',
            m: 2,
          }),
          // On mobile: full screen but with safe areas
          ...(isMobile && {
            m: 0,
            maxHeight: '100%',
            maxWidth: '100%',
          }),
        },
      }}
    >
      {/* Fixed top toolbar - always visible */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1,
          zIndex: 10,
          bgcolor: alpha(theme.palette.common.black, 0.8),
          minHeight: 56,
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flex: 1, minWidth: 0 }}>
          {currentImage.filename && (
            <Typography
              variant="body2"
              sx={{
                color: 'white',
                ml: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: isMobile ? 150 : 300,
              }}
            >
              {currentImage.filename}
            </Typography>
          )}
          {hasMultiple && (
            <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.7), ml: 1, flexShrink: 0 }}>
              {index + 1}/{images.length}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          {!isMobile && (
            <>
              <IconButton onClick={handleZoomOut} sx={controlButtonStyle} size="small">
                <ZoomOutIcon />
              </IconButton>
              <IconButton onClick={handleReset} sx={controlButtonStyle} size="small">
                <RestartAltIcon />
              </IconButton>
              <IconButton onClick={handleZoomIn} sx={controlButtonStyle} size="small">
                <ZoomInIcon />
              </IconButton>
            </>
          )}
          {onDownload && (
            <IconButton onClick={() => onDownload(index)} sx={controlButtonStyle} size="small">
              <DownloadIcon />
            </IconButton>
          )}
          <IconButton onClick={handleClose} sx={{ ...controlButtonStyle, bgcolor: alpha(theme.palette.error.main, 0.8) }} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Image container */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          p: isMobile ? 1 : 2,
          minHeight: isMobile ? 'calc(100vh - 56px - 80px)' : 400,
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        <Box
          component="img"
          src={currentImage.src}
          alt={currentImage.alt || currentImage.filename || 'Image'}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease',
            pointerEvents: 'none',
          }}
        />
      </Box>

      {/* Navigation arrows - only on desktop or if multiple images */}
      {hasMultiple && !isMobile && (
        <>
          <IconButton
            onClick={goToPrevious}
            sx={{
              ...controlButtonStyle,
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 48,
              height: 48,
            }}
          >
            <NavigateBeforeIcon fontSize="large" />
          </IconButton>
          <IconButton
            onClick={goToNext}
            sx={{
              ...controlButtonStyle,
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 48,
              height: 48,
            }}
          >
            <NavigateNextIcon fontSize="large" />
          </IconButton>
        </>
      )}

      {/* Bottom controls for mobile with multiple images */}
      {hasMultiple && isMobile && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            p: 2,
            bgcolor: alpha(theme.palette.common.black, 0.8),
          }}
        >
          <IconButton
            onClick={goToPrevious}
            sx={{ ...controlButtonStyle, width: 48, height: 48 }}
          >
            <NavigateBeforeIcon />
          </IconButton>
          <Typography variant="body1" sx={{ color: 'white', minWidth: 60, textAlign: 'center' }}>
            {index + 1} / {images.length}
          </Typography>
          <IconButton
            onClick={goToNext}
            sx={{ ...controlButtonStyle, width: 48, height: 48 }}
          >
            <NavigateNextIcon />
          </IconButton>
        </Box>
      )}

      {/* Thumbnail strip for desktop with multiple images */}
      {hasMultiple && !isMobile && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
            p: 1.5,
            bgcolor: alpha(theme.palette.common.black, 0.8),
            overflowX: 'auto',
          }}
        >
          {images.map((img, i) => (
            <Box
              key={i}
              component="img"
              src={img.src}
              alt={img.alt || `Thumbnail ${i + 1}`}
              onClick={() => {
                setIndex(i);
                setScale(1);
                setPosition({ x: 0, y: 0 });
                onIndexChange?.(i);
              }}
              sx={{
                width: 50,
                height: 50,
                objectFit: 'cover',
                borderRadius: 1,
                cursor: 'pointer',
                opacity: i === index ? 1 : 0.5,
                border: i === index ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  opacity: 1,
                },
              }}
            />
          ))}
        </Box>
      )}
    </Dialog>
  );
};

export default ImageLightbox;
