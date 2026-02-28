# CRM-система для IT-сервисных компаний

## Назначение

CRM-система, разработанная для IT-сервисных компаний, которые обслуживают системы видеонаблюдения (CCTV), сетевую инфраструктуру и общее IT-оборудование. Система предназначена для управления клиентами, тикетами (заявками), активами (оборудованием), проектами и отчётами.

Основной язык интерфейса — **иврит (RTL)**, также поддерживается английский.

---

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Пользователи                         │
│   Внутренние сотрудники    |    Клиенты (портал)        │
└──────────────┬─────────────┴──────────┬─────────────────┘
               │                        │
     /admin/login               /portal/login
               │                        │
┌──────────────▼────────────────────────▼─────────────────┐
│              Frontend (React 18 + Vite)                  │
│     http://localhost:3000                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Admin Layout        │  Portal Layout           │    │
│  │  - Dashboard         │  - Тикеты                │    │
│  │  - Клиенты           │  - Активы                │    │
│  │  - Тикеты            │  - Клиенты (свои)        │    │
│  │  - Активы            │                          │    │
│  │  - Пользователи      │                          │    │
│  │  - Отчёты            │                          │    │
│  └─────────────────────────────────────────────────┘    │
│  Vite Proxy: /api → backend:8000                        │
└──────────────┬──────────────────────────────────────────┘
               │ HTTP / WebSocket
┌──────────────▼──────────────────────────────────────────┐
│              Backend (FastAPI + Uvicorn)                  │
│     http://localhost:8000                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  72+ REST API эндпоинтов                        │    │
│  │  25 модулей маршрутов                           │    │
│  │  JWT аутентификация + RBAC                      │    │
│  │  10 SQLAlchemy моделей                          │    │
│  │  16 Pydantic схем                               │    │
│  │  6 сервисных модулей                            │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────┬──────────────────────────────────────────┘
               │ SQLAlchemy + psycopg3
┌──────────────▼──────────────────────────────────────────┐
│              PostgreSQL 16 (Docker)                       │
│     localhost:5432                                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  База: crm_db                                   │    │
│  │  24+ таблиц, 27 миграций Alembic                │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Технологический стек

### Backend
| Технология | Версия | Назначение |
|-----------|--------|------------|
| Python | 3.12+ | Язык программирования |
| FastAPI | 0.115+ | Веб-фреймворк (асинхронный) |
| Uvicorn | 0.30+ | ASGI-сервер |
| SQLAlchemy | 2.x | ORM |
| psycopg3 | 3.2+ | PostgreSQL драйвер |
| Alembic | 1.13+ | Миграции БД |
| Pydantic | 2.9+ | Валидация данных, DTO |
| python-jose | 3.3+ | JWT токены |
| passlib + bcrypt | 1.7+ | Хеширование паролей |
| cryptography (Fernet) | — | Шифрование секретов |
| pandas + openpyxl | 2.2+ | Экспорт отчётов (CSV, Excel) |
| cachetools | 5.3+ | TTL-кеширование отчётов |
| Faker | 28+ | Генерация демо-данных |
| httpx | 0.27+ | HTTP-клиент для интеграций |
| pytest | 9+ | Тестирование |

### Frontend
| Технология | Версия | Назначение |
|-----------|--------|------------|
| React | 18.3 | UI-фреймворк |
| TypeScript | 5.5 | Типизация |
| Vite | 5.3 | Сборка и dev-сервер |
| Material-UI (MUI) | 5.15 | UI-компоненты |
| React Router | 6.22 | Маршрутизация |
| React Query (TanStack) | 5.20 | Серверный стейт |
| Axios | 1.6 | HTTP-клиент |
| i18next | 23.8 | Локализация (иврит/английский) |
| Emotion | — | CSS-in-JS |
| jss-rtl / stylis-plugin-rtl | — | RTL-поддержка |
| date-fns | 3.3 | Работа с датами |
| Playwright | 1.57 | E2E-тестирование |

