# Calorie Tracker - Calorie Tracking App

A modern, mobile-first calorie tracking application with an opinionated design system featuring an Ice Blue theme.

## Features

### 🎨 Design System
- **Ice Blue Theme**: Beautiful primary color (#0ea5e9) with full dark mode support
- **Moderate Rounding**: 10px base border radius for a modern, comfortable feel
- **Semantic States**: Clear visual feedback for initial, loading, error, success, and disabled states
- **Gradient Hover Effects**: Subtle 600→700 color transitions on interactive elements
- **Mobile-First**: Optimized for mobile devices with responsive scaling

### 📱 Application Features
- **Authentication**: Simple login/signup flow
- **Dashboard**: 
  - Pie chart visualization of daily calorie intake
  - Rotating food suggestions
  - Collapsible meal sections (Breakfast, Lunch, Dinner)
  - Detailed nutritional information (calories, protein, carbs, fats)
- **Chat Interface**: 
  - Expandable food logging input
  - AI-powered food recognition (mock implementation)
  - Accept/reject flow for recognized foods
- **History**: 
  - Weekly calorie trends with line chart
  - Daily breakdown with progress indicators
  - Average vs goal tracking
- **Settings**: 
  - Dark mode toggle with persistence
  - Daily calorie goal customization
  - Profile information (weight, height)
- **Navigation**: 
  - Swipe gestures (left for history, right for settings)
  - Bottom navigation icons

## Design System Components

Located in `/src/app/components/ds/`:

- **Button**: Primary, secondary, success, destructive, outline, and ghost variants
- **Input**: Text inputs with success/error states
- **Card**: Container components with header, content, and footer
- **LinkButton**: React Router links styled as buttons
- **Badge**: Small labels for tags and status indicators
- **Spinner**: Loading indicators in multiple sizes

View the full design system documentation at `/design-system` route.

## Tech Stack

- **React 18** with TypeScript
- **React Router** for navigation
- **Tailwind CSS v4** for styling
- **Motion** (Framer Motion) for animations
- **Recharts** for data visualization
- **Lucide React** for icons

## Project Structure

```
/src
  /app
    /components
      /ds              # Design system components
      /figma           # Figma integration utilities
      /ui              # Pre-built UI components
      CaloriePieChart.tsx
      MealSection.tsx
      FoodSuggestion.tsx
      ThemeProvider.tsx
    /pages
      AuthPage.tsx
      MainPage.tsx
      HistoryPage.tsx
      SettingsPage.tsx
      DesignSystemPage.tsx
    App.tsx
    routes.tsx
  /styles
    theme.css          # CSS custom properties and theme
    tailwind.css
    index.css
```

## Getting Started

1. The app starts at the authentication page (`/`)
2. Sign in with any credentials to access the main app
3. Navigate to `/design-system` to view the complete design system showcase
4. Use swipe gestures or navigation icons to move between screens

## Design System Documentation

Full design system documentation is available in `/DESIGN_SYSTEM.md`, including:
- Component API reference
- Usage examples
- Color system
- Accessibility guidelines
- Animation specifications
- Mobile optimization details

## Key Features Implemented

✅ Mobile-first responsive design
✅ Ice Blue theme with dark mode
✅ All component states (initial, loading, error, success, disabled)
✅ Gradient hover effects
✅ Swipe navigation
✅ Expandable chat interface
✅ Mock AI food recognition
✅ Calorie tracking with pie chart
✅ Weekly history with line chart
✅ Settings with theme persistence
✅ Collapsible meal sections
✅ Full design system showcase

## Notes

- This is a frontend-only implementation with mock data
- AI food recognition uses randomized mock responses
- Theme preference is saved to localStorage
- All navigation and interactions are fully functional