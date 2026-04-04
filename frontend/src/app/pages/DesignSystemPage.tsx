import { Button } from "../components/ds/Button";
import { Input } from "../components/ds/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ds/Card";
import { LinkButton } from "../components/ds/LinkButton";
import { Badge } from "../components/ds/Badge";
import { Spinner } from "../components/ds/Spinner";
import { Text } from "../components/ds/Text";
import { Check, X, AlertCircle, Loader2 } from "lucide-react";
import { useTheme } from "../components/ThemeProvider";

export default function DesignSystemPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Text as="h1" size="3xl" weight="medium" className="mb-2">
              Calorie Tracker Design System
            </Text>
            <Text variant="muted">
              A mobile-first, opinionated design system with Ice Blue theme
            </Text>
          </div>
          <Button onClick={toggleTheme} variant="outline">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>
        </div>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
            <CardDescription>Ice Blue primary with semantic colors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="h-20 rounded-lg bg-primary mb-2" />
                <Text weight="medium">Primary</Text>
                <Text variant="muted">Ice Blue</Text>
              </div>
              <div>
                <div className="h-20 rounded-lg bg-secondary mb-2" />
                <Text weight="medium">Secondary</Text>
                <Text variant="muted">Neutral</Text>
              </div>
              <div>
                <div className="h-20 rounded-lg bg-success mb-2" />
                <Text weight="medium">Success</Text>
                <Text variant="muted">Green</Text>
              </div>
              <div>
                <div className="h-20 rounded-lg bg-destructive mb-2" />
                <Text weight="medium">Destructive</Text>
                <Text variant="muted">Red</Text>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardDescription>
              Multiple variants with gradient hover effects (600→700)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Variants */}
            <div>
              <Text as="h4" weight="medium" className="mb-3">
                Variants
              </Text>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="success">Success</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <Text as="h4" weight="medium" className="mb-3">
                Sizes
              </Text>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* States */}
            <div>
              <Text as="h4" weight="medium" className="mb-3">
                States
              </Text>
              <div className="flex flex-wrap gap-3">
                <Button state="initial">Initial</Button>
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
                <Button variant="success" state="success">
                  <Check className="h-4 w-4" />
                  Success
                </Button>
                <Button variant="destructive" state="error">
                  <X className="h-4 w-4" />
                  Error
                </Button>
              </div>
            </div>

            {/* Link Buttons */}
            <div>
              <Text as="h4" weight="medium" className="mb-3">
                Link Buttons
              </Text>
              <div className="flex flex-wrap gap-3">
                <LinkButton to="/" variant="primary">
                  Primary Link
                </LinkButton>
                <LinkButton to="/" variant="secondary">
                  Secondary Link
                </LinkButton>
                <LinkButton to="/" variant="outline">
                  Outline Link
                </LinkButton>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inputs */}
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Form inputs with different states and sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Variants */}
            <div className="space-y-3">
              <Text as="h4" weight="medium">
                Variants
              </Text>
              <Input placeholder="Default input" variant="default" />
              <Input placeholder="Success input" variant="success" />
              <Input placeholder="Error input" variant="error" />
            </div>

            {/* Sizes */}
            <div className="space-y-3">
              <Text as="h4" weight="medium">
                Sizes
              </Text>
              <Input placeholder="Small input" size="sm" />
              <Input placeholder="Medium input" size="md" />
              <Input placeholder="Large input" size="lg" />
            </div>

            {/* States */}
            <div className="space-y-3">
              <Text as="h4" weight="medium">
                States
              </Text>
              <Input placeholder="Normal state" />
              <Input placeholder="Disabled state" disabled />
              <Input placeholder="With value" value="Example text" readOnly />
            </div>
          </CardContent>
        </Card>

        {/* Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Cards</CardTitle>
            <CardDescription>
              Container components with moderate rounding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Card</CardTitle>
                  <CardDescription>A simple card component</CardDescription>
                </CardHeader>
                <CardContent>
                  <Text>Cards provide a clean container for grouping related content.</Text>
                </CardContent>
              </Card>

              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Highlighted Card</CardTitle>
                  <CardDescription>With custom border color</CardDescription>
                </CardHeader>
                <CardContent>
                  <Text>You can customize cards with different border colors.</Text>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Interactive States */}
        <Card>
          <CardHeader>
            <CardTitle>Interactive States</CardTitle>
            <CardDescription>
              Hover effects with subtle gradients (600→700 color values)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Text variant="muted" className="mb-2">
                  Hover over buttons to see the gradient effect
                </Text>
                <div className="flex gap-3">
                  <Button variant="primary">Hover Me</Button>
                  <Button variant="secondary">Or Me</Button>
                </div>
              </div>
              <div>
                <Text variant="muted" className="mb-2">
                  Active states have slight scale animation
                </Text>
                <Button variant="primary">Click Me</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Semantic States */}
        <Card>
          <CardHeader>
            <CardTitle>Semantic States</CardTitle>
            <CardDescription>
              Visual feedback for different application states
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 text-success">
                <Check className="h-5 w-5" />
                <Text as="span">Success state - action completed</Text>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 text-destructive">
                <X className="h-5 w-5" />
                <Text as="span">Error state - something went wrong</Text>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 text-warning">
                <AlertCircle className="h-5 w-5" />
                <Text as="span">Warning state - requires attention</Text>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <Text as="span">Loading state - please wait</Text>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Consistent text hierarchy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Text as="h1" weight="medium">
                Heading 1
              </Text>
              <Text variant="muted">Used for page titles and major sections</Text>
            </div>
            <div>
              <Text as="h2" weight="medium">
                Heading 2
              </Text>
              <Text variant="muted">Used for card titles and subsections</Text>
            </div>
            <div>
              <Text as="h3" weight="medium">
                Heading 3
              </Text>
              <Text variant="muted">Used for smaller headings</Text>
            </div>
            <div>
              <Text>Body text with normal weight and comfortable line height.</Text>
            </div>
            <div>
              <Text variant="muted">Muted text for secondary information and descriptions.</Text>
            </div>
          </CardContent>
        </Card>

        {/* Spacing & Rounding */}
        <Card>
          <CardHeader>
            <CardTitle>Spacing & Border Radius</CardTitle>
            <CardDescription>Moderate rounding (10px base radius)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="h-20 bg-primary rounded-sm mb-2" />
                <Text>Small (6px)</Text>
              </div>
              <div>
                <div className="h-20 bg-primary rounded-md mb-2" />
                <Text>Medium (8px)</Text>
              </div>
              <div>
                <div className="h-20 bg-primary rounded-lg mb-2" />
                <Text>Large (10px)</Text>
              </div>
              <div>
                <div className="h-20 bg-primary rounded-xl mb-2" />
                <Text>XL (14px)</Text>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
            <CardDescription>Small labels for tags and status indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="destructive">Error</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Spinners */}
        <Card>
          <CardHeader>
            <CardTitle>Spinners</CardTitle>
            <CardDescription>Loading indicators in different sizes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <Spinner size="sm" />
                <Text variant="muted" className="mt-2">
                  Small
                </Text>
              </div>
              <div className="text-center">
                <Spinner size="md" />
                <Text variant="muted" className="mt-2">
                  Medium
                </Text>
              </div>
              <div className="text-center">
                <Spinner size="lg" />
                <Text variant="muted" className="mt-2">
                  Large
                </Text>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Text Component */}
        <Card>
          <CardHeader>
            <CardTitle>Text Component</CardTitle>
            <CardDescription>
              Unified typography with 15px base (1rem), comfortable line height, and Inter font
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Variants */}
            <div className="space-y-2">
              <Text as="h4" weight="medium" className="mb-3">
                Variants
              </Text>
              <Text variant="body">Body text (default)</Text>
              <Text variant="muted">Muted text for secondary information</Text>
              <Text variant="primary">Primary colored text</Text>
              <Text variant="success">Success message</Text>
              <Text variant="error">Error message</Text>
              <Text variant="warning">Warning message</Text>
            </div>

            {/* Sizes */}
            <div className="space-y-2">
              <Text as="h4" weight="medium" className="mb-3">
                Sizes
              </Text>
              <Text size="xs">Extra small (text-xs)</Text>
              <Text size="sm">Small (text-sm)</Text>
              <Text size="base">Base (1rem, default)</Text>
              <Text size="lg">Large (text-lg)</Text>
              <Text size="xl">Extra large (text-xl)</Text>
              <Text size="2xl">2XL (text-2xl)</Text>
              <Text size="3xl">3XL (text-3xl)</Text>
            </div>

            {/* Weights */}
            <div className="space-y-2">
              <Text as="h4" weight="medium" className="mb-3">
                Weights
              </Text>
              <Text weight="normal">Normal weight (400)</Text>
              <Text weight="medium">Medium weight (500)</Text>
              <Text weight="semibold">Semibold weight (600)</Text>
            </div>

            {/* Alignment */}
            <div className="space-y-2">
              <Text as="h4" weight="medium" className="mb-3">
                Alignment
              </Text>
              <Text align="left">Left aligned text</Text>
              <Text align="center">Center aligned text</Text>
              <Text align="right">Right aligned text</Text>
            </div>

            {/* Combinations */}
            <div className="space-y-2">
              <Text as="h4" weight="medium" className="mb-3">
                Combinations
              </Text>
              <Text size="lg" weight="medium" variant="primary">
                Large, medium weight, primary colored text
              </Text>
              <Text variant="muted" weight="normal">
                Muted body text for descriptions
              </Text>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
