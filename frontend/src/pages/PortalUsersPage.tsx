/**
 * Portal Users Management Page
 * For managing CLIENT_ADMIN, CLIENT_USER, and CLIENT_CONTACT users
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Add,
  Search,
  Business,
  Edit,
  Delete
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { portalUsersApi, PortalUser } from '../api/portalUsers';
import { ClientUserClientAssignments } from '../components/Users/ClientUserClientAssignments';
import { CreatePortalUserDialog } from '../components/Users/CreatePortalUserDialog';

export const PortalUsersPage: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<PortalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Manage Clients dialog state
  const [manageClientsDialogOpen, setManageClientsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PortalUser | null>(null);

  // Load portal users
  useEffect(() => {
    loadUsers();
  }, []);

  // Filter users when search or role filter changes
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        user =>
          user.email.toLowerCase().includes(query) ||
          user.name.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await portalUsersApi.list({ page_size: 1000 });
      setUsers(response.items);
      setFilteredUsers(response.items);
    } catch (err) {
      console.error('Failed to load portal users:', err);
      setError('Failed to load portal users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageClients = (user: PortalUser) => {
    setSelectedUser(user);
    setManageClientsDialogOpen(true);
  };

  const handleManageClientsClose = () => {
    setManageClientsDialogOpen(false);
    setSelectedUser(null);
  };

  const handleManageClientsSuccess = () => {
    // Reload users to get updated data
    loadUsers();
  };

  const handleCreateSuccess = (userId: string) => {
    // Reload users
    loadUsers();
    // Optionally open manage clients dialog for the new user
    // TODO: Could auto-open manage clients if role is CLIENT_ADMIN
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'CLIENT_ADMIN':
        return 'primary';
      case 'CLIENT_USER':
        return 'secondary';
      case 'CLIENT_CONTACT':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          {t('portalUsers.title', 'Portal Users')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
        >
          {t('portalUsers.createUser', 'Create Portal User')}
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2}>
          <TextField
            placeholder={t('common.search', 'Search by email or name...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
            sx={{ flexGrow: 1 }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>{t('portalUsers.role', 'Role')}</InputLabel>
            <Select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              label={t('portalUsers.role', 'Role')}
            >
              <MenuItem value="all">{t('common.all', 'All')}</MenuItem>
              <MenuItem value="CLIENT_ADMIN">CLIENT_ADMIN</MenuItem>
              <MenuItem value="CLIENT_USER">CLIENT_USER</MenuItem>
              <MenuItem value="CLIENT_CONTACT">CLIENT_CONTACT</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('portalUsers.email', 'Email')}</TableCell>
              <TableCell>{t('portalUsers.name', 'Name')}</TableCell>
              <TableCell>{t('portalUsers.role', 'Role')}</TableCell>
              <TableCell>{t('portalUsers.primaryClient', 'Primary Client')}</TableCell>
              <TableCell>{t('portalUsers.status', 'Status')}</TableCell>
              <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchQuery || roleFilter !== 'all'
                      ? t('common.noResults', 'No results found')
                      : t('portalUsers.noUsers', 'No portal users yet')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map(user => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      color={getRoleBadgeColor(user.role)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {/* TODO: Load and display client name */}
                    <Typography variant="body2" color="text.secondary">
                      {user.client_id.substring(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'Active' : 'Inactive'}
                      color={user.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={1} justifyContent="flex-end">
                      {user.role === 'CLIENT_ADMIN' && (
                        <Tooltip title={t('portalUsers.manageClients', 'Manage Clients')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleManageClients(user)}
                          >
                            <Business />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={t('common.edit', 'Edit')}>
                        <IconButton
                          size="small"
                          onClick={() => alert('Edit user - Coming next!')}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Portal User Dialog */}
      <CreatePortalUserDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Manage Clients Dialog */}
      {selectedUser && (
        <ClientUserClientAssignments
          open={manageClientsDialogOpen}
          onClose={handleManageClientsClose}
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          primaryClientId={selectedUser.client_id}
          onSuccess={handleManageClientsSuccess}
        />
      )}
    </Box>
  );
};
