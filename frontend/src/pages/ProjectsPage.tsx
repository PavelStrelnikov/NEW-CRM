import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const ProjectsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="h4">{t('nav.projects')}</Typography>
      <Typography variant="body1" sx={{ mt: 2 }}>
        Projects module - Coming soon
      </Typography>
    </Box>
  );
};
