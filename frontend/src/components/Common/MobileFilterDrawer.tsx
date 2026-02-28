/**
 * MobileFilterDrawer - Выдвижная панель фильтров для мобильных устройств
 *
 * Используется на страницах списков (Clients, Tickets, Assets) для
 * компактного отображения фильтров на мобильных устройствах.
 */
import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import { useTranslation } from 'react-i18next';

export interface MobileFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  onReset?: () => void;
  onApply?: () => void;
  showApply?: boolean;
  showReset?: boolean;
}

export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  open,
  onClose,
  children,
  title,
  onReset,
  onApply,
  showApply = false,
  showReset = true,
}) => {
  const { t, i18n } = useTranslation();

  const handleApply = () => {
    onApply?.();
    onClose();
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '85vh',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          {title || t('common.filters')}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Drag handle indicator */}
      <Box
        sx={{
          width: 40,
          height: 4,
          bgcolor: 'grey.300',
          borderRadius: 2,
          mx: 'auto',
          mt: 1,
          mb: 2,
        }}
      />

      {/* Filter content */}
      <Box
        sx={{
          px: 2,
          pb: 2,
          overflowY: 'auto',
          flexGrow: 1,
        }}
      >
        {children}
      </Box>

      {/* Actions */}
      {(showApply || showReset) && (
        <>
          <Divider />
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              p: 2,
              flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row',
            }}
          >
            {showReset && (
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleReset}
                startIcon={<FilterListOffIcon />}
                sx={{ flex: 1 }}
              >
                {t('common.reset')}
              </Button>
            )}
            {showApply && (
              <Button
                variant="contained"
                onClick={handleApply}
                sx={{ flex: 1 }}
              >
                {t('common.apply')}
              </Button>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
};

export default MobileFilterDrawer;