### Инфраструктура
| Технология | Назначение |
|-----------|------------|
| PostgreSQL 16 | Основная БД (Docker) |
| Docker Compose | Контейнеризация PostgreSQL + pgAdmin |
| pgAdmin 4 | GUI управления БД |
| mkcert | Локальные SSL-сертификаты для LAN-разработки |

---

## Основные модули и функциональность

### 1. Управление клиентами (Clients)
- CRUD для клиентов с пагинацией и поиском
- **Объекты (Sites)** — филиалы/площадки клиента (1-N)
- **Контакты (Contacts)** — контактные лица клиента (M2M с объектами)
- **Локации (Locations)** — конкретные помещения на объекте (здание/этаж/комната)
- Статусы: active, inactive

### 2. Тикеты/Заявки (Tickets)
- Полный жизненный цикл: NEW → IN_PROGRESS → WAITING_CUSTOMER → RESOLVED → CLOSED
- **Инициатор** — кто создал тикет (с паттерном полиморфного актора)
- **Контактное лицо** — кому перезвонить (может отличаться от инициатора)
- Приоритеты: low, normal, high, urgent
- Категории: CCTV, Network, PC, Alarm, Other
- Каналы создания: portal, email, whatsapp, telegram, manual, api
- **Автоматическое назначение** техников
- **История назначений** с причинами
- Привязка к активам (оборудованию)
- Аудит всех изменений через TicketEvent

### 3. Учёт рабочего времени (Work Logs)
- Типы работ: phone, email, whatsapp, remote, onsite, travel, repair_lab, admin, other
- Гибкое время: `start_at + end_at` ИЛИ `duration_minutes`
- Биллинг: `included_in_service` — входит ли в абонентскую плату

### 4. Материалы и оборудование (Line Items)
- Типы: material, equipment, service, other
- Количество, единицы измерения
- Признаки: `included_in_service`, `chargeable`
- Привязка к конкретному активу (`linked_asset_id`)

### 5. Активы/Оборудование (Assets)
- **Типы**: NVR, DVR, ROUTER, SWITCH, ACCESS_POINT, PC, SERVER, PRINTER, ALARM, OTHER
- **Динамические свойства** — EAV-паттерн (Entity-Attribute-Value):
  - `AssetPropertyDefinition` — схема полей для каждого типа оборудования
  - `AssetPropertyValue` — фактические значения с типизированными столбцами
  - 55+ определений свойств для различных типов
- **Типы данных свойств**: string, int, bool, date, enum, decimal, secret
- **Видимость свойств**: internal_only, client_admin, client_all
- **Секреты** — пароли устройств шифруются Fernet (AES-128-CBC)
- **Мониторинг здоровья** — health_status (ok, warning, critical, unknown)
- **NVR-специфичное**:
  - Диски (NVRDisk) с SMART-данными
  - Каналы (NVRChannel) с состоянием записи
- Статусы: active, in_repair, replaced, retired

### 6. Проекты (Projects)
- Привязка к клиенту
- Связь с тикетами, активами, объектами (M2M)
- Статусы: planned, active, on_hold, completed, canceled
- Аудит через ProjectEvent

### 7. Отчёты (Reports)
- 7 типов отчётов: тикеты, рабочее время, клиенты, активы, техники, материалы, сводный
- Фильтрация по датам и клиентам
- Экспорт в **CSV** и **Excel** (с автонастройкой ширины столбцов)
- **TTL-кеш** (5 минут) с учётом RBAC-контекста

### 8. Вложения/Файлы (Attachments)
- Загрузка файлов к тикетам, активам, проектам, объектам, клиентам
- Превью изображений и PDF
- Раздельный доступ для внутренних и портальных пользователей

### 9. Аудит (Audit Trail)
- Таблица `AuditEvent` — кто, что, когда изменил
- Полиморфный актор: internal_user, client_user, external_identity, integration
- Сохранение old/new значений (JSON)

---

## Интеграции

### Hikvision ISAPI
- Пробирование устройств (NVR/DVR/камеры)
- Автосохранение результатов в свойства активов
- Синхронизация времени с устройством
- Снимки с каналов камер
- Мониторинг SMART-данных дисков NVR
- Поддержка Windows и Linux (SDK-библиотеки)

