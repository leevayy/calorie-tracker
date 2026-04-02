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
            <h1 className="text-3xl mb-2">Calorie Tracker Design System</h1>
            <p className="text-muted-foreground">
              A mobile-first, opinionated design system with Ice Blue theme
            </p>
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
                <p className="text-sm font-medium">Primary</p>
                <p className="text-xs text-muted-foreground">Ice Blue</p>
              </div>
              <div>
                <div className="h-20 rounded-lg bg-secondary mb-2" />
                <p className="text-sm font-medium">Secondary</p>
                <p className="text-xs text-muted-foreground">Neutral</p>
              </div>
              <div>
                <div className="h-20 rounded-lg bg-success mb-2" />
                <p className="text-sm font-medium">Success</p>
                <p className="text-xs text-muted-foreground">Green</p>
              </div>
              <div>
                <div className="h-20 rounded-lg bg-destructive mb-2" />
                <p className="text-sm font-medium">Destructive</p>
                <p className="text-xs text-muted-foreground">Red</p>
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
              <h4 className="mb-3">Variants</h4>
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
              <h4 className="mb-3">Sizes</h4>
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
              <h4 className="mb-3">States</h4>
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
              <h4 className="mb-3">Link Buttons</h4>
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
              <h4>Variants</h4>
              <Input placeholder="Default input" variant="default" />
              <Input placeholder="Success input" variant="success" />
              <Input placeholder="Error input" variant="error" />
            </div>

            {/* Sizes */}
            <div className="space-y-3">
              <h4>Sizes</h4>
              <Input placeholder="Small input" size="sm" />
              <Input placeholder="Medium input" size="md" />
              <Input placeholder="Large input" size="lg" />
            </div>

            {/* States */}
            <div className="space-y-3">
              <h4>States</h4>
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
                  <p className="text-sm">
                    Cards provide a clean container for grouping related content.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Highlighted Card</CardTitle>
                  <CardDescription>With custom border color</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    You can customize cards with different border colors.
                  </p>
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
                <p className="text-sm mb-2 text-muted-foreground">
                  Hover over buttons to see the gradient effect
                </p>
                <div className="flex gap-3">
                  <Button variant="primary">Hover Me</Button>
                  <Button variant="secondary">Or Me</Button>
                </div>
              </div>
              <div>
                <p className="text-sm mb-2 text-muted-foreground">
                  Active states have slight scale animation
                </p>
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
                <span>Success state - action completed</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 text-destructive">
                <X className="h-5 w-5" />
                <span>Error state - something went wrong</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 text-warning">
                <AlertCircle className="h-5 w-5" />
                <span>Warning state - requires attention</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading state - please wait</span>
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
              <h1>Heading 1</h1>
              <p className="text-sm text-muted-foreground">
                Used for page titles and major sections
              </p>
            </div>
            <div>
              <h2>Heading 2</h2>
              <p className="text-sm text-muted-foreground">
                Used for card titles and subsections
              </p>
            </div>
            <div>
              <h3>Heading 3</h3>
              <p className="text-sm text-muted-foreground">
                Used for smaller headings
              </p>
            </div>
            <div>
              <p>Body text with normal weight and comfortable line height.</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Muted text for secondary information and descriptions.
              </p>
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
                <p className="text-sm">Small (6px)</p>
              </div>
              <div>
                <div className="h-20 bg-primary rounded-md mb-2" />
                <p className="text-sm">Medium (8px)</p>
              </div>
              <div>
                <div className="h-20 bg-primary rounded-lg mb-2" />
                <p className="text-sm">Large (10px)</p>
              </div>
              <div>
                <div className="h-20 bg-primary rounded-xl mb-2" />
                <p className="text-sm">XL (14px)</p>
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
                <p className="text-xs text-muted-foreground mt-2">Small</p>
              </div>
              <div className="text-center">
                <Spinner size="md" />
                <p className="text-xs text-muted-foreground mt-2">Medium</p>
              </div>
              <div className="text-center">
                <Spinner size="lg" />
                <p className="text-xs text-muted-foreground mt-2">Large</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Text Component */}
        <Card>
          <CardHeader>
            <CardTitle>Text Component</CardTitle>
            <CardDescription>Unified typography system with 14px base size and Inter font</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Variants */}
            <div className="space-y-2">
              <h4 className="mb-3">Variants</h4>
              <Text variant="body">Body text (default)</Text>
              <Text variant="muted">Muted text for secondary information</Text>
              <Text variant="primary">Primary colored text</Text>
              <Text variant="success">Success message</Text>
              <Text variant="error">Error message</Text>
              <Text variant="warning">Warning message</Text>
            </div>

            {/* Sizes */}
            <div className="space-y-2">
              <h4 className="mb-3">Sizes</h4>
              <Text size="xs">Extra small text (12px)</Text>
              <Text size="sm">Small text (13px)</Text>
              <Text size="base">Base text (14px - default)</Text>
              <Text size="lg">Large text (16px)</Text>
              <Text size="xl">Extra large text (18px)</Text>
              <Text size="2xl">2XL text (24px)</Text>
              <Text size="3xl">3XL text (30px)</Text>
            </div>

            {/* Weights */}
            <div className="space-y-2">
              <h4 className="mb-3">Weights</h4>
              <Text weight="normal">Normal weight (400)</Text>
              <Text weight="medium">Medium weight (500)</Text>
              <Text weight="semibold">Semibold weight (600)</Text>
            </div>

            {/* Alignment */}
            <div className="space-y-2">
              <h4 className="mb-3">Alignment</h4>
              <Text align="left">Left aligned text</Text>
              <Text align="center">Center aligned text</Text>
              <Text align="right">Right aligned text</Text>
            </div>

            {/* Combinations */}
            <div className="space-y-2">
              <h4 className="mb-3">Combinations</h4>
              <Text size="lg" weight="medium" variant="primary">
                Large, medium weight, primary colored text
              </Text>
              <Text size="sm" variant="muted" weight="normal">
                Small, muted, normal weight text for descriptions
              </Text>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}