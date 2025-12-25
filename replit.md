# Survey Case Scheduling System (測量案件排程系統)

## Overview

A professional utility application for managing land survey case scheduling in Taiwan. The system helps surveying teams track cases, manage appointments, and automatically lookup geographic coordinates for land parcels. Primary language is Traditional Chinese with bilingual support.

Key features:
- Survey case management (create, edit, delete, list)
- Automatic coordinate lookup from Taiwan NLSC and Miaoli GIS services
- Surveyor assignment and scheduling
- Search and filtering capabilities
- Light/dark theme support

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **UI Components**: Shadcn UI (New York style) with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/`
- Feature components in `client/src/components/`
- Custom hooks in `client/src/hooks/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Style**: RESTful JSON API
- **Database ORM**: Drizzle ORM with PostgreSQL

The backend uses a simple layered architecture:
- Routes defined in `server/routes.ts`
- Storage/data access in `server/storage.ts`
- Database connection in `server/db.ts`
- Background services (coordinate lookup) in `server/coordinate-service.ts`

### Data Storage
- **Database**: PostgreSQL
- **Schema**: Defined in `shared/schema.ts` using Drizzle ORM
- **Migrations**: Managed via `drizzle-kit push`

Main tables:
- `survey_cases`: Stores survey appointments with case numbers, land parcels, surveyors, dates, and coordinates
- `users`: User accounts (prepared for future authentication)

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- Database schema definitions
- Zod validation schemas
- TypeScript types

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable

### External APIs (Simulated)
- **NLSC (National Land Surveying and Mapping Center)**: Taiwan land parcel coordinate lookup
- **Miaoli GIS**: Regional GIS service for Miaoli County coordinates

Note: Coordinate lookup is currently simulated with random data. Production implementation would require actual API integration.

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `@tanstack/react-query`: Async state management
- `react-hook-form` / `@hookform/resolvers`: Form handling
- `zod` / `drizzle-zod`: Schema validation
- `date-fns`: Date formatting and manipulation
- `wouter`: Client-side routing
- Radix UI primitives: Accessible UI components

### Fonts
- **Noto Sans TC**: Primary font for Chinese text (Google Fonts)
- **Inter**: Secondary font for English/numbers (Google Fonts)