### OCR (Распознавание этикеток)
- Сканирование этикеток оборудования через камеру
- Google Gemini API для распознавания
- Извлечение: модель, серийный номер, MAC-адрес и т.д.
- Библиотека в `ocr-lib/`

### Speech-to-Text (Речь-в-текст)
- Сервис в `tools/spt/`
- Преобразование голосовых заметок в описания work log
- Отдельный FastAPI-сервис на порту 8001

---

## Система ролей и доступа (RBAC)

### Внутренние пользователи (`internal_users`)

| Роль | Описание | Основные права |
|------|----------|----------------|
| **admin** | Администратор | Полный доступ ко всему |
| **technician** | Техник | Тикеты (свои), активы (просмотр + редактирование) |
| **office** | Офис-менеджер | Клиенты, тикеты (создание), ограниченный доступ |

### Портальные пользователи (`client_users`)

| Роль | Описание | Основные права |
|------|----------|----------------|
| **client_admin** | Админ клиента | Полный доступ к данным своих клиентов |
| **client_contact** | Контакт клиента | Просмотр тикетов и активов своего клиента |
| **client_user** | Пользователь портала | Ограниченный доступ только к своим объектам |

### Ключевые принципы безопасности
- JWT-аутентификация с настраиваемым сроком жизни токена (30 мин по умолчанию)
- Раздельные таблицы и эндпоинты для внутренних и портальных пользователей
- Фильтрация данных на уровне API (клиенты видят только свои данные)
- Контроль видимости свойств активов (internal_only → client_admin → client_all)
- Шифрование секретных свойств (пароли устройств)
- Маскирование чувствительных данных в логах

---

## Структура базы данных

### Основные таблицы (24+)

```
Пользователи:
  internal_users          — Внутренние сотрудники
  client_users            — Портальные пользователи
  client_user_sites       — Доступ к объектам (M2M)
  client_user_clients     — Доступ к клиентам (M2M)

Клиенты:
  clients                 — Клиенты
  sites                   — Объекты/площадки
  contacts                — Контактные лица
  contact_site_links      — Привязка контактов к объектам (M2M)
  locations               — Локации (здание/этаж/комната)

Тикеты:
  ticket_status_definitions — Определения статусов
  ticket_category_definitions — Определения категорий
  tickets                 — Тикеты
  ticket_initiators       — Инициаторы тикетов
  ticket_events           — Аудит тикетов
  ticket_assignment_history — История назначений
  work_logs               — Учёт рабочего времени
  ticket_line_items       — Материалы/оборудование
  ticket_asset_links      — Привязка тикетов к активам (M2M)

Активы:
  asset_types             — Типы оборудования
  assets                  — Оборудование
  asset_property_definitions — Определения свойств (EAV)
  asset_property_values   — Значения свойств (EAV)
  asset_events            — Аудит активов
  nvr_disks               — Диски NVR
  nvr_channels            — Каналы NVR

Проекты:
  projects                — Проекты
  project_events          — Аудит проектов
  project_ticket_links    — Тикеты проекта (M2M)
  project_asset_links     — Активы проекта (M2M)
  project_site_links      — Объекты проекта (M2M)

Прочее:
  attachments             — Вложенные файлы
  audit_events            — Общий аудит
  internet_providers      — Интернет-провайдеры
```

---

## Структура проекта (файловая система)

