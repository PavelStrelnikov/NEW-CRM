/**
 * ClientSelector: Dropdown component for CLIENT_ADMIN users to switch between assigned clients.
 *
 * Behavior:
 * - Shows current client name only if user has single client
 * - Shows dropdown selector if user has multiple clients
 * - Calls switchClient() which reloads the page with new token
 */

import React from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  Typography,
  Box,
  CircularProgress,
  SelectChangeEvent
} from '@mui/material';
import { Business } from '@mui/icons-material';
import { useClientSelector } from '../../contexts/ClientSelectorContext';
import { useTranslation } from 'react-i18next';

export const ClientSelector: React.FC = () => {
  const { t } = useTranslation();
  const {
    activeClientId,
    availableClients,
    canSwitchClients,
    switchClient,
    isLoading
  } = useClientSelector();

  const handleChange = async (event: SelectChangeEvent<string>) => {
    const newClientId = event.target.value;
    if (newClientId !== activeClientId) {
      try {
        await switchClient(newClientId);
      } catch (error) {
        console.error('Failed to switch client:', error);
        // Error handling is done in the context
      }
    }
  };

  // Find active client name
  const activeClient = availableClients.find(c => c.id === activeClientId);
  const activeClientName = activeClient?.name || t('common.loading');

  // If user can't switch clients (single client or not CLIENT_ADMIN), show name only
  if (!canSwitchClients) {
    return (
      <Box display="flex" alignItems="center" gap={1} px={2}>
        <Business fontSize="small" color="action" />
        <Typography variant="body2" color="text.secondary">
          {activeClientName}
        </Typography>
      </Box>
    );
  }

  // Multi-client CLIENT_ADMIN: show dropdown
  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <Select
        value={activeClientId || ''}
        onChange={handleChange}
        disabled={isLoading}
        startAdornment={
          <Box display="flex" alignItems="center" mr={1}>
            {isLoading ? (
              <CircularProgress size={16} />
            ) : (
              <Business fontSize="small" color="action" />
            )}
          </Box>
        }
        sx={{
          '& .MuiSelect-select': {
            py: 1,
            display: 'flex',
            alignItems: 'center'
          }
        }}
      >
        {availableClients.map((client) => (
          <MenuItem key={client.id} value={client.id}>
            {client.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
