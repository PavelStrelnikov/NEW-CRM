import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Edit as EditIcon,
  MoreVert as MoreIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usersApi } from '@/api/users';
import { InternalUser } from '@/types';
import { UserForm } from './UserForm';

export const InternalUsersList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<InternalUser | null>(null);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (roleFilter) params.role = roleFilter;
    setSearchParams(params);
  }, [searchQuery, roleFilter, setSearchParams]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['internalUsers', searchQuery, roleFilter],
    queryFn: () => usersApi.listInternalUsers({
      q: searchQuery,
      role: roleFilter || undefined,
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      usersApi.updateInternalUser(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internalUsers'] });
      handleCloseMenu();
    },
  });

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, user: InternalUser) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleToggleActive = () => {
    if (selectedUser) {
      const confirmMessage = selectedUser.is_active
        ? t('users.confirmDeactivate')
        : t('users.confirmActivate');

      if (window.confirm(confirmMessage)) {
        updateMutation.mutate({
          id: selectedUser.id,
          is_active: !selectedUser.is_active,
        });
      }
    }
    handleCloseMenu();
  };

  const handleEdit = () => {
    if (selectedUser) {
      setEditingUser(selectedUser);
    }
    handleCloseMenu();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'technician':
        return 'primary';
      case 'office':
        return 'info';
      default:
        return 'default';
    }
  };

  if (error) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any).message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">{t('users.title')}</Typography>
        <Button
          variant="contained"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          {t('users.addUser')}
        </Button>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          fullWidth
          placeholder={t('users.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>{t('users.role')}</InputLabel>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            label={t('users.role')}
          >
            <MenuItem value="">{t('app.filter')}</MenuItem>
            <MenuItem value="admin">{t('users.roleAdmin')}</MenuItem>
            <MenuItem value="technician">{t('users.roleTechnician')}</MenuItem>
            <MenuItem value="office">{t('users.roleOffice')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width="40">&nbsp;</TableCell>
                <TableCell>{t('users.name')}</TableCell>
                <TableCell>{t('users.email')}</TableCell>
                <TableCell>{t('users.phone')}</TableCell>
                <TableCell>{t('users.role')}</TableCell>
                <TableCell>{t('users.createdAt')}</TableCell>
                <TableCell align="center">{t('app.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    {t('users.noUsers')}
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell padding="checkbox">
                      <Tooltip title={user.is_active ? t('users.isActive') : t('clients.deactivate')} arrow>
                        <DotIcon
                          sx={{
                            fontSize: 16,
                            color: user.is_active ? '#4caf50' : '#f44336',
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={t(`users.role${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`)}
                        color={getRoleColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('he-IL', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingUser(user);
                        }}
                        title={t('app.edit')}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenMenu(e, user)}
                        title={t('app.actions')}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('app.loading')}: {data.items.length} / {data.total}
          </Typography>
        </Box>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          {t('app.edit')}
        </MenuItem>
        <MenuItem onClick={handleToggleActive}>
          {selectedUser?.is_active ? t('users.deactivate') : t('users.activate')}
        </MenuItem>
      </Menu>

      <UserForm
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          refetch();
        }}
      />

      {editingUser && (
        <UserForm
          open={true}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            refetch();
          }}
        />
      )}
    </Box>
  );
};