```
New-CRM/
├── backend/                         # Python FastAPI backend
│   ├── app/
│   │   ├── main.py                  # Точка входа FastAPI
│   │   ├── config.py                # Pydantic Settings
│   │   ├── guards.py                # JWT декодирование + claims
│   │   ├── rbac.py                  # Проверки ролей и прав
│   │   ├── api/                     # 25 модулей маршрутов
│   │   │   ├── auth.py              # Аутентификация
│   │   │   ├── clients.py           # Клиенты
│   │   │   ├── tickets.py           # Тикеты
│   │   │   ├── assets.py            # Активы
│   │   │   ├── reports.py           # Отчёты
│   │   │   ├── hikvision.py         # Hikvision интеграция
│   │   │   ├── portal_*.py          # Портальные эндпоинты
│   │   │   └── ...
│   │   ├── models/                  # 10 SQLAlchemy моделей
│   │   ├── schemas/                 # 16 Pydantic схем
│   │   ├── services/                # 6 бизнес-сервисов
│   │   ├── auth/                    # Модуль аутентификации
│   │   ├── db/                      # Подключение к БД
│   │   ├── utils/                   # Утилиты (крипто, логи, кеш, экспорт)
│   │   └── integrations/            # Hikvision SDK
│   ├── alembic/                     # 27 миграций
│   ├── scripts/                     # Утилиты (seed, cleanup)
│   ├── tests/                       # 157 тестов (unit + integration)
│   ├── requirements.txt             # Python зависимости
│   ├── pytest.ini                   # Конфигурация тестов
│   └── .env                         # Переменные окружения backend
│
├── frontend/                        # React TypeScript frontend
│   ├── src/
│   │   ├── App.tsx                  # Корневой компонент (роутинг)
│   │   ├── main.tsx                 # Точка входа React
│   │   ├── api/                     # 15 API-модулей (Axios)
│   │   ├── pages/                   # 14 страниц
│   │   ├── components/              # 60+ компонентов
│   │   │   ├── Assets/              # NVR, Router, Switch, AP views
│   │   │   ├── Clients/             # Клиенты, объекты, контакты
│   │   │   ├── Tickets/             # Тикеты, work logs, файлы
│   │   │   ├── Users/               # Управление пользователями
│   │   │   ├── Layout/              # Layouts, guards, sidebar
│   │   │   └── Common/              # Переиспользуемые компоненты
│   │   ├── contexts/                # 5 React-контекстов
│   │   ├── hooks/                   # 4 кастомных хука
│   │   ├── utils/                   # 8 утилитных модулей
│   │   ├── i18n/                    # Локализация (en.json, he.json)
│   │   ├── types/                   # TypeScript типы
│   │   └── theme/                   # MUI тема
│   ├── package.json                 # NPM зависимости
│   ├── vite.config.ts               # Vite + прокси + HTTPS
│   ├── tsconfig.json                # TypeScript конфигурация
│   └── .env                         # Frontend переменные
│
├── docs/                            # Документация
│   ├── spec/                        # 12 спецификаций
│   ├── guides/                      # Руководства (frontend, RTL, production)
│   ├── dev-notes/                   # 26 заметок разработки
│   ├── summaries/                   # Резюме шагов реализации
│   └── project/                     # Снимок состояния проекта
│
├── ocr-lib/                         # Библиотека OCR (этикетки оборудования)
├── ocr-spike/                       # Прототип OCR
├── tools/spt/                       # Speech-to-Text сервис
├── certs/                           # SSL-сертификаты (mkcert)
├── CRM-Claude-Agents/               # Конфигурации Claude AI агентов
│
├── docker-compose.yml               # PostgreSQL + pgAdmin
├── .env                             # Основные переменные окружения
├── .gitignore                       # Git ignore
├── CLAUDE.md                        # Инструкции для Claude Code
└── README.md                        # Основная документация (англ.)
```

---

## Переменные окружения

### Корневой `.env` (используется backend)
```env
DATABASE_URL=postgresql+psycopg://crm_user:crm_password@localhost:5432/crm_db
JWT_SECRET_KEY=<секретный ключ для JWT>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True
CLIENT_ADMIN_CAN_VIEW_SECRETS=False
TECHNICIAN_CAN_EDIT_SECRETS=True
```

### `backend/.env`
```env
DATABASE_URL=postgresql+psycopg://crm_user:crm_password@localhost:5432/crm_db
JWT_SECRET_KEY=<секретный ключ>
DEBUG=True
LOG_LEVEL=INFO
ENCRYPTION_KEY=<Fernet ключ для шифрования>  # обязателен в production
GEMINI_API_KEY=<Google Gemini API ключ>       # для OCR
```

