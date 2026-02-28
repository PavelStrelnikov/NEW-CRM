import React from 'react';
import { Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface BackButtonProps {
  /** Fallback-путь, если нет истории навигации (прямой заход по URL). */
  fallbackPath: string;
  /** Компактный режим (только иконка, без текста). По умолчанию false. */
  iconOnly?: boolean;
}

/**
 * Универсальная кнопка «Назад».
 *
 * - По умолчанию: navigate(-1) — возвращает на реальную предыдущую страницу
 *   с сохранением фильтров, query-параметров и скролла.
 * - Fallback: если пользователь зашёл на страницу напрямую (нет истории),
 *   переходит на fallbackPath.
 * - RTL: иконка автоматически переворачивается для иврита.
 */
export const BackButton: React.FC<BackButtonProps> = ({ fallbackPath, iconOnly = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  const handleBack = () => {
    // Приоритет: явный state.from → history back → fallbackPath
    const from = (location.state as any)?.from;
    if (from) {
      // Источник перехода передан явно — гарантированный возврат
      navigate(from);
    } else if (location.key !== 'default') {
      // Есть история SPA — вернуться на предыдущую страницу
      navigate(-1);
    } else {
      // Прямой заход по URL — fallback
      navigate(fallbackPath);
    }
  };

  const iconSx = { transform: isRTL ? 'rotate(180deg)' : 'none' };

  if (iconOnly) {
    return (
      <IconButton onClick={handleBack} size="small">
        <ArrowBackIcon sx={iconSx} />
      </IconButton>
    );
  }

  return (
    <Button
      size="small"
      startIcon={<ArrowBackIcon sx={iconSx} />}
      onClick={handleBack}
      sx={{ minWidth: 'auto' }}
    >
      {t('app.back')}
    </Button>
  );
};

export default BackButton;
