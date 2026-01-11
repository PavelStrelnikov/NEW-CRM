import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import DevicesIcon from '@mui/icons-material/Devices';
import FolderIcon from '@mui/icons-material/Folder';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

const DRAWER_WIDTH = 240;

interface SidebarProps {
  open: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const menuItems = [
    { label: t('nav.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { label: t('nav.clients'), icon: <PeopleIcon />, path: '/clients' },
    { label: t('nav.tickets'), icon: <ConfirmationNumberIcon />, path: '/tickets' },
    { label: t('nav.assets'), icon: <DevicesIcon />, path: '/assets' },
    { label: t('nav.projects'), icon: <FolderIcon />, path: '/projects' },
    { label: t('nav.reports'), icon: <AssessmentIcon />, path: '/reports' },
    { label: t('nav.admin'), icon: <AdminPanelSettingsIcon />, path: '/admin' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    if (onClose) {
      onClose();
    }
  };

  const drawerContent = (
    <>
      <Toolbar sx={{ minHeight: 64 }} />
      <Box sx={{ px: 1, py: 2 }}>
        <List sx={{ px: 0 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={location.pathname.startsWith(item.path)}
                onClick={() => handleNavigate(item.path)}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: location.pathname.startsWith(item.path) ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
      open={open}
    >
      {drawerContent}
    </Drawer>
  );
};
