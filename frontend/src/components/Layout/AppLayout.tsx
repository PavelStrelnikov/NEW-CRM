import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Drawer,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '@/hooks/useResponsive';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import MenuIcon from '@mui/icons-material/Menu';
import { useThemeMode } from '@/contexts/ThemeModeContext';
import { Sidebar } from './Sidebar';
import { ClientSelector } from '../Common/ClientSelector';

const DRAWER_WIDTH = 240;

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const { isMobile } = useResponsive();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(newLang);
    handleClose();
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ minHeight: 64 }}>
          {/* Mobile hamburger menu */}
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{
                mr: 2,
                color: 'text.primary',
              }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            {t('app.title')}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            <IconButton
              size="medium"
              aria-label="toggle theme"
              onClick={toggleTheme}
              sx={{
                color: 'text.primary',
              }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            {/* Client selector for portal users */}
            {user?.user_type === 'portal' && <ClientSelector />}
            {/* Hide username on mobile */}
            {!isMobile && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                }}
              >
                {user?.name}
              </Typography>
            )}
            <IconButton
              size="medium"
              aria-label="account menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              sx={{
                color: 'text.primary',
              }}
            >
              <AccountCircleIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              sx={{
                mt: 1,
              }}
            >
              {/* Show username in menu on mobile */}
              {isMobile && user?.name && (
                <MenuItem disabled sx={{ opacity: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {user.name}
                  </Typography>
                </MenuItem>
              )}
              <MenuItem onClick={toggleLanguage}>
                {i18n.language === 'he' ? 'English' : 'עברית'}
              </MenuItem>
              <MenuItem onClick={handleLogout}>{t('auth.logout')}</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile: Temporary drawer */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          anchor={i18n.dir() === 'rtl' ? 'right' : 'left'}
          open={mobileOpen}
          onClose={handleDrawerClose}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          <Sidebar open={mobileOpen} onClose={handleDrawerClose} />
        </Drawer>
      ) : (
        /* Desktop: Permanent sidebar */
        <Sidebar open={true} />
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isMobile ? '100%' : `calc(100% - ${DRAWER_WIDTH}px)`,
        }}
      >
        <Toolbar />
        <Box
          sx={{
            px: { xs: 2, sm: 3, md: 4 },
            py: { xs: 2, sm: 3 },
            maxWidth: '1600px',
            mx: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};
