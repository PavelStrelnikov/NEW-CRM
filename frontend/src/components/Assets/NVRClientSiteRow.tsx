/**
 * NVR Client/Site horizontal band below the header.
 */

import React from 'react';
import { Box, Card, CardContent, Link, Typography } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PlaceIcon from '@mui/icons-material/Place';
import { useTranslation } from 'react-i18next';
import type { Client, Site } from '@/types';

interface NVRClientSiteRowProps {
  client?: Client;
  site?: Site;
  onNavigateClient: () => void;
}

export const NVRClientSiteRow: React.FC<NVRClientSiteRowProps> = ({
  client,
  site,
  onNavigateClient,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1.5,
        border: '1px solid',
        borderColor: 'rgba(0, 210, 180, 0.1)',
      }}
    >
      <CardContent sx={{ py: 1.25, px: 2, '&:last-child': { pb: 1.25 } }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}>
          {/* Client (right side in RTL) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}
            >
              {t('clients.client')}
            </Typography>
            <BusinessIcon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
            {client ? (
              <Link
                component="button"
                onClick={onNavigateClient}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textDecoration: 'none',
                  color: 'primary.main',
                  '&:hover': { textDecoration: 'underline' },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'start',
                }}
              >
                {client.name}
              </Link>
            ) : (
              <Typography variant="body2" color="text.secondary">{'\u2014'}</Typography>
            )}
          </Box>

          {/* Site (left side in RTL) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}
            >
              {t('tickets.site')}
            </Typography>
            <PlaceIcon sx={{ fontSize: 20, color: 'error.main', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                {site?.name || '\u2014'}
                {site?.address && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 1, fontSize: '0.8rem' }}
                  >
                    {site.address}{site.city ? `, ${site.city}` : ''}
                  </Typography>
                )}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default NVRClientSiteRow;
