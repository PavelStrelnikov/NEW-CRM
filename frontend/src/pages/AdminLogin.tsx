import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPanelSettings } from '@mui/icons-material';
import { adminAuthApi } from '@/api/adminAuth';
import { logger } from '@/utils/logger';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await adminAuthApi.login({ email, password });

      // Store token
      localStorage.setItem('access_token', response.access_token);

      // Get user info
      const user = await adminAuthApi.getCurrentUser();

      // Verify this is actually an internal user
      if (user.user_type !== 'internal') {
        setError('This login page is for internal administrators only. Please use the portal login.');
        localStorage.removeItem('access_token');
        setIsLoading(false);
        return;
      }

      // Redirect to admin area - force reload to update AuthContext
      window.location.href = '/admin/clients';
    } catch (err: any) {
      logger.error('Admin login error:', err);
      setError(err.response?.data?.detail || t('auth.loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 450 }}>
          <CardContent sx={{ p: 5 }}>
            <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2}>
              <AdminPanelSettings color="primary" sx={{ fontSize: 40 }} />
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 600 }}
              >
                {t('app.title')}
              </Typography>
            </Box>

            <Box display="flex" justifyContent="center" mb={3}>
              <Chip
                label="Admin Login"
                color="primary"
                size="small"
                sx={{ fontWeight: 500 }}
              />
            </Box>

            <Typography
              variant="body2"
              align="center"
              color="text.secondary"
              sx={{ mb: 4 }}
            >
              Internal administrators, technicians, and office staff
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label={t('auth.email')}
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                autoFocus
                autoComplete="email"
              />
              <TextField
                fullWidth
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{ mt: 3 }}
              >
                {isLoading ? t('app.loading') : 'Login as Admin'}
              </Button>
            </form>

            <Box mt={3} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                Are you a client user?{' '}
                <a href="/portal/login" style={{ color: 'inherit', fontWeight: 500 }}>
                  Go to Portal Login
                </a>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};
