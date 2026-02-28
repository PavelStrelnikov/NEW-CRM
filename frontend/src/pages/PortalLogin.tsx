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
import { Business } from '@mui/icons-material';
import { portalAuthApi } from '@/api/auth';
import { logger } from '@/utils/logger';

export const PortalLogin: React.FC = () => {
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
      const response = await portalAuthApi.login({ email, password });

      // Store token
      localStorage.setItem('access_token', response.access_token);

      // Get user info
      const user = await portalAuthApi.getCurrentUser();

      // Verify this is actually a portal user
      if (user.user_type === 'internal') {
        setError('This login page is for client users only. Please use the admin login.');
        localStorage.removeItem('access_token');
        setIsLoading(false);
        return;
      }

      // Redirect to portal area - force reload to update AuthContext
      window.location.href = '/portal/tickets';
    } catch (err: any) {
      logger.error('Portal login error:', err);
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
              <Business color="primary" sx={{ fontSize: 40 }} />
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
                label="Client Portal"
                color="secondary"
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
              Login for client administrators and users
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
                {isLoading ? t('app.loading') : 'Login to Portal'}
              </Button>
            </form>

            <Box mt={3} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                Are you an admin?{' '}
                <a href="/admin/login" style={{ color: 'inherit', fontWeight: 500 }}>
                  Go to Admin Login
                </a>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};
