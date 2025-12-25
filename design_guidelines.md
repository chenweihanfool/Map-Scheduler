# Design Guidelines: Survey Case Scheduling System (測量案件排程系統)

## Design Approach
**System-Based Approach**: Using Shadcn UI component library with clean, data-focused design principles. This is a professional utility application prioritizing efficiency, clarity, and data management over visual marketing.

## Core Design Principles
1. **Data First**: Maximize information density while maintaining readability
2. **Professional Clarity**: Clean, uncluttered interface suitable for government/surveying work
3. **Bilingual Support**: Traditional Chinese primary, with clear typographic hierarchy
4. **Quick Actions**: Minimize clicks for common tasks (add case, search, filter)

## Typography
**Font Families**:
- Primary (Chinese): Noto Sans TC via Google Fonts
- Secondary (English/Numbers): Inter via Google Fonts

**Hierarchy**:
- Page Headers: text-2xl font-semibold (32px)
- Section Headers: text-xl font-medium (24px)
- Table Headers: text-sm font-medium uppercase tracking-wide (14px)
- Body Text: text-base (16px)
- Form Labels: text-sm font-medium (14px)
- Table Data: text-sm (14px)
- Helper Text: text-xs text-muted-foreground (12px)

## Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, and 8 primarily
- Component padding: p-4 or p-6
- Section margins: mb-6 or mb-8
- Form field spacing: space-y-4
- Table cell padding: px-4 py-3
- Page container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8

**Grid Structure**:
- Form Layout: Single column on mobile, 2-column grid (grid-cols-2 gap-4) on desktop for field pairs
- Table: Full-width responsive with horizontal scroll on mobile

## Component Library

### Navigation
- **Top Navigation Bar**: Sticky header (sticky top-0 z-50) with system title, quick actions (+ New Case button), and user info
- **Breadcrumbs**: Secondary navigation showing current view (e.g., 首頁 > 排程表 > 新增案件)
- Height: h-16 for top nav

### Forms (New/Edit Case)
- **Container**: Card component with shadow-sm, rounded-lg, border
- **Input Fields**: Full-width with clear labels above, consistent height (h-10)
- **Required Fields**: Red asterisk (*) indicator
- **Field Groups**: Group related fields (land parcel info, surveyor details, dates) with subtle background (bg-muted/50)
- **Buttons**: 
  - Primary action (Submit/Save): Full button component, right-aligned
  - Secondary (Cancel): Outline variant, left of primary
  - Spacing between: gap-3

### Data Table (Main Scheduling Grid)
- **Table Style**: Traditional spreadsheet aesthetic with alternating row backgrounds (stripe pattern)
- **Headers**: Sticky headers (sticky top-16) with sort indicators, bold text
- **Columns**: 
  1. 案號 (Case #) - 120px
  2. 地段地號 (Parcel) - 200px min-width
  3. 測量員 (Surveyor) - 150px
  4. 日期 (Date) - 120px
  5. 排件時間 (Time) - 120px
  6. 座標 (Coordinates) - 180px
  7. 操作 (Actions) - 100px fixed
- **Row Actions**: Icon buttons for Edit/Delete (ghost variant, size-sm)
- **Status Indicators**: Badge component for coordinate fetch status (成功/失敗/處理中)
- **Empty State**: Centered message with icon when no data

### Filters & Search
- **Search Bar**: Prominent placement above table, full-width on mobile, max-w-md on desktop
- **Filter Panel**: Collapsible section with date pickers, dropdown for surveyor selection
- **Quick Filters**: Chip/badge buttons for common filters (今日、本週、未完成)

### Loading & Feedback
- **Coordinate Fetching**: Inline spinner next to parcel field during lookup
- **Toast Notifications**: Top-right positioned, auto-dismiss for success/error messages
- **Loading Overlay**: Semi-transparent overlay for table data refresh

## Visual Treatment
- **Cards**: border border-border rounded-lg shadow-sm
- **Inputs**: Standard height h-10, rounded-md border-input
- **Buttons**: rounded-md with consistent padding (px-4 py-2)
- **Table**: border-collapse with border-border, hover:bg-muted/50 on rows
- **Icons**: Use Heroicons (outline variant) via CDN, size-5 (20px) for most, size-4 for inline

## Responsive Behavior
- **Mobile (<768px)**: Stack form fields, horizontal scroll for table, collapsible filters
- **Tablet (768-1024px)**: 2-column form, visible table with some columns hidden
- **Desktop (>1024px)**: Full layout with all columns visible, optimized spacing

## Accessibility
- All form inputs have associated labels (htmlFor/id pairing)
- ARIA labels for icon-only buttons
- Keyboard navigation support for table rows and form fields
- Focus indicators on all interactive elements (ring-2 ring-ring)
- Sufficient contrast ratios (WCAG AA minimum)

## Animation Guidelines
**Minimal animations only**:
- Dropdown menus: transition-all duration-200
- Toast messages: Slide-in from top-right
- NO scroll animations, parallax, or decorative motion
- Loading spinners: Simple rotating icon

## Images
**No hero images required** - This is a business application, not a marketing site. Only functional elements needed.