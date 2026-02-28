import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import { InternalUser, InternalUserCreate, InternalUserUpdate } from '@/types';

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user?: InternalUser;
}

export const UserForm: React.FC<UserFormProps> = ({ open, onClose, onSuccess, user }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<Partial<InternalUserCreate>>({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'technician',
    is_active: true,
    preferred_locale: 'he',
  });

  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        is_active: user.is_active,
        preferred_locale: user.preferred_locale || 'he',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'technician',
        is_active: true,
        preferred_locale: 'he',
      });
      setConfirmPassword('');
    }
    setError(null);
  }, [user, open]);

  const createMutation = useMutation({
    mutationFn: (data: InternalUserCreate) => usersApi.createInternalUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internalUsers'] });
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || err.message || t('app.error'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InternalUserUpdate }) =>
      usersApi.updateInternalUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internalUsers'] });
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || err.message || t('app.error'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      // Creating new user - password is required
      if (!formData.password) {
        setError(t('users.password') + ' is required');
        return;
      }
      if (formData.password !== confirmPassword) {
        setError(t('users.passwordMismatch'));
        return;
      }
      createMutation.mutate(formData as InternalUserCreate);
    } else {
      // Updating user - password is optional
      const updateData: InternalUserUpdate = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role as 'admin' | 'technician' | 'office',
        is_active: formData.is_active,
        preferred_locale: formData.preferred_locale,
      };
      updateMutation.mutate({ id: user.id, data: updateData });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {user ? t('users.editUser') : t('users.addUser')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <TextField
              label={t('users.name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />

            <TextField
              label={t('users.email')}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              fullWidth
            />

            <TextField
              label={t('users.phone')}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
            />

            <FormControl fullWidth required>
              <InputLabel>{t('users.role')}</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'technician' | 'office' })}
                label={t('users.role')}
              >
                <MenuItem value="admin">{t('users.roleAdmin')}</MenuItem>
                <MenuItem value="technician">{t('users.roleTechnician')}</MenuItem>
                <MenuItem value="office">{t('users.roleOffice')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t('users.preferredLocale')}</InputLabel>
              <Select
                value={formData.preferred_locale}
                onChange={(e) => setFormData({ ...formData, preferred_locale: e.target.value })}
                label={t('users.preferredLocale')}
              >
                <MenuItem value="he">עברית</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </Select>
            </FormControl>

            {!user && (
              <>
                <TextField
                  label={t('users.password')}
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  fullWidth
                />

                <TextField
                  label={t('users.confirmPassword')}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  fullWidth
                />
              </>
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label={t('users.isActive')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('app.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {t('app.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
