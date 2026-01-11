# CRM Frontend (Internal MVP)

React + TypeScript + Vite frontend for the CRM system, with Hebrew RTL support.

## Features

- **Authentication**: Login with JWT tokens
- **Clients Management**: CRUD operations for clients, sites, and contacts
- **Tickets**: View tickets, details, work logs, and line items
- **Assets**: View assets, properties, and linked tickets
- **i18n**: Hebrew (default) and English support with RTL
- **RBAC**: Role-based access control integrated

## Tech Stack

- React 18
- TypeScript
- Vite
- Material-UI (MUI) with RTL support
- React Router v6
- TanStack Query (React Query)
- Axios
- i18next
- date-fns

## Prerequisites

- Node.js 18+ and npm
- Backend API running on `http://localhost:8000`

## Installation

```bash
cd frontend
npm install
```

## Configuration

The `.env` file has been created from `.env.example`:

```
VITE_API_BASE_URL=/api/v1
```

The Vite dev server proxies `/api` requests to `http://localhost:8000`.

## Running the Application

### Development Mode

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Start the backend** (from the project root):
   ```bash
   cd ..
   uvicorn app.main:app --reload
   ```

2. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Login**: Navigate to `http://localhost:3000/login`
   - Use your backend credentials (e.g., admin user)

4. **Navigate**:
   - `/clients` - List and manage clients
   - `/clients/:id` - Client details with sites and contacts
   - `/tickets` - View all tickets
   - `/tickets/:id` - Ticket details with events, work logs, line items
   - `/assets` - View all assets
   - `/assets/:id` - Asset details with properties and linked tickets

## API Endpoints Used

### Auth
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Clients
- `GET /api/v1/clients` - List clients
- `POST /api/v1/clients` - Create client
- `GET /api/v1/clients/:id` - Get client
- `PATCH /api/v1/clients/:id` - Update client

### Sites
- `GET /api/v1/clients/:clientId/sites` - List sites for client
- `POST /api/v1/clients/:clientId/sites` - Create site
- `GET /api/v1/clients/:clientId/sites/:siteId` - Get site
- `PATCH /api/v1/clients/:clientId/sites/:siteId` - Update site

### Contacts
- `GET /api/v1/clients/:clientId/contacts` - List contacts for client
- `POST /api/v1/clients/:clientId/contacts` - Create contact
- `GET /api/v1/clients/:clientId/contacts/:contactId` - Get contact
- `PATCH /api/v1/clients/:clientId/contacts/:contactId` - Update contact

### Tickets
- `GET /api/v1/tickets` - List tickets
- `GET /api/v1/tickets/:id` - Get ticket details
- `POST /api/v1/tickets/:id/work-logs` - Add work log
- `POST /api/v1/tickets/:id/line-items` - Add line item

### Assets
- `GET /api/v1/assets` - List assets
- `GET /api/v1/assets/:id` - Get asset details with properties

## Missing/Assumed Endpoints

If the following endpoints don't exist in the backend, the UI will handle gracefully:

- **Delete operations**: The UI doesn't implement delete for clients/sites/contacts (use deactivate via `is_active` field instead)
- **Asset type list**: If `/api/v1/asset-types` doesn't exist, asset type will display as code
- **Ticket status names**: If status endpoints are missing, shows status_id directly

## Language Switching

Click on the user menu (top right) and select "עברית" or "English" to switch languages.

## RTL Support

The app is configured for RTL by default:
- `document.dir = 'rtl'` set in `main.tsx`
- MUI theme configured with `direction: 'rtl'`
- JSS configured with RTL plugin
- All layouts work correctly in RTL mode

## Project Structure

```
src/
├── api/              # API client modules
├── components/       # React components
│   ├── Layout/
│   ├── Clients/
│   ├── Tickets/
│   └── Assets/
├── pages/            # Page components
├── contexts/         # React contexts (Auth)
├── hooks/            # Custom hooks
├── i18n/             # Translations (he.json, en.json)
├── types/            # TypeScript types
├── App.tsx           # Main app with routing
├── main.tsx          # Entry point
└── theme.ts          # MUI theme config
```

## Notes

- Admin role required for creating/updating clients
- Internal users can see all data; client users see only their own data (RBAC enforced by backend)
- All forms validate required fields
- Error messages display from backend API responses
- JWT token stored in localStorage (OK for internal MVP)

## Troubleshooting

### API Connection Issues

If you see connection errors:
1. Verify backend is running on `http://localhost:8000`
2. Check Vite proxy configuration in `vite.config.ts`
3. Ensure CORS is enabled on backend

### RTL Issues

If RTL doesn't apply:
1. Check `document.dir` is set to 'rtl' in browser inspector
2. Verify theme.direction is 'rtl'
3. Clear browser cache

### Authentication Errors

If login fails:
1. Check backend logs for authentication errors
2. Verify credentials are correct
3. Check JWT token is being sent in Authorization header

## Future Enhancements (Out of MVP Scope)

- Create new tickets from UI
- Create new assets from UI
- Attachment uploads
- Advanced filtering and search
- Pagination for large datasets
- Ticket status management UI
- Asset property editing
- Reports and dashboards
