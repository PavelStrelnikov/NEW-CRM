/**
 * Login Page - Redirect to appropriate login based on user type
 * This is a "router" page that helps users find the right login
 */
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Container,
  Stack,
  Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPanelSettings, Business } from '@mui/icons-material';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
        <Card sx={{ width: '100%', maxWidth: 500 }}>
          <CardContent sx={{ p: 5 }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              align="center"
              sx={{ fontWeight: 600, mb: 1 }}
            >
              {t('app.title')}
            </Typography>
            <Typography
              variant="body1"
              gutterBottom
              align="center"
              color="text.secondary"
              sx={{ mb: 5 }}
            >
              Choose your login type
            </Typography>

            <Stack spacing={3}>
              {/* Admin Login Button */}
              <Card
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.lighter',
                  },
                }}
                onClick={() => navigate('/admin/login')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <AdminPanelSettings color="primary" sx={{ fontSize: 40 }} />
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom>
                        Admin Login
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        For internal administrators, technicians, and office staff
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Divider>or</Divider>

              {/* Portal Login Button */}
              <Card
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'secondary.main',
                    bgcolor: 'secondary.lighter',
                  },
                }}
                onClick={() => navigate('/portal/login')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Business color="secondary" sx={{ fontSize: 40 }} />
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom>
                        Client Portal
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        For client administrators and users
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};
