# Calorie Tracker Design System

A mobile-first, opinionated design system for semantic calorie tracking applications.

## Core Principles

- **Mobile-First**: Optimized for mobile experiences with responsive scaling
- **Ice Blue Theme**: Primary color scheme based on Ice Blue (#0ea5e9)
- **Moderate Rounding**: 10px base border radius for comfortable, modern feel
- **Semantic States**: Clear visual feedback for initial, loading, error, success, and disabled states
- **Dark Mode Support**: Full dark theme with adjusted colors for optimal contrast
- **Flat Interaction States**: Solid token-based hover colors with restrained press motion
- **Local UI Font Stack**: Fast, offline-safe Latin and Cyrillic typography with a 16px base size
- **Consistent Text**: Text component for unified typography across the app

## Color System

### Light Mode
- **Primary**: Ice Blue (#0ea5e9) with dark foreground text - Main brand color
- **Secondary**: Light gray (#f1f5f9) - Secondary actions
- **Success**: Green (#10b981) - Positive feedback
- **Destructive**: Red (#dc2626) - Errors and deletion
- **Warning**: Amber (#f59e0b) - Attention required

### Dark Mode
- **Primary**: Lighter Ice Blue (#38bdf8) - Adjusted for dark backgrounds
- Colors automatically adjust for proper contrast in dark mode

## Components

### Button
Location: `/src/app/components/ds/Button.tsx`

**Variants:**
- `primary` - Ice Blue, main call-to-action
- `secondary` - Neutral gray
- `success` - Green for positive actions
- `destructive` - Red for dangerous actions
- `outline` - Bordered, transparent background
- `ghost` - No background, minimal style

**Sizes:**
- `sm` - 44px height with compact horizontal padding
- `md` - 44px height, default
- `lg` - 48px height, prominent
- `icon` - 44px square for icons

**States:**
- `initial` - Normal state
- `loading` - Shows spinner, disabled
- `disabled` - Grayed out, not clickable
- `success` - Green variant for completed actions
- `error` - Red variant for failed actions

**Interaction:**
Primary and secondary buttons transition to solid semantic hover tokens. Buttons use no hover
shadow or decorative gradient. Pressed buttons scale to 98%; reduced-motion preferences disable
the transform.

### Input
Location: `/src/app/components/ds/Input.tsx`

**Variants:**
- `default` - Standard input
- `success` - Green border for valid input
- `error` - Red border for invalid input

**Sizes:**
- `sm` - 44px height with compact density
- `md` - 44px height, default
- `lg` - 48px height

### Card
Location: `/src/app/components/ds/Card.tsx`

Container component with two intentional levels of containment. `plain` (the default) adds no
border, background, padding, radius, or shadow. `elevated` adds a card surface, 20px padding,
moderate rounding, and one subtle shadow for focused/transactional content. Includes:
- `Card` - Main container
- `CardHeader` - Top section with padding
- `CardTitle` - Heading text
- `CardDescription` - Subtitle text
- `CardContent` - Main content area
- `CardFooter` - Bottom section

### LinkButton
Location: `/src/app/components/ds/LinkButton.tsx`

React Router link styled as a button. Accepts same variants and sizes as Button.

### Badge
Location: `/src/app/components/ds/Badge.tsx`

Small label component for tags and status indicators.

**Variants:**
- `default` - Primary color background
- `secondary` - Neutral gray
- `success` - Green for positive status
- `destructive` - Red for errors
- `warning` - Amber for attention
- `outline` - Bordered style

### Spinner
Location: `/src/app/components/ds/Spinner.tsx`

Loading indicator component.

**Sizes:**
- `sm` - 16px
- `md` - 24px (default)
- `lg` - 32px

### Text
Location: `/src/app/components/ds/Text.tsx`

Unified typography component for consistent 16px body text using the local platform UI font stack.
Semantic elements receive a default hierarchy unless a caller explicitly chooses a size: `h1`
24px, `h2` 20px, `h3` 18px, `h4` 16px, and labels 14px.

**Variants:**
- `body` - Default foreground color
- `muted` - Muted foreground for secondary text
- `primary` - Primary brand color
- `success` - Green for positive messages
- `error` - Red for error messages
- `warning` - Amber for warnings

**Sizes:**
- `xs` - 12px
- `sm` - 14px
- `base` - 16px (default)
- `lg` - 18px
- `xl` - 20px
- `2xl` - 24px
- `3xl` - 30px

**Weights:**
- `normal` - 400 (default)
- `medium` - 500
- `semibold` - 600

**Alignment:**
- `left` - Left aligned (default)
- `center` - Center aligned
- `right` - Right aligned

**As (Element Type):**
- `p` - Paragraph (default)
- `span` - Inline span
- `div` - Block div
- `label` - Form label

## Usage Examples

### Button
```tsx
import { Button } from "./components/ds/Button";

<Button variant="primary" size="md">
  Click Me
</Button>

<Button variant="primary" loading>
  Loading...
</Button>

<Button variant="destructive" disabled>
  Disabled
</Button>
```

### Input
```tsx
import { Input } from "./components/ds/Input";

<Input 
  placeholder="Enter email" 
  variant="default"
  size="md"
/>

<Input 
  placeholder="Valid input" 
  variant="success"
/>

<Input 
  placeholder="Error state" 
  variant="error"
/>
```

### Card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./components/ds/Card";

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
</Card>
```

### LinkButton
```tsx
import { LinkButton } from "./components/ds/LinkButton";

<LinkButton to="/settings" variant="primary">
  Go to Settings
</LinkButton>
```

### Badge
```tsx
import { Badge } from "./components/ds/Badge";

<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Inactive</Badge>
```

### Spinner
```tsx
import { Spinner } from "./components/ds/Spinner";

<Spinner size="md" />
<Spinner size="lg" />
```

### Text
```tsx
import { Text } from "./components/ds/Text";

<Text variant="primary" size="lg" weight="semibold">
  Primary Brand Text
</Text>

<Text variant="success" size="base" weight="normal">
  Success Message
</Text>

<Text variant="error" size="sm" weight="medium">
  Error Message
</Text>

<Text variant="warning" size="xl" weight="semibold" align="center">
  Warning Message
</Text>

<Text variant="body" size="base" weight="normal" as="p">
  Body Text
</Text>

<Text variant="muted" size="sm" weight="normal" as="span">
  Muted Text
</Text>
```

## Application Features

### Authentication
- Simple login/signup flow
- Email and password inputs
- Loading state on submission
- Transitions to main app

### Main Page
- **User Icon**: Top-right profile access
- **Pie Chart**: Visual calorie tracking (consumed/remaining)
- **Suggestions**: Rotating food tips
- **Navigation Icons**: Home, History, Settings with swipe gestures
- **Collapsible Meals**: Breakfast, Lunch, Dinner sections with nutritional info
- **Chat Input**: Expandable food logging interface
  - Expands to 2/3 screen height
  - Shows remaining calorie chart while expanded
  - AI food recognition with accept/reject flow

### History Page
- Weekly summary with chart
- Average calories vs goal
- Daily breakdown with progress bars
- Trend indicators

### Settings Page
- Dark mode toggle
- Daily calorie goal
- Profile information (weight, height)
- Sign out option

### Swipe Navigation
- Swipe left → History
- Swipe right → Settings
- Threshold: 100px minimum swipe distance

## Theme Customization

The theme is defined in `/src/styles/theme.css` using CSS custom properties. All colors automatically adjust for dark mode using the `.dark` class.

To customize:
1. Edit color values in `:root` for light mode
2. Edit color values in `.dark` for dark mode
3. Components will automatically use the new colors

## Accessibility

- Focus visible rings on interactive elements
- Proper button states (disabled, loading)
- Semantic HTML elements
- Semantic foreground/background token pairs meet WCAG AA contrast for normal text
- Touch targets sized appropriately for mobile (44px minimum)

## Animation & Transitions

- Button hover: Solid token color transition (150ms)
- Button active: Scale down to 98% (disabled for reduced motion)
- Card expansion: Height animation with spring physics
- Chat input: Smooth height transition with Motion
- Loading spinners: Continuous rotation

## Mobile Optimization

- Max-width container (448px) for optimal mobile viewing
- Touch-friendly spacing and sizing
- Swipe gestures for navigation
- Expandable chat interface
- Responsive charts and graphs