### `frontend/.env`
```env
VITE_API_BASE_URL=/api/v1
VITE_SPT_API_URL=/spt-api
```

---

## Порядок запуска

### Быстрый старт (все команды)

```bash
# 1. БД
cd c:\Users\Pavel\DEV\Claude\New-CRM
docker compose up -d

# 2. Backend
cd backend
pip install -r requirements.txt      # только при первом запуске
alembic upgrade head                  # применить миграции
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Frontend (в другом терминале)
cd frontend
npm install                           # только при первом запуске
npm run dev
```

### Проверка работоспособности

| Проверка | URL | Ожидание |
|----------|-----|----------|
| API root | http://localhost:8000 | `{"message": "CRM System API"}` |
| Health | http://localhost:8000/health | `{"status": "healthy"}` |
| Swagger | http://localhost:8000/docs | Интерактивная документация |
| Frontend | http://localhost:3000 | Страница входа |
| pgAdmin | http://localhost:5050 | Интерфейс управления БД |

### Учётные данные по умолчанию

| Сервис | Логин | Пароль |
|--------|-------|--------|
| PostgreSQL | crm_user | crm_password |
| pgAdmin | admin@example.com | admin |
| Админ CRM | admin@example.com | change_me_now |
| Демо-пользователи | (см. seed) | password123 |

---

## Тестирование

```bash
# Все тесты
cd backend && pytest tests/ -v

# Только unit-тесты (быстро, < 5 сек)
pytest tests/unit -v

# Интеграционные тесты
pytest tests/integration -v

# С покрытием
pytest --cov=app --cov-report=html tests/
```

**Текущий результат**: 157 тестов, 100% проходят.

---

## Миграции БД

```bash
cd backend

# Применить все миграции
alembic upgrade head

# Создать новую миграцию
alembic revision --autogenerate -m "описание"

# Откатить последнюю миграцию
alembic downgrade -1

# Посмотреть текущую версию
alembic current
```

---

## Ключевые архитектурные решения

### 1. Полиморфный актор (Actor Pattern)
Все аудит-поля используют единую структуру:
- `actor_type` — тип актора (internal_user, client_user, external_identity, integration)
- `actor_id` — UUID актора (nullable)
- `actor_display` — денормализованное имя для отображения

### 2. Двойная таблица пользователей
- `internal_users` — сотрудники компании (admin/technician/office)
- `client_users` — внешние пользователи портала (client_admin/client_contact/client_user)
- Раздельные JWT, раздельные API-эндпоинты

### 3. EAV для динамических свойств
Оборудование разных типов имеет разный набор свойств без изменения схемы БД:
- `asset_property_definitions` — какие поля есть у типа
- `asset_property_values` — конкретные значения с типизированными столбцами

### 4. Трёхуровневый биллинг
- Тикет: `service_scope` (included/not_included/mixed)
- Работа: `included_in_service` (bool)
- Материал: `included_in_service` + `chargeable` (bool)

### 5. Инициатор vs Контакт
Каждый тикет разделяет:
- **Инициатор** — кто создал заявку
- **Контакт** — кому перезвонить (может быть другим человеком)

---

## Текущий статус проекта

**Завершено: Шаг 8 из запланированных шагов**

- Шаг 1: Репозиторий + БД
- Шаг 2: Миграции + Seed-данные
- Шаг 3: Аутентификация + RBAC
- Шаг 4: CRUD клиентов
- Шаг 5: Тикеты (полный цикл)
- Шаг 6: Активы (EAV + динамические свойства)
- Шаг 7: Отчёты
- Шаг 8: Production Hardening (кеш + экспорт)

**Frontend**: полнофункциональный SPA с 14 страницами, 60+ компонентами, поддержкой RTL, тёмной темой, адаптивным дизайном.

**Не реализовано** (MVP scope — excluded):
- Бухгалтерия / выставление счетов
- Мобильное приложение
- Бот-интеграции (только фундамент в модели данных)
- Scheduled reports (запланированные отчёты)

---

*Документ создан: 2026-02-19*
*Последнее обновление: 2026-02-19*